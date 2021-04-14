const bsv = require('bsv')

const { UHRP_HOST_PRIVATE_KEY } = process.env

module.exports = async ({ hash, url, expiryTime }) => {
  const key = bsv.PrivateKey.fromWIF(UHRP_HOST_PRIVATE_KEY)
  const address = key.toAddress().toString()
  console.log(address, hash, url, expiryTime)
}
