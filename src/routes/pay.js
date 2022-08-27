const getUploadURL = require('../utils/getUploadURL')
const Ninja = require('utxoninja')
const {
  DOJO_URL,
  SERVER_PRIVATE_KEY,
  NODE_ENV,
  HOSTING_DOMAIN,
  ROUTING_PREFIX
} = process.env
const knex =
  NODE_ENV === 'production' || NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)

module.exports = {
  type: 'post',
  path: '/pay',
  knex,
  summary: 'Use this route to pay an invoice and retrieve a URL to upload the data you want to host.',
  parameters: {
    reference: 'xyz',
    description: '',
    paymail: '',
    orderID: 'abc'
  },
  exampleResponse: {
    uploadURL: 'https://upload-server.com/file/new',
    publicURL: 'https://foo.com/bar.html'
  },
  errors: [
    'ERR_TRANSACTION_NOT_FOUND',
    'ERR_ALREADY_PAID',
    'ERR_TRANSACTION_AMOUNT_DIFFERENT_TO_RECEIVED_AMOUNT',
    'ERR_PAYMENT_INVALID',
    'ERR_BAD_REFERENCE',
    'ERR_INTERNAL_PAYMENT_PROCESSING'
  ],
  func: async (req, res) => {
    try {
      const ninja = new Ninja({
        privateKey: SERVER_PRIVATE_KEY,
        config: {
          dojoURL: DOJO_URL
        }
      })
      // Find valid request transaction
      const [transaction] = await knex('transaction').where({
        identityKey: req.authrite.identityKey,
        orderID: req.body.orderID
      })
      // console.log('transaction:', transaction)
      if (!transaction) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_TRANSACTION_NOT_FOUND',
          description: 'A transaction for the specified request was not found!'
        })
      }
      if (transaction.paid) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_ALREADY_PAID',
          description: `The reference you have provided is attached to an invoice that was already paid and is for Order Id ${transaction.orderID}`,
          orderID: transaction.orderID
        })
      }
      // Verify the payment
      const processed = await ninja.verifyIncomingTransaction({
        senderPaymail: req.body.paymail,
        senderIdentityKey: req.authrite.identityKey,
        referenceNumber: req.body.reference,
        description: req.body.description,
        amount: transaction.amount
      })
      if (!processed) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_PAYMENT_INVALID',
          description: 'Could not validate payment!'
        })
      }
      // Update transaction
      await knex('transaction')
        // TODO change to referenceNumber to reference
        .where({
          identityKey: req.authrite.identityKey,
          orderID: req.body.orderID,
          referenceNumber: null,
          paymail: null,
          paid: false
        })
        .update({
          paymail: req.body.paymail,
          referenceNumber: req.body.reference,
          paid: true,
          updated_at: new Date()
        })
      const [file] = await knex('file')
        .select('fileSize', 'objectIdentifier')
        .where({ fileId: transaction.fileId })

      const { uploadURL } = await getUploadURL({
        size: file.fileSize,
        objectIdentifier: file.objectIdentifier
      })

      return res.status(200).json({
        uploadURL,
        publicURL: `${NODE_ENV === 'development' ? 'http' : 'https'}://${HOSTING_DOMAIN}${ROUTING_PREFIX || ''}/cdn/${file.objectIdentifier}`,
        status: 'success'
      })
    } catch (e) {
      console.error(e)
      if (global.Bugsnag) global.Bugsnag.notify(e)
      res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL_PAYMENT_PROCESSING',
        description: 'An internal error has occurred.'
      })
    }
  }
}
