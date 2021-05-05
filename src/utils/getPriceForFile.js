const axios = require('axios')
const { PRICE_PER_GB_MO } = process.env

// Calculate the number of satoshis to charge for the storage
module.exports = async ({ retentionPeriod, fileSize }) => {
  if (typeof PRICE_PER_GB_MO === 'undefined') {
    throw new Error('PRICE_PER_GB_MO is undefined')
  }

  // File size is in bytes, convert to gigabytes
  fileSize = fileSize / 1000000000

  // Retention period is in minutes, convert it to months
  retentionPeriod = retentionPeriod / (60 * 24 * 30)

  // Calculate the USD price
  const usdPrice = retentionPeriod * fileSize * PRICE_PER_GB_MO

  // Get the exchange rate
  let exchangeRate
  try {
    const { data } = await axios.get(
      'https://api.whatsonchain.com/v1/bsv/main/exchangerate'
    )
    if (typeof data !== 'object' || isNaN(data.rate)) {
      throw new Error('Invalid rate response')
    } else {
      exchangeRate = data.rate
    }
  } catch (e) {
    exchangeRate = 100
    console.error('Exchange rate failed, using 100', e)
  }

  // Exchange rate is in BSV, convert to satoshis
  exchangeRate = exchangeRate / 100000000

  // satoshis / dollars -> dollars / satoshis
  exchangeRate = 1 / exchangeRate

  // dollars * (dollars / satoshis) -> satoshis
  let satPrice = parseInt(usdPrice * exchangeRate)

  // Avoid dust outputs (which are smaller than 546 satoshis)
  // TODO: Find out from miners if they will accept anything smaller
  if (satPrice < 546) {
    satPrice = 546
  }

  return satPrice
}
