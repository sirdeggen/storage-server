const knex =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)

const getPriceForStorage = require('../utils/getPriceForStorage')
const generateRandomString = require('../utils/generateRandomString')

module.exports = {
  type: 'post',
  path: '/upload/invoice',
  knex,
  func: async (req, res) => {
    // Get the necessary fields
    // TODO: Need to figure out if we are dealing in seconds or ms
    const { file_name, file_size, file_hash, storage_time_in_seconds } = req.body
    if (!file_name || !file_size || !file_hash) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_MISSING_FIELDS',
        description: 'file_name, file_size, file_hash are required'
      })
    }

    // Get the price of the file
    const price = getPriceForStorage(file_size, )



    const 
  }
}

// After we generate reference number and
// library to check balance whatsonchain.com has a link for an api
//
