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
  func: async (req, res) => {
    try {
      const [file] = await knex('file').where({
        objectIdentifier: req.params.objectIdentifier,
        isAvailable: true
      }).select('mimeType', 'fileHash')
      if (!file) {
        return res.status(404).json({
          status: 'error',
          code: 'ERR_NOT_FOUND',
          description: 'This file cannot be found, or it has expired.'
        })
      }
      const storageFile = bucket.file(file.fileHash)
      const [url] = await storageFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 604500 * 1000 // one month
      })
      const urlPath = url.split('/').pop()
      const newHeaders = {
        ...req.headers
      }
      delete newHeaders.host
      const httpRequest = https.request({
        host: 'storage.googleapis.com',
        port: 443,
        path: `/${bucketName}/${urlPath}`,
        method: 'GET',
        headers: newHeaders
      }, proxyRes => {
        res.header('Content-Type', file.mimeType)
        res.writeHead(proxyRes.statusCode)
        proxyRes.on('data', chunk => {
          res.write(chunk)
        })
        proxyRes.on('close', () => {
          res.end()
        })
        proxyRes.on('end', () => {
          res.end()
        })
      })
      httpRequest.on('error', e => {
        console.error(e)
        try {
          res.writeHead(500)
          res.write(e.message)
        } catch (e) {
          // ignore
        }
        res.end()
      })
      httpRequest.end()
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
