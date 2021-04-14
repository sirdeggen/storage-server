const axios = require('axios')
const { PRICE_PER_GB_MO } = process.env

// Calculate the number of satoshis to charge for the storage
module.exports = async ({ retentionPeriod, fileSize }) => {
  // File size is in bytes, convert to gigabytes
  fileSize = fileSize / 1000000000

  // Retention period is in minutes, convert it to months
  retentionPeriod = retentionPeriod / (60 * 24 * 30)

  // Calculate the USD price
  const usdPrice = retentionPeriod * fileSize * PRICE_PER_GB_MO

  // Get the exchange rate
  let { data: exchangeRate } = await axios.get(
    'https://api.whatsonchain.com/v1/bsv/main/exchangerate'
  )
  if (typeof exchangeRate !== 'object' || isNaN(exchangeRate.rate)) {
    console.error('Exchange rate failed, using 100')
    exchangeRate = 100
  } else {
    exchangeRate = exchangeRate.rate
  }

  // Exchange rate is in BSV, convert to satoshis
  exchangeRate = exchangeRate / 100000000

  let satPrice = parseInt(usdPrice * (1 / exchangeRate))

  // Avoid outputs smaller than 600 satoshis
  if (satPrice < 600) {
    satPrice = 600
  }

  return satPrice
}
