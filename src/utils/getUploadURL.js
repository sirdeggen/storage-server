const { Storage } = require('@google-cloud/storage')
const path = require('path')

const serviceKey = path.join(__dirname, '../../storage-creds.json')
const bucketName = process.env.GCP_BUCKET_NAME
const storage = new Storage({
  keyFilename: serviceKey,
  projectId: process.env.GCP_PROJECT_ID
})
const bucket = storage.bucket(bucketName)

module.exports = async ({
  size,
  objectIdentifier
}) => {
  const bucketFile = bucket.file(objectIdentifier)
  const [uploadURL] = await bucketFile.createResumableUpload({
    origin: '*',
    public: true,
    metadata: {
      'Content-Length': size
    }
  })
  return {
    uploadURL
  }
}
