const knex =
  (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging')
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)
const { Storage } = require('@google-cloud/storage')
const path = require('path')
const https = require('https')

const serviceKey = path.join(__dirname, '../../storage-creds.json')
const bucketName = process.env.GCP_BUCKET_NAME
const storage = new Storage({
  keyFilename: serviceKey,
  projectId: process.env.GCP_PROJECT_ID
})
const bucket = storage.bucket(bucketName)

module.exports = {
  type: 'get',
  path: '/file/:objectIdentifier',
  knex,
  summary: 'Use this route when requesting data that is being hosted with NanoStore.',
  errors: [
    'ERR_NOT_FOUND',
    'ERR_INTERNAL'
  ],
  func: async (req, res) => {
    try {
      // The file with this object ID is requested
      const [file] = await knex('file').where({
        objectIdentifier: req.params.objectIdentifier,
        isAvailable: true
      }).select('mimeType', 'fileHash')

      // If the file is not found, this is a 404
      if (!file) {
        return res.status(404).json({
          status: 'error',
          code: 'ERR_NOT_FOUND',
          description: 'This file cannot be found, or it has expired.'
        })
      }

      // We use Cloud Storage API to get a reference to the file
      const storageFile = bucket.file(file.fileHash)

      // A time-bound URL is created allowing us to proxy the request, giving the requester access to this file
      const [url] = await storageFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 604500 * 1000 // one month
      })

      // We only need the last part of the URL, which contains the ID
      const urlPath = url.split('/').pop()

      // We proxy any headers the client may have sent, except "host"
      const newHeaders = {
        ...req.headers
      }
      delete newHeaders.host

      // A proxied HTTPS request is made to Google's servers, using the client's headers and our new URL
      const httpRequest = https.request({
        host: 'storage.googleapis.com',
        port: 443,
        path: `/${bucketName}/${urlPath}`,
        method: 'GET',
        headers: newHeaders
      }, proxyRes => {
        // The content type the file was originally uploaded with is retained
        res.header('Content-Type', file.mimeType)

        // Any headers Google sent back are now given to the client
        res.writeHead(proxyRes.statusCode, proxyRes.headers)

        // When any chunks of data are receivd, they are given to the client
        proxyRes.on('data', chunk => {
          res.write(chunk)
        })

        // When the Google request ends, the client request ends
        proxyRes.on('close', () => {
          res.end()
        })
        proxyRes.on('end', () => {
          res.end()
        })
      })

      // In case of errors, the user's request is closed
      httpRequest.on('error', e => {
        console.error(e)

        // We try to write an error response back to the user if possible
        try {
          res.writeHead(500)
          res.write(e.message)
        } catch (e) {
          // ignore
        }
        res.end()
      })
      httpRequest.end()

    // Unknown errors are logged and a 500 response is returned
    } catch (e) {
      console.error(e)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
    }
  }
}
