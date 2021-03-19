const multer = require('multer')
const uploadSingleFile = require('../utils/media/uploadSingleFile')
const knex =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)

const multerMid = multer({
  storage: multer.memoryStorage()
})
const crypto = require('crypto')
const fs = require('fs')

module.exports = {
  type: 'post',
  path: '/upload/blob',
  knex,
  middleware: multerMid.single('file'),
  func: async (req, res) => {
    // Get needed fields
    const { reference_id } = req.body

    // Handle missing fields
    if (!reference_id) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_NO_REF',
        description:
          'Missing reference ID for file. Please use /upload/invoice to generate an invoid and a payment address'
      })
    }

    // Get file information from db with hash
    const fileData = await knex('file')
      .select()
      .where('reference_id', '=', reference_id)

    console.log('file data', fileData)

    // Get the file buffer to create a hash of the file
    const fileBuffer = req.file.buffer

    // Appropriate hash function
    const hashFunc = crypto.createHash('sha256')
    hashFunc.update(fileBuffer)

    // Get the hash of the file
    const hash = hashFunc.digest('hex')

    // G

    res.send('hello')
  }
}

// After we generate reference number and
// library to check balance whatsonchain.com has a link for an api
//
