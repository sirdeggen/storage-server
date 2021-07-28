const multer = require('multer')
const uploadSingleFile = require('../utils/uploadSingleFile')
const knex =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)
const bsv = require('bsv')
const atfinder = require('atfinder')

const { SERVER_PAYMAIL, HOSTING_DOMAIN } = process.env

const multerMid = multer({
  storage: multer.memoryStorage()
})

module.exports = {
  type: 'post',
  path: '/upload',
  knex,
  summary: 'Use this route to pay an invoice and upload the data you want to host. You should specify the file in a multipart/form-data payload. You will receive back the public URL, the hash (UHRP URL) of the published file, and "published=true" if the upload was successful.',
  parameters: {
    referenceNumber: 'The reference number you received when you created the invoice.',
    file: 'The file, which should be of the size specified by the invoice.',
    transactionHex: 'A ready-to-broadcast Bitcoin transaction that contains the outputs specified by the invoice. If the transaction is not already broadcasted, it will be sent by the server.',
    inputs: 'Provide SPV proofs for each of the inputs to the BSV transaction. See the SPV Envelopes standard for details.',
    mapiResponses: 'Provide an array of mAPI responses for the transaction.',
    proof: 'If the payment transaction is already confirmed, just provide its merkle proof, omitting the inputs and mapiResponses fields.'
  },
  exampleResponse: {
    published: true,
    publicURL: 'https://foo.com/file/sodfjWdifjsa',
    hash: 'XUT...'
  },
  errors: [
    'ERR_FILE_MISSING',
    'ERR_NO_REF',
    'ERR_NO_TX',
    'ERR_BAD_REF',
    'ERR_ALREADY_PAID',
    'ERR_TX_NOT_FINAL',
    'ERR_BAD_TX',
    'ERR_TX_REJECTED',
    'ERR_SIZE_MISMATCH',
    'ERR_INTERNAL'
  ],
  middleware: multerMid.single('file'),
  func: async (req, res) => {
    try {
    // Ensure a file was provided
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_FILE_MISSING',
          description: 'The file is missing.'
        })
      }

      const {
        referenceNumber,
        transactionHex,
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

      const [file] = await knex('file').select('fileSize').where({
        fileId: transaction.fileId
      })

      // Validate the length of the file uploaded is the same as the length invoiced for
      if (file.fileSize !== req.file.size) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_SIZE_MISMATCH',
          description: 'The size of the file uploaded does not match the size specified in the invoice.'
        })
      }

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
        const sent = await atfinder.submitSPVTransaction(SERVER_PAYMAIL, {
          rawTx: transactionHex,
          reference: referenceNumber,
          inputs,
          proof,
          mapiResponses,
          metadata: {
            note: `Payment from ${HOSTING_DOMAIN}, ${transaction.numberOfMinutesPurchased} minutes, ref. ${referenceNumber}`
          }
        })
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

      const { adTXID, publicURL, hash } = await uploadSingleFile({
        file: req.file,
        fileId: transaction.fileId,
        numberOfMinutesPurchased: transaction.numberOfMinutesPurchased,
        knex
      })

      await knex('transaction').where({ referenceNumber }).update({
        advertisementTXID: adTXID
      })

      return res.status(200).json({
        publicURL,
        hash,
        published: true
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
