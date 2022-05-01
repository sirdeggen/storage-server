const getUploadURL = require('../utils/getUploadURL')
const knex = require('knex')(require('../../knexfile.js').production)
const bsv = require('bsv')
const atfinder = require('atfinder')

const { SERVER_PAYMAIL, HOSTING_DOMAIN, NODE_ENV, ROUTING_PREFIX } = process.env

module.exports = {
  type: 'post',
  path: '/pay',
  knex,
  summary: 'Use this route to pay an invoice and retrieve a URL to upload the data you want to host.',
  parameters: {
    referenceNumber: 'The reference number you received when you created the invoice.',
    rawTx: 'A ready-to-broadcast Bitcoin transaction that contains the outputs specified by the invoice. If the transaction is not already broadcast, it will be sent by the server.',
    inputs: 'Provide SPV proofs for each of the inputs to the BSV transaction. See the SPV Envelopes standard for details.',
    mapiResponses: 'Provide an array of mAPI responses for the transaction.',
    proof: 'If the payment transaction is already confirmed, just provide its merkle proof, omitting the inputs and mapiResponses fields.'
  },
  exampleResponse: {
    uploadURL: 'https://foo.com/...',
    publicURL: 'https://foo.com/cdn/...'
  },
  errors: [
    'ERR_NO_REF',
    'ERR_NO_TX',
    'ERR_BAD_REF',
    'ERR_ALREADY_PAID',
    'ERR_TX_NOT_FINAL',
    'ERR_BAD_TX',
    'ERR_TX_REJECTED',
    'ERR_INTERNAL'
  ],
  func: async (req, res) => {
    try {
      const {
        referenceNumber,
        rawTx: transactionHex,
        inputs,
        mapiResponses,
        proof
      } = req.body

      // Handle missing fields
      if (!referenceNumber) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_NO_REF',
          description:
          'Missing reference number. Please use /invoice to generate a reference number.'
        })
      }
      if (!transactionHex) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_NO_TX',
          description:
          'Provide a signed, ready-to-broadcast Bitcoin transaction paying for this file to be hosted.'
        })
      }

      const [transaction] = await knex('transaction').where({
        referenceNumber
      }).select(
        'fileId', 'amount', 'numberOfMinutesPurchased', 'txid', 'paid'
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

      const [file] = await knex('file')
        .select('fileSize', 'objectIdentifier')
        .where({ fileId: transaction.fileId })

      // Check that the transaction contains the reference number output
      const expectedScript = bsv
        .Script
        .buildSafeDataOut([referenceNumber])
        .toHex()
      let tx
      try {
        tx = new bsv.Transaction(transactionHex)
      } catch (e) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_BAD_TX',
          description: 'Unable to parse this Bitcoin transaction!'
        })
      }
      if (!tx.outputs.some((outputToTest, vout) => {
        try {
          if (
            outputToTest.script.toHex() === expectedScript &&
              outputToTest.satoshis === 0
          ) {
            return true
          } else {
            return false
          }
        } catch (e) {
          return false
        }
      })) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_TX_REJECTED',
          description: 'One or more outputs did not match what was requested by the invoice.'
        })
      }

      // Submit the payment to the Paymail server
      let txid, errorMessage
      try {
        const env = {
          rawTx: transactionHex,
          reference: referenceNumber,
          metadata: {
            note: `Payment from ${HOSTING_DOMAIN}, ${transaction.numberOfMinutesPurchased} minutes, ref. ${referenceNumber}`
          }
        }
        if (inputs) env.inputs = JSON.parse(inputs)
        if (mapiResponses) env.mapiResponses = JSON.parse(mapiResponses)
        if (proof) env.proof = JSON.parse(proof)
        const sent = await atfinder.submitSPVTransaction(SERVER_PAYMAIL, env)
        txid = sent.txid
      } catch (e) {
        // Info and not error, a user messed up and not us.
        console.info(e)
        if (e.response && e.response.data && e.response.data.description) {
          errorMessage = `${e.response.data.code}: ${e.response.data.description}`
        } else {
          errorMessage = e.message
        }
      }

      if (!txid) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_TX_REJECTED',
          description: `This transaction was rejected: ${errorMessage || 'The transaction does not contain the required outputs.'}`
        })
      }

      // Update the transaction with the payment status and txid
      await knex('transaction').where({
        referenceNumber
      }).update({
        txid,
        paid: true
      })

      const { uploadURL } = await getUploadURL({
        size: file.fileSize,
        objectIdentifier: file.objectIdentifier
      })

      // TODO need to advertise the UHRP URL after upload
      // await knex('transaction').where({ referenceNumber }).update({
      //   advertisementTXID: adTXID
      // })

      return res.status(200).json({
        uploadURL,
        publicURL: `${NODE_ENV === 'development' ? 'http' : 'https'}://${HOSTING_DOMAIN}${ROUTING_PREFIX || ''}/cdn/${file.objectIdentifier}`
      })
    } catch (e) {
      res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
      console.error(e)
      return null
    }
  }
}
