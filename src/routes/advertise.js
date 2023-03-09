const { Storage } = require('@google-cloud/storage')
const knex = require('knex')(require('../../knexfile.js').production)
const createUHRPAdvertisement = require('../utils/createUHRPAdvertisement')

const {
  ADMIN_TOKEN,
  NODE_ENV,
  ROUTING_PREFIX,
  HOSTING_DOMAIN,
  GCP_BUCKET_NAME
} = process.env
const storage = new Storage()

module.exports = {
  type: 'post',
  path: '/advertise',
  knex,
  summary: 'This is an administrative endpoint used by the server administrator to trigger UHRP advertisements when new files are uploaded.',
  parameters: {
    adminToken: 'Server admin token',
    fileHash: 'The UHRP hash to advertise',
    objectIdentifier: 'The ID of this contract',
    fileSize: 'The length of the file'
  },
  exampleResponse: {
    status: 'success'
  },
  errors: [
    'ERR_UNAUTHORIZED'
  ],
  func: async (req, res) => {
    if (
      typeof ADMIN_TOKEN === 'string' &&
      ADMIN_TOKEN.length > 10 &&
      req.body.adminToken === ADMIN_TOKEN
    ) {
      let [fileId] = await knex('file')
        .where({
          objectIdentifier: req.body.objectIdentifier
        })
        .select('fileId')
      fileId = fileId.fileId
      const [transaction] = await knex('transaction')
        .where({ advertisementTXID: null, fileId: fileId })
        .select('numberOfMinutesPurchased')

      const expiryTime = Date.now() +
        (transaction.numberOfMinutesPurchased * 60 * 1000)

      const storageFile = storage
        .bucket(GCP_BUCKET_NAME)
        .file(`cdn/${req.body.objectIdentifier}`)

      // Create advertisement
      const { txid: adTXID } = await createUHRPAdvertisement({
        hash: req.body.fileHash,
        url: `${HOSTING_DOMAIN}${ROUTING_PREFIX || ''}/cdn/${req.body.objectIdentifier}`,
        expiryTime,
        contentLength: req.body.fileSize,
        confederacyHost: NODE_ENV === 'development'
          ? 'http://localhost:3002'
          : NODE_ENV === 'staging'
            ? 'https://staging-confederacy.babbage.systems'
            : undefined
      })

      // Set the custom time for file deletion
      await storageFile.setMetadata({
        // The object is retained for at least 5 minutes after expiration
        customTime: new Date(expiryTime + 300 * 1000).toISOString()
      })

      // Update file table
      await knex('file').where({ objectIdentifier: req.body.objectIdentifier })
        .update({
          isUploaded: true,
          isAvailable: true,
          fileHash: req.body.fileHash
        })
      await knex('transaction')
        .where({ advertisementTXID: null, fileId: fileId })
        .update({
          advertisementTXID: adTXID
        })

      res.status(200).json({
        status: 'success'
      })
    } else {
      res.status(401).json({
        status: 'error',
        code: 'ERR_UNAUTHORIZED',
        description: 'Failed to advertise hosting commitment!'
      })
    }
  }
}
