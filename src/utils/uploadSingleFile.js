const { Storage } = require('@google-cloud/storage')
const path = require('path')

const serviceKey = path.join(__dirname, '../../storage-creds.json')
const bucketName = process.env.GCP_BUCKET_NAME
const storage = new Storage({
  keyFilename: serviceKey,
  projectId: process.env.GCP_PROJECT_ID
})
const bucket = storage.bucket(bucketName)

module.exports = ({
  fileDataBuffer,
  retentionPeriod
}) => {
  return new Promise((resolve, reject) => {
    // Calculate UHRP hash of fileDataBuffer
    const hashString = 'X'

    const blob = bucket.file(hashString)
    const blobStream = blob.createWriteStream({
      resumable: false
    })

    blobStream
      .on('finish', () => {
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`
        resolve({ publicUrl, hash: blob.name })
      })
      .on('error', reject)
      .end(fileDataBuffer)
  })
}
