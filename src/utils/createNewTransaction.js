const bsv = require('bsv')
const atfinder = require('atfinder')

const { SERVER_PAYMAIL } = process.env

module.exports = async ({ fileId, amount, numberOfMinutesPurchased, knex }) => {
  const {
    outputs,
    reference,
    fee
  } = await atfinder.requestOutputsForP2PTransaction(SERVER_PAYMAIL)
  await knex('transaction').insert({
    referenceNumber: reference,
    fileId,
    amount,
    numberOfMinutesPurchased
  })

  return {
    referenceNumber: reference,
    outputs: [
      ...outputs.map(x => ({
        outputScript: x.script,
        amount: x.satoshis
      })),
      {
        outputScript: bsv
          .Script
          .buildSafeDataOut([reference])
          .toHex(),
        amount: 0
      }
    ],
    fee
  }
}
