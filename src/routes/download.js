const knex =
  (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging')
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)
const { Storage } = require('@google-cloud/storage')
const path = require('path')

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
      res.header('Content-Type', file.mimeType)
      const storageStream = storageFile.createReadStream()
      storageStream.on('data', data => {
        res.write(data)
      })
      storageStream.on('end', () => {
        res.end()
      })
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
