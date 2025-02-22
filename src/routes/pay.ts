import { Request, Response } from 'express' // ANY PLACE THAT USES A WALLET IS PROBABLY OBSOLETE
import knex, { Knex } from 'knex'
import knexConfig from '../../knexfile'
import { Ninja } from 'ninja-base'
import getUploadURL from '../utils/getUploadURL'

const {
  DOJO_URL,
  SERVER_PRIVATE_KEY,
  NODE_ENV,
  HOSTING_DOMAIN,
  ROUTING_PREFIX
} = process.env

const enviornment = (NODE_ENV as 'development' | 'staging' | 'production') || 'development'
const db: Knex = knex(knexConfig[enviornment])

interface TransactionOutput {
  vout: number
  satoshis: number
  derivationPrefix?: string
  derivationSuffix?: string
}

interface PayRequest extends Request {
  body: {
    orderID: string
    transaction: {
      rawTx: string
      mapiResponses?: any
      inputs?: any
      proof?: any
      outputs: TransactionOutput[]
    }
    derivationPrefix?: string
  }
  authrite: {
    identityKey: string
  }
}

interface PayResponse {
  status: 'success' | 'error'
  uploadURL?: string
  publicURL?: string
  code?: string
  description?: string
  orderID?: string
  outputIndex?: number
}

const payHandler = async (req: PayRequest, res: Response<PayResponse>) => {
  try {
    // Find valid request transaction
    const transaction = await db('transaction')
      .where({
        identityKey: req.authrite.identityKey,
        orderID: req.body.orderID
      })
      .first()
    // console.log('transaction:', transaction)
    if (!transaction) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_TRANSACTION_NOT_FOUND',
        description: 'A transaction for the specified request was not found!'
      })
    }
    if (transaction.paid) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_ALREADY_PAID',
        description: `The order id you have provided is attached to an invoice that was already paid and is for Order Id ${transaction.orderID}`,
        orderID: transaction.orderID
      })
    }
    if (!req.body.transaction.rawTx) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_INVALID_TRANSACTION',
        description: 'The transaction object must include rawTx.'
      })
    }
    req.body.transaction.outputs = req.body.transaction.outputs.map(x => ({
      ...x,
      senderIdentityKey: req.authrite.identityKey
    }))
    const ninja = new Ninja({
      privateKey: SERVER_PRIVATE_KEY,
      config: {
        dojoURL: DOJO_URL as string
      }
    })

    // Submit and verify the payment
    let processedTransaction
    try {
      processedTransaction = await ninja.submitDirectTransaction({
        protocol: '3241645161d8',
        transaction: req.body.transaction,
        senderIdentityKey: req.authrite.identityKey,
        note: `payment for orderID:${req.body.orderID}`,
        derivationPrefix: req.body.derivationPrefix,
        amount: transaction.amount
      })
    } catch (e: any) { // Propagate processing errors to the client
      if (!e.code) throw e
      return res.status(400).json({
        status: 'error',
        code: e.code,
        description: e.message,
        outputIndex: e.outputIndex
      })
    }
    if (!processedTransaction) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_PAYMENT_INVALID',
        description: 'Could not validate payment!'
      })
    }

    // Update transaction
    await db('transaction')
      .where({
        identityKey: req.authrite.identityKey,
        orderID: req.body.orderID,
        paid: false
      })
      .update({
        referenceNumber: processedTransaction.referenceNumber, // TODO change to referenceNumber to reference
        paid: true,
        updated_at: new Date()
      })
    const file = await db('file')
      .select('fileSize', 'objectIdentifier')
      .where({ fileId: transaction.fileId })
      .first()

    if (!file) {
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL_PAYMENT_PROCESSING',
        description: 'Could not retrieve file details after processing payment.'
      })
    }

    const uploadURL = getUploadURL({
      size: file.fileSize,
      objectIdentifier: file.objectIdentifier
    }).toString()

    return res.status(200).json({
      uploadURL,
      publicURL: `${HOSTING_DOMAIN}${ROUTING_PREFIX || ''}/cdn/${file.objectIdentifier}`,
      status: 'success'
    })
  } catch (e) {
    console.error(e)
    if ((global as any).Bugsnag) (global as any).Bugsnag.notify(e)
    res.status(500).json({
      status: 'error',
      code: 'ERR_INTERNAL_PAYMENT_PROCESSING',
      description: 'An internal error has occurred.'
    })
  }
}

export default {
  type: 'post',
  path: '/pay',
  knex,
  summary: 'Use this route to pay an invoice and retrieve a URL to upload the data you want to host.',
  parameters: {
    orderID: 'xyz',
    transaction: 'transaction envelope (rawTx, mapiResponses, inputs, proof), with additional outputs array containing key derivation information',
    'transaction.outputs': 'An array of outputs descriptors, each including vout, satoshis, derivationPrefix(optional, if global not used), and derivationSuffix',
    derivationPrefix: 'Provide the global derivation prefix for the payment'
  },
  exampleResponse: {
    status: 'success',
    uploadURL: 'https://upload-server.com/file/new',
    publicURL: 'https://foo.com/bar.html'
  },
  errors: [
    'ERR_TRANSACTION_NOT_FOUND',
    'ERR_ALREADY_PAID',
    'ERR_TRANSACTION_AMOUNT_DIFFERENT_TO_RECEIVED_AMOUNT',
    'ERR_PAYMENT_INVALID',
    'ERR_INTERNAL_PAYMENT_PROCESSING'
  ],
  func: payHandler
}