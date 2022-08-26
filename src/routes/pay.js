// *** not currently used ***
// const getUploadURL = require('../utils/getUploadURL')
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
  summary: 'Use this route to submit proof of payment for nanostore hosting',
  parameters: {
    amount: 500,
    reference: 'xyz',
    description: '',
    paymail: '',
    orderID: 'abc'
  },
  exampleResponse: {
  },
  func: async (req, res) => {
    try {
      const ninja = new Ninja({
        privateKey: SERVER_PRIVATE_KEY,
        config: {
          dojoURL: DOJO_URL
        }
      })
      // console.log('req.authrite.identityKey:', req.authrite.identityKey)
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
      if (transaction.amount !== req.body.amount) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_TRANSACTION_AMOUNT_DIFFERENT_TO_RECEIVED_AMOUNT',
          description: 'DB transaction amount[' + transaction.amount + '] is different to received amount[' + req.body.amount + '] !',
          transactionamount: transaction.amount,
          reqamount: req.body.amount
        })
      }
      // Verify the payment
      const processed = await ninja.verifyIncomingTransaction({ senderPaymail: req.body.paymail, senderIdentityKey: req.authrite.identityKey, referenceNumber: req.body.reference, description: req.body.description, amount: transaction.amount })
      if (!processed) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_PAYMENT_INVALID',
          description: 'Could not validate payment!'
        })
      }
      // Update transaction
      await knex('transaction')
        // TBD change to referenceNumber to reference
        .where({ identityKey: req.authrite.identityKey, orderID: req.body.orderID, referenceNumber: null, paymail: null, paid: false })
        // TBD No description field to update [description: req.body.description] as per Orchestrator?
        .update({ paymail: req.body.paymail, referenceNumber: req.body.reference, paid: true, updated_at: new Date() })
      const [updatedTransaction] = await knex('transaction').where({
        referenceNumber: req.body.reference
      }).select(
        'fileId', 'amount', 'numberOfMinutesPurchased', 'paid'
      )
      if (!updatedTransaction) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_BAD_REFERENCE',
          description: 'The reference for the transaction you provided, cannot be found.',
          reference: req.body.reference
        })
      }
      // console.log('get file object from DB')
      const [file] = await knex('file')
        .select('fileSize', 'objectIdentifier')
        .where({ fileId: updatedTransaction.fileId })

      // *** commented out for testing - use preset ***
      const uploadURL = 'google.com/uploadurl'
      // console.log('call getUploadURL()')
      // const { uploadURL } = await getUploadURL({
      //   size: file.fileSize,
      //   objectIdentifier: file.objectIdentifier
      // })
      console.log('called getUploadURL():uploadURL:', uploadURL)

      // TODO need to advertise the UHRP URL after upload
      // await knex('transaction').where({ reference }).update({
      //   advertisementTXID: adTXID
      // })
      // await knex('transaction')
      //  // Change to referenceNumber to reference
      //  .where({ identityKey: req.authrite.identityKey, orderID: req.body.orderID, referenceNumber: req.body.reference, paymail: req.body.paymail, paid: true })
      //  .update({ path: uploadURL, updated_at: new Date() })

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
