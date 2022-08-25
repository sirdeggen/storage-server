// *** not currently used ***
// const getUploadURL = require('../utils/getUploadURL')
const Ninja = require('utxoninja')
const knex =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)
const authenticateRequest = require('../utils/authenticateRequest')

module.exports = {
  type: 'post',
  path: '/pay',
  knex,
  summary: 'Use this route to submit proof of payment for nanostore hosting',
  parameters: {
    amount: 500,
    referenceNumber: 'xyz',
    description: '',
    paymail: '',
    orderID: 'abc'
  },
  exampleResponse: {
  },
  func: async (req, res) => {
    try {
      const userId = await authenticateRequest({ req, res, knex })
      console.log('authenticateRequest():userId:', userId)
      if (!userId) return
      // Create a new ninja for the server
      const ninja = new Ninja({
        privateKey: process.env.SERVER_PRIVATE_KEY,
        config: {
          dojoURL: process.env.DOJO_URL
        }
      })
      console.log('req.authrite.identityKey:', req.authrite.identityKey)
      // Find valid request invoice
      const [invoice] = await knex('invoice').where({
        userID: userId,
        identityKey: req.authrite.identityKey,
        orderID: req.body.orderID
      })
      if (!invoice) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVOICE_NOT_FOUND',
          description: 'An invoice for the specified request was not found!'
        })
      }

      // Verify the payment
      const processed = await ninja.verifyIncomingTransaction({ senderPaymail: req.body.paymail, senderIdentityKey: req.authrite.identityKey, referenceNumber: req.body.referenceNumber, description: req.body.description, amount: invoice.amount })
      if (!processed) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_PAYMENT_INVALID',
          description: 'Could not validate payment!'
        })
      }
      // Update invoice
      await knex('invoice')
        .where({ userID: userId, identityKey: req.authrite.identityKey, orderID: req.body.orderID, referenceNumber: null, paymail: null, processed: false })
        .update({ paymail: req.body.paymail, referenceNumber: req.body.referenceNumber, processed: true })

      // Add the payment amount to the user's balance
      await knex('user')
        .where({ userId, identityKey: req.authrite.identityKey })
        .update({
          balance: knex.raw(`balance + ${invoice.amount}`),
          updated_at: new Date()
        })
      const referenceNumber = req.body.orderID
      console.log('referenceNumber:', referenceNumber)
      const [transaction] = await knex('transaction').where({
        referenceNumber
      }).select(
        'fileId', 'amount', 'numberOfMinutesPurchased', 'paid'
      )
      if (!transaction) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_BAD_REF',
          description: 'The reference number you provided cannot be found.'
        })
      }
      if (transaction.paid) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_ALREADY_PAID',
          description: `The reference number you have provided is attached to an invoice that was already paid by a transaction with TXID ${transaction.txid}`,
          txid: transaction.txid
        })
      }

      console.log('get file object from DB')
      const [file] = await knex('file')
        .select('fileSize', 'objectIdentifier')
        .where({ fileId: transaction.fileId })

      // *** commented out for testing - use preset ***
      const uploadURL = 'google.com/uploadurl'
      // console.log('call getUploadURL()')
      // const { uploadURL } = await getUploadURL({
      //   size: file.fileSize,
      //   objectIdentifier: file.objectIdentifier
      // })
      console.log('called getUploadURL():uploadURL:', uploadURL)

      // TODO need to advertise the UHRP URL after upload
      // await knex('transaction').where({ referenceNumber }).update({
      //   advertisementTXID: adTXID
      // })

      return res.status(200).json({
        uploadURL,
        publicURL: `${process.env.NODE_ENV === 'development' ? 'http' : 'https'}://${process.env.HOSTING_DOMAIN}${process.env.ROUTING_PREFIX || ''}/cdn/${file.objectIdentifier}`,
        status: 'success'
      })
    } catch (e) {
      console.error(e)
      if (global.Bugsnag) global.Bugsnag.notify(e)
      res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
    }
  }
}
