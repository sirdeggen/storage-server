const bsv = require('bsv')
const Ninja = require('utxoninja')
const bridgecast = require('bridgecast')
const pushdrop = require('pushdrop')
const { getHashFromURL } = require('uhrp-url')

const {
  UHRP_HOST_PRIVATE_KEY,
  SERVER_PRIVATE_KEY,
  DOJO_URL,
  NODE_ENV
} = process.env

/**
 * Creates an advertisement for a particular hosted file presenting its UHRP.
 *
 * @param {Object} obj All parameters are given in an object.
 * @param {string} obj.hash The 32-byte SHA-256 hash of the file, the UHRP (can be a URL, which has to be converted).
 * @param {Number} obj.expiryTime UTC timestamp.
 * @param {string} obj.url The HTTPS URL where the content can be reached
 * @param {Number} obj.contentLength The length of the content in bytes
 *
 * @returns {Promise<Object>} The transaction object, containing `txid` identifer and `reference` for the advertisement.
 */
module.exports = async ({ hash, expiryTime, url, contentLength }) => {
  console.log('hash:', hash)
  console.log('expiryTime:', expiryTime)
  const ninja = new Ninja({
    privateKey: SERVER_PRIVATE_KEY,
    config: {
      dojoURL: DOJO_URL
    }
  })
  const key = bsv.PrivateKey.fromWIF(UHRP_HOST_PRIVATE_KEY)
  const address = key.toAddress().toString()

  // Make into a hash, as necessary
  if (typeof hash === 'string') {
    hash = getHashFromURL(hash)
  }
  console.log('hash:', hash)
  expiryTime = parseInt(expiryTime / 1000)
  console.log('expiryTime:', expiryTime)

  // TODO: Improve this.
  /*
   When we can spend UTXOs from specific output baskets with Dojo, and know which ones we are going to spend as input, we can generate the issuance ID without a preaction spend. The only purpose of the preaction spend is to move coins to a specific outpoint that can be spent and reference as the issuance ID for the pushDrop data structure.
  */
  // This moves some satoshis into a known place where they can be spent from.
  // This does not need to be notified with the bridge.
  const preactionScript = bsv.Script.buildPublicKeyOut(
    key.publicKey
  )
  const preactionAmount = 1000
  const preaction = await ninja.getTransactionWithOutputs({
    outputs: [{
      script: preactionScript.toHex(),
      satoshis: preactionAmount
    }],
    note: 'Prepare to advertise',
    autoProcess: true
  })
  console.log('preaction:', preaction)

  console.log('1', Buffer.from('1UHRPYnMHPuQ5Tgb3AF8JXqwKkmZVy5hG', 'utf8'))
  console.log('2', Buffer.from(`${preaction.txid}00000000`, 'hex'))
  console.log('3', Buffer.from(address, 'utf8'))
  console.log('4', hash)
  console.log('5', Buffer.from('advertise', 'utf8'))
  console.log('6', Buffer.from(url, 'utf8'))
  console.log('7', Buffer.from('' + expiryTime, 'utf8'))

  // Now that we can know the issuance ID, create the real action.
  const actionScript = await pushdrop.create({
    fields: [
      Buffer.from('1UHRPYnMHPuQ5Tgb3AF8JXqwKkmZVy5hG', 'utf8'),
      Buffer.from(`${preaction.txid}00000000`, 'hex'),
      Buffer.from(address, 'utf8'),
      hash,
      Buffer.from('advertise', 'utf8'),
      Buffer.from(url, 'utf8'),
      Buffer.from('' + expiryTime, 'utf8'),
      Buffer.from('' + contentLength, 'utf8')
    ],
    key
  })
  console.log('actionScript:', actionScript)

  const tx = await ninja.getTransactionWithOutputs({
    inputs: {
      [preaction.txid]: {
        ...preaction,
        outputsToRedeem: [{
          index: 0,
          unlockingScript: await pushdrop.redeem({
            prevTxId: preaction.txid,
            outputIndex: 0,
            outputAmount: preactionAmount,
            key,
            lockingScript: preactionScript.toHex()
          })
        }]
      }
    },
    outputs: [{
      satoshis: 500,
      script: actionScript
    }],
    note: 'UHRP Bridge Availability Advertisement',
    autoProcess: true
  })
  console.log('tx:', tx)

  try {
    const bridgeportResolvers =
        NODE_ENV === 'production'
          ? undefined
          : NODE_ENV === 'staging'
            ? ['https://staging-bridgeport.babbage.systems']
          : ['http://localhost:3103']
    console.log(bridgeportResolvers)
    await bridgecast({
      bridges: ['1AJsUZ7MsJGwmkCZSoDpro28R52ptvGma7'], // UHRP
      bridgeportResolvers,
      tx: {
        rawTx: tx.rawTx,
        mapiResponses: tx.mapiResponses,
        inputs: tx.inputs
      }
    })
  } catch (e) {
    console.error('Error sending UHRP tx to Bridgecast, ignoring...', e)
    if (global.Bugsnag) global.Bugsnag.notify(e)
  }
  return {
    txid: new bsv.Transaction(tx.rawTx).id,
    reference: tx.referenceNumber
  }
}
