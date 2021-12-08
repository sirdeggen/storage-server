const createUHRPAdvertisement = require('../utils/createUHRPAdvertisement')
const crypto = require('crypto')
const { Storage } = require('@google-cloud/storage')
const knex =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)
const { NODE_ENV, HOSTING_DOMAIN, ROUTING_PREFIX } = process.env
const { getURLFromHash } = require('uhrp-url')
const path = require('path')

const serviceKey = path.join(__dirname, '../../storage-creds.json')
const storage = new Storage({
  keyFilename: serviceKey,
  projectId: process.env.GCP_PROJECT_ID
})

/**
 * UHRP advertiser to be triggered by Cloud Storage.
 *
 * @param {object} file The Cloud Storage file metadata.
 * @param {object} context The event metadata.
 */
exports.processUpload = async (file, context) => {
  const objectIdentifier = file.name.split('/').pop()
  let [fileId] = await knex('file').where({ objectIdentifier }).select('fileId')
  fileId = fileId.fileId
  const [transaction] = await knex('transaction').where({ advertisementTXID: null, fileId: fileId }).select('numberOfMinutesPurchased')

  console.log(`  Event: ${context.eventId}`)
  console.log(`  Event Type: ${context.eventType}`)
  console.log(`  Bucket: ${file.bucket}`)
  console.log(`  File: ${file.name}`)
  console.log(`  Metageneration: ${file.metageneration}`)
  console.log(`  Created: ${file.timeCreated}`)
  console.log(`  Updated: ${file.updated}`)
  console.log(file)

  const storageFile = storage.bucket(file.bucket).file(file.name)
  const digest = crypto.createHash('sha256')
  const fileStream = storageFile.createReadStream()
  fileStream.pipe(digest)
  fileStream.on('end', async () => {
    digest.end()
    const hashString = getURLFromHash(digest.read())
    console.log('Got hash string', hashString)
    const expiryTime = Date.now() +
      (transaction.numberOfMinutesPurchased * 60 * 1000)
    // Create advertisement
    const adTXID = await createUHRPAdvertisement({
      hash: hashString,
      url: `${NODE_ENV === 'development' ? 'http' : 'https'}://${HOSTING_DOMAIN}${ROUTING_PREFIX || ''}/cdn/${objectIdentifier}`,
      expiryTime,
      contentLength: file.size
    })

    // Set the custom time
    await storageFile.setMetadata({
      // The object is retained for at least 5 minutes after expiration
      customTime: new Date(expiryTime + 300 * 1000).toISOString()
    })

    // Update file table
    await knex('file').where({ objectIdentifier }).update({
      isUploaded: true,
      isAvailable: true,
      fileHash: hashString
    })
    await knex('transaction')
      .where({ advertisementTXID: null, fileId: fileId })
      .update({
        advertisementTXID: adTXID
      })
  })
}
