const remembrance = require('@cwi/remembrance')
const bsv = require('bsv')
const { getHashFromURL } = require('uhrp-url')

const { UHRP_HOST_PRIVATE_KEY } = process.env

module.exports = async ({ hash, url, expiryTime, contentLength }) => {
  hash = getHashFromURL(hash)
  hash = Uint8Array.from(hash)
  const key = bsv.PrivateKey.fromWIF(UHRP_HOST_PRIVATE_KEY)
  const address = key.toAddress().toString()
  expiryTime = parseInt(expiryTime / 1000)
  try {
    return remembrance({
      wif: UHRP_HOST_PRIVATE_KEY,
      data: [
        '1UHRPYnMHPuQ5Tgb3AF8JXqwKkmZVy5hG',
        address,
        hash,
        'advertise',
        url,
        '' + expiryTime,
        '' + contentLength
      ]
    })
  } catch (e) {
    throw new Error(
      `Address ${address} cannot broadcast UHRP advertisement! You should ensure that there are funds available in the address.`
    )
  }
}
