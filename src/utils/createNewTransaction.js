const bsv = require('bsv')
const crypto = require('crypto')

const { SERVER_XPUB } = process.env

module.exports = ({ fileId, amount, numberOfMinutesPurchased, knex }) => {
  return new Promise((resolve, reject) => {
    // This needs to be in a transaction to avoid conflicts
    knex.transaction(async trx => {
      try {
        // Find the highest derivation path
        const highestOutput = await trx('transaction')
          .orderBy('path', 'desc')
          .limit(1)
          .select('path')

        // Calculate the new child number and derive the child public key
        const newChildNumber = highestOutput.length === 0
          ? 0
          : highestOutput[0].path + 1
        const childPublicKey = bsv.HDPublicKey.fromString(SERVER_XPUB)
          .deriveChild(newChildNumber).publicKey
        const address = bsv.Address.fromPublicKey(childPublicKey)
        const outputScript = bsv.Script.fromAddress(address).toHex()

        const referenceNumber = bsv.deps.bs58.encode(crypto.randomBytes(16))
        await trx('transaction').insert({
          referenceNumber,
          fileId,
          amount,
          numberOfMinutesPurchased,
          path: newChildNumber
        })

        resolve({
          referenceNumber,
          outputs: [
            {
              outputScript,
              amount
            },
            {
              outputScript: bsv
                .Script
                .buildSafeDataOut([referenceNumber])
                .toHex(),
              amount: 0
            }
          ]
        })
      } catch (e) {
        reject(e)
      }
    })
  })
}
