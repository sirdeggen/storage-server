import { bsv } from 'babbage-bsv'
import { Ninja } from 'ninja-base'
import { Authrite } from 'authrite-js'
import pushdrop from 'pushdrop'
import { getHashFromURL } from 'uhrp-url'

const {
  UHRP_HOST_PRIVATE_KEY,
  SERVER_PRIVATE_KEY,
  DOJO_URL
} = process.env

interface AdvertisementParams {
  hash: string | Buffer
  expiryTime: number
  url: string
  contentLength: number
  confederacyHost: string
}

interface AdvertisementResponse {
  txid: string
  reference: string
}

/**
 * Creates an advertisement for a particular hosted file presenting its UHRP.
 *
 * @param {Object} obj All parameters are given in an object.
 * @param {string} obj.hash The 32-byte SHA-256 hash of the file, the UHRP (can be a URL, which has to be converted).
 * @param {Number} obj.expiryTime UTC timestamp.
 * @param {string} obj.url The HTTPS URL where the content can be reached
 * @param {Number} obj.contentLength The length of the content in bytes
 * @param {string} obj.confederacyHost HTTPS Url for for the Confederacy host with default setting.

 * @returns {Promise<Object>} The transaction object, containing `txid` identifer and `reference` for the advertisement.
 */
const createUHRPAdvertisement = async ({
  hash,
  expiryTime,
  url,
  contentLength,
  confederacyHost = 'https://confederacy.babbage.systems'
}: AdvertisementParams): Promise<AdvertisementResponse> => {
  console.log('hash:', hash)
  console.log('expiryTime:', expiryTime)
  const ninja = new Ninja({
    privateKey: SERVER_PRIVATE_KEY,
    config: {
      dojoURL: DOJO_URL as string
    }
  })
  const key = bsv.PrivateKey.fromWIF(UHRP_HOST_PRIVATE_KEY)
  const address = key.toAddress().toString()

  // Make into a hash, as necessary
  if (typeof hash === 'string') {
    hash = getHashFromURL(hash)
  }
  console.log('hash:', hash)
  expiryTime = Math.floor(expiryTime / 1000)
  console.log('expiryTime:', expiryTime)

  const actionScript = await pushdrop.create({
    fields: [
      Buffer.from('1UHRPYnMHPuQ5Tgb3AF8JXqwKkmZVy5hG', 'utf8'),
      Buffer.from(address, 'utf8'),
      hash,
      Buffer.from('advertise', 'utf8'),
      Buffer.from(url, 'utf8'),
      Buffer.from('' + expiryTime, 'utf8'),
      Buffer.from('' + contentLength, 'utf8')
    ],
    key
  })

  const tx = await ninja.getTransactionWithOutputs({
    outputs: [{
      satoshis: 500,
      script: actionScript
    }],
    labels: [
      'nanostore'
    ],
    note: 'UHRP Confederacy Availability Advertisement',
    autoProcess: true
  })
  console.log('tx:', tx)

  try {
  // Submit the transaction to a Confederacy UHRP topic
    const response = await new Authrite({ clientPrivateKey: SERVER_PRIVATE_KEY }).request(`${confederacyHost}/submit`, {
      method: 'POST',
      body: {
        rawTx: tx.rawTx,
        inputs: tx.inputs,
        mapiResponses: tx.mapiResponses,
        topics: ['UHRP']
      }
    })
    const submitResult = JSON.parse(Buffer.from(response.body).toString('utf8'))

    // Check for any errors returned and create error to notify bugsnag.
    if (submitResult.status && submitResult.status === 'error') {
      throw new Error(`${submitResult.code || 'ERR_UNKNOWN'}: ${submitResult.description}`);
    }
  } catch (e) {
    console.error('Error sending UHRP tx to Confederacy host, ignoring...', e);
    if ((global as any).Bugsnag) (global as any).Bugsnag.notify(e);
  }
  return {
    txid: new bsv.Transaction(tx.rawTx).id,
    reference: tx.referenceNumber
  }
}

export default createUHRPAdvertisement