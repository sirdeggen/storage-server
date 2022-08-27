const { Storage } = require('@google-cloud/storage')
const path = require('path')
const { NODE_ENV } = process.env

if (NODE_ENV === 'development') {
  module.exports = () => {
    console.log(
      '[DEV] Returning pretend upload URL http://localhost:3104/upload'
    )
    return 'http://localhost:3104/upload'
  }
  return
}

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
  const bucketFile = bucket.file(`cdn/${objectIdentifier}`)
  const [uploadURL] = await bucketFile.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 604000 * 1000, // 1 week
    extensionHeaders: {
      'content-length': size
    }
  })
  return {
    uploadURL
  }
}
