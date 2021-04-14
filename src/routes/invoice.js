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
  ROUTING_PREFIX
} = process.env

module.exports = {
  type: 'post',
  path: '/invoice',
  knex,
  func: async (req, res) => {
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
        code: 'ERR_INVALID_SIZE',
        description:
          `The retention period must be an integer and must be more than ${MIN_HOSTING_MINUTES} minutes`
      })
    }

    // Retention period must not be more than 69 million minutes
    if (retentionPeriod > 69000000) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_INVALID_SIZE',
        description:
          'The retention period must be less than 69 million minutes (about 130 years)'
      })
    }

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
    const { referenceNumber, outputs } = await createNewTransaction({
      amount: satPrice,
      numberOfMinutesPurchased: retentionPeriod,
      fileId,
      knex
    })

    res.status(200).json({
      referenceNumber,
      outputs,
      publicURL: `https://${HOSTING_DOMAIN}${ROUTING_PREFIX || ''}/${objectIdentifier}`
    })
  }
}
