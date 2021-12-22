const knex =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)
const crypto = require('crypto')
const bsv = require('bsv')
const getPriceForFile = require('../utils/getPriceForFile')
const createNewTransaction = require('../utils/createNewTransaction')

const {
  MIN_HOSTING_MINUTES,
  HOSTING_DOMAIN,
  ROUTING_PREFIX,
  NODE_ENV
} = process.env

module.exports = {
  type: 'post',
  path: '/invoice',
  knex,
  summary: 'Use this route to create an invoice for the hosting of a file. The server will respond with a reference number and some Bitcoin transaction output scripts, which you should include in a transaction that pays the invoice. You will also receive the public URL where the file would be hosted if the invoice is paid.',
  parameters: {
    fileSize: 'Specify the size of the file you would like to host in bytes',
    retentionPeriod: 'Specify the whole number of minutes that you want the file to be hosted.'
  },
  exampleResponse: {
    referenceNumber: 'fjsodf+s/4Ssje==',
    outputs: [
      {
        amount: 1209,
        outputScript: '006a6d02...'
      },
      {
        amount: 1234,
        outputScript: '123456...'
      }
    ],
    publicURL: 'https://foo.com/file/sodfjWdifjsa'
  },
  errors: [
    'ERR_NO_SIZE',
    'ERR_NO_RETENTION_PERIOD',
    'ERR_INVALID_SIZE',
    'ERR_INVALID_RETENTION_PERIOD',
    'ERR_INTERNAL'
  ],
  func: async (req, res) => {
    try {
      const {
        fileSize,
        retentionPeriod
      } = req.body

      // Handle missing fields
      if (!fileSize) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_NO_SIZE',
          description:
            'Provide the size of the file you want to host.'
        })
      }
      if (!retentionPeriod) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_NO_RETENTION_PERIOD',
          description:
            'Specify the number of minutes to host the file.'
        })
      }

      // File size must be a positive integer
      if (!Number.isInteger(Number(fileSize)) || fileSize <= 0) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_SIZE',
          description:
            'The file size must be an integer.'
        })
      }

      // Retention period must be a positive integer more than the minimum
      if (
        !Number.isInteger(Number(retentionPeriod)) ||
        retentionPeriod < MIN_HOSTING_MINUTES
      ) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_RETENTION_PERIOD',
          description:
            `The retention period must be an integer and must be more than ${MIN_HOSTING_MINUTES} minutes`
        })
      }

      // Retention period must not be more than 69 million minutes
      if (retentionPeriod > 69000000) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_RETENTION_PERIOD',
          description:
            'The retention period must be less than 69 million minutes (about 130 years)'
        })
      }

      // Current architecture should support up to about 11 gigabyte files
      // The bottleneck is in server-side hash calculation (the notifier.)
      // The notifier times out after 540 seconds, and hashing takes time.
      // If this changes, the limit should be re-evaluated.
      if (fileSize > 11000000000) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_INVALID_SIZE',
          description:
            'Currently, the maximum supported file size is 11000000000 bytes. Larger files will be supported in future versions, but consider breaking your file into chunks. Email nanostore-limits@babbage.systems if this causes you pain.'
        })
      }

      // Get the price that we will charge to host this file
      const satPrice = await getPriceForFile({ fileSize, retentionPeriod })

      // Insert a new file record and get the id
      const objectIdentifier = bsv.deps.bs58.encode(crypto.randomBytes(16))
      await knex('file').insert({
        fileSize,
        objectIdentifier
      })
      let [fileId] = await knex('file').where({
        objectIdentifier
      }).select('fileId')
      fileId = fileId.fileId

      // Create a new transaction
      const { referenceNumber, outputs, fee } = await createNewTransaction({
        amount: satPrice,
        numberOfMinutesPurchased: retentionPeriod,
        fileId,
        knex
      })

      // Return the public URL, reference number and outputs
      res.status(200).json({
        referenceNumber,
        outputs,
        fee,
        publicURL: `${NODE_ENV === 'development' ? 'http' : 'https'}://${HOSTING_DOMAIN}${ROUTING_PREFIX || ''}/cdn/${objectIdentifier}`
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
