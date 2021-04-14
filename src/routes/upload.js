const multer = require('multer')
const uploadSingleFile = require('../utils/uploadSingleFile')
const knex =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)

const multerMid = multer({
  storage: multer.memoryStorage()
})

module.exports = {
  type: 'post',
  path: '/upload',
  knex,
  middleware: multerMid.single('file'),
  func: async (req, res) => {
    // Ensure a file was provided
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_FILE_MISSING',
        description: 'The file is missing.'
      })
    }
    console.log(req.file)

    const {
      referenceNumber,
      transactionHex,
      inputProofs
    } = req.body

    // // Handle missing fields
    // if (!referenceNumber) {
    //   return res.status(400).json({
    //     status: 'error',
    //     code: 'ERR_NO_REF',
    //     description:
    //       'Missing reference number. Please use /invoice to generate a reference number.'
    //   })
    // }
    // if (!transactionHex) {
    //   return res.status(400).json({
    //     status: 'error',
    //     code: 'ERR_NO_TX',
    //     description:
    //       'Provide a signed, ready-to-broadcast Bitcoin transaction paying for this file to be hosted.'
    //   })
    // }
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

    uploadSingleFile({
      file: req.file,
      fileId: transaction.fileId,
      numberOfMinutesPurchased: transaction.numberOfMinutesPurchased,
      knex
    })
  }
}
