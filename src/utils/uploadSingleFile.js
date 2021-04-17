const { Storage } = require('@google-cloud/storage')
const path = require('path')
const { getURLForFile } = require('uhrp-url')
const createUHRPAdvertisement = require('./createUHRPAdvertisement')

const { HOSTING_DOMAIN, ROUTING_PREFIX } = process.env

const serviceKey = path.join(__dirname, '../../storage-creds.json')
const bucketName = process.env.GCP_BUCKET_NAME
const storage = new Storage({
  keyFilename: serviceKey,
  projectId: process.env.GCP_PROJECT_ID
})
const bucket = storage.bucket(bucketName)

module.exports = ({
  file,
  fileId,
  numberOfMinutesPurchased,
  knex
}) => {
  return new Promise((resolve, reject) => {
    const hashString = getURLForFile(file.buffer)
    const blob = bucket.file(hashString)
    const blobStream = blob.createWriteStream({
      resumable: false
    })

    blobStream
      .on('finish', async () => {
        // Update file table
        const deleteAfter = new Date(
          Date.now() + (1000 * 60 * numberOfMinutesPurchased)
        )
        await knex('file').where({ fileId }).update({
          deleteAfter,
          isUploaded: true,
          isAvailable: true,
          mimeType: file.mimetype,
          fileHash: hashString
        })

        // Find the file ID
        let objectID = await knex('file')
          .where({ fileId })
          .select('objectIdentifier')
        objectID = objectID[0].objectIdentifier

        // Define the public URL
        const publicURL = `https://${HOSTING_DOMAIN}${ROUTING_PREFIX || ''}/file/${objectID}`

        // Advertise availability with UHRP
        const adTXID = await createUHRPAdvertisement({
          hash: hashString,
          url: publicURL,
          expiryTime: parseInt(deleteAfter.getTime()),
          contentLength: file.size
        })

        // Resolve with the data
        resolve({
          publicURL,
          hash: blob.name,
          adTXID
        })
      })
      .on('error', reject)
      .end(file.buffer)
  })
}
