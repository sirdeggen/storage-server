// *** Not currently used? ***
const bsv = require('bsv')
const { getHashFromURL } = require('uhrp-url')
const {
  getTransactionWithOutputs,
  processOutgoingTransaction
} = require('utxoninja')
const bridgecast = require('bridgecast')

const { UHRP_HOST_PRIVATE_KEY, SERVER_XPRIV } = process.env

module.exports = async ({ hash, url, expiryTime, contentLength }) => {
  if (typeof hash === 'string') {
    hash = getHashFromURL(hash)
  }
  hash = Buffer.from(Uint8Array.from(hash).buffer)
  const key = bsv.PrivateKey.fromWIF(UHRP_HOST_PRIVATE_KEY)
  const address = key.toAddress().toString()
  expiryTime = parseInt(expiryTime / 1000)
  const tx = await getTransactionWithOutputs({
    xprivKey: SERVER_XPRIV,
    rPuzzleInputSigningWIF: UHRP_HOST_PRIVATE_KEY,
    outputs: [{
      script: bsv.Script.buildSafeDataOut([
        '1UHRPYnMHPuQ5Tgb3AF8JXqwKkmZVy5hG',
        address,
        hash,
        'advertise',
        url,
        '' + expiryTime,
        '' + contentLength
      ]).toHex(),
      satoshis: 0
    }]
  })
  const submitResult = await processOutgoingTransaction({
    submittedTransaction: tx.rawTx,
    note: 'UHRP Content Availability Advertisement',
    reference: tx.referenceNumber,
    xprivKey: SERVER_XPRIV
  })
  try {
    await bridgecast({
      bridges: ['1AJsUZ7MsJGwmkCZSoDpro28R52ptvGma7'], // UHRP
      tx: {
        rawTx: tx.rawTx,
        mapiResponses: submitResult.mapiResponses,
        inputs: tx.inputs
      }
    })
  } catch (e) {
    console.error('Error sending UHRP tx to Bridgecast, ignoring...', e)
  }
  return new bsv.Transaction(tx.rawTx).id
}
