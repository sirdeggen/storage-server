const knex = require('knex')(require('../../knexfile.js').production)
const { Storage } = require('@google-cloud/storage')
const path = require('path')
// const https = require('https')

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

      // If the file does not exist, this is 404
      const exists = await storageFile.exists()
      if (!exists[0]) {
        return res.status(404).json({
          status: 'error',
          code: 'ERR_NOT_FOUND',
          description: 'This file cannot be found, or it has expired.'
        })
      }

      // The request is served with sendSeekable
      const [metadata] = await storageFile.getMetadata()
      res.header('Content-Type', file.mimeType)
      res.header('Content-Length', metadata.size)
      res.header('Accept-Ranges', 'bytes')
      const stream = storageFile.createReadStream()
      res.sendSeekable(stream, { length: metadata.size, type: file.mimeType })

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
