const multer = require('multer')
const uploadSingleFile = require('../utils/uploadSingleFile')
const knex =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)
const bsv = require('bsv')
const axios = require('axios')
const isFinal = require('bsv-is-final-tx')

const { SERVER_XPUB } = process.env

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
    inputProofs: 'This is not currently required, but in the future, you will need to provide an array of SPV proofs for each of the inputs to the BSV transaction.'
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
        transactionHex
      // inputProofs
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
      // if (!inputProofs || !Array.isArray(inputProofs)) {
      //   return res.status(400).json({
      //     status: 'error',
      //     code: 'ERR_NO_PROOFS',
      //     description:
      //       'Missing SPV proofs. Provide an array of SPV proofs for each of the inputs to the transaction.'
      //   })
      // }

      const [transaction] = await knex('transaction').where({
        referenceNumber
      }).select(
        'fileId', 'amount', 'path', 'numberOfMinutesPurchased', 'txid', 'paid'
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

      // Validate that the transaction contains the required outputs
      const expectedOutputs = []
      expectedOutputs.push({
        outputScript: bsv
          .Script
          .buildSafeDataOut([referenceNumber])
          .toHex(),
        amount: 0
      })
      const childPublicKey = bsv.HDPublicKey.fromString(SERVER_XPUB)
        .deriveChild(transaction.path).publicKey
      const address = bsv.Address.fromPublicKey(childPublicKey)
      const outputScript = bsv.Script.fromAddress(address).toHex()
      expectedOutputs.push({ outputScript, amount: transaction.amount })
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

      // For every one of the required outputs
      for (let i = 0; i < expectedOutputs.length; i++) {
      // Ensure that some output in this transaction meets the requirements of expectedOutputs[i], including script matching and amount
        if (!tx.outputs.some((outputToTest, vout) => {
          try {
            if (
              outputToTest.script.toHex() === expectedOutputs[i].outputScript &&
              outputToTest.satoshis === expectedOutputs[i].amount
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
      }

      // Check that the transaction is final
      if (!isFinal(tx)) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_TX_NOT_FINAL',
          description: 'This transaction is not final. Ensure that the transaction meets the rules for being finalized which can be found at https://wiki.bitcoinsv.io/index.php/NLocktime_and_nSequence'
        })
      }

      // Broadcast the transaction, obtaining positive validation from miners
      let broadcastResult
      try {
        broadcastResult = await axios.post(
          'https://api.whatsonchain.com/v1/bsv/main/tx/raw',
          { txhex: transactionHex }
        )
      } catch (e) {
        if (e.response && e.response.data && e.response.status) {
          broadcastResult = {
            data: e.response.data,
            status: e.response.status
          }
        } else {
          throw e
        }
      }

      if (!( // If not (200 or already known), reject transaction and log
        (
          broadcastResult.status === 200 &&
            broadcastResult.data &&
            broadcastResult.data.length === 64
        ) || (
          broadcastResult.status === 400 &&
            broadcastResult.data === '257: txn-already-known'
        ) || (
          broadcastResult.status === 400 &&
            broadcastResult.data === 'Transaction already in the mempool'
        )
      )) {
        console.log(
          `Marking TX as rejected for HTTP status ${broadcastResult.status} and response ${broadcastResult.data}`
        )
        return res.status(400).json({
          status: 'error',
          code: 'ERR_TX_REJECTED',
          description: `The Bitcoin network has rejected this transaction: ${broadcastResult.data}`
        })
      }

      // Calculate the TXID of the transaction
      // (sometimes it will be in broadcastResult.body, but not if the transaction was already known)
      const broadcastedTXID = tx.hash

      // Update the transaction with the payment statu and txid
      await knex('transaction').where({
        referenceNumber
      }).update({
        txid: broadcastedTXID,
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
      console.error(e)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error has occurred.'
      })
    }
  }
}
