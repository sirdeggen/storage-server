import crypto from 'crypto'
import getPriceForFile from '../utils/getPriceForFile'
import { Request, Response } from 'express'
import knex, { Knex } from 'knex'
import knexConfig from '../../knexfile'
import { PrivateKey, Utils } from '@bsv/sdk'

const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY as string
const MIN_HOSTING_MINUTES = process.env.MIN_HOSTING_MINUTES
const HOSTING_DOMAIN = process.env.HOSTING_DOMAIN
const ROUTING_PREFIX = process.env.ROUTING_PREFIX
const NODE_ENV = process.env.NODE_ENV


const environment = (NODE_ENV as 'development' | 'staging' | 'production') || 'development';
const db: Knex = knex(knexConfig[environment]);

interface InvoiceRequest extends Request {
  body: {
    fileSize: number
    retentionPeriod: number
  }
  authrite: {
    identityKey: string
  }}

interface InvoiceResponse  {
  status: 'success' | 'error'
  message?: string
  identityKey?: string
  amount?: number
  ORDER_ID?: string
  publicURL?: string
  code?: string
  description?: string
}

const invoiceHandler = async (req: InvoiceRequest, res: Response<InvoiceResponse>) => {
  try {
    const { fileSize, retentionPeriod } = req.body
    // Handle missing fields
    if (!fileSize) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_NO_SIZE',
        description:
          'Provide the size of the file you want to host.'
      })
    }
    if (!retentionPeriod) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_NO_RETENTION_PERIOD',
        description:
          'Specify the number of minutes to host the file.'
      })
    }

    // File size must be a positive integer
    if (!Number.isInteger(Number(fileSize)) || fileSize <= 0) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_INVALID_SIZE',
        description:
          'The file size must be an integer.'
      })
    }

    // Retention period must be a positive integer more than the minimum
    const minHostingMinutes = Number(MIN_HOSTING_MINUTES) || 0
    if (
      !Number.isInteger(Number(retentionPeriod)) ||
      retentionPeriod < minHostingMinutes
    ) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_INVALID_RETENTION_PERIOD',
        description:
          `The retention period must be an integer and must be more than ${MIN_HOSTING_MINUTES} minutes`
      })
    }

    // Retention period must not be more than 69 million minutes
    if (retentionPeriod > 69000000) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_INVALID_RETENTION_PERIOD',
        description:
          'The retention period must be less than 69 million minutes (about 130 years)'
      })
    }

    // Current architecture should support up to about 11 gigabyte files
    // The bottleneck is in server-side hash calculation (the notifier.)
    // The notifier times out after 540 seconds, and hashing takes time.
    // If this changes, the limit should be re-evaluated.
    if (fileSize > 11000000000) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_INVALID_SIZE',
        description:
          'Currently, the maximum supported file size is 11000000000 bytes. Larger files will be supported in future versions, but consider breaking your file into chunks. Email nanostore-limits@babbage.systems if this causes you pain.'
      })
    }

    // Get the price that we will charge to host this file
    const amount = await getPriceForFile({ fileSize, retentionPeriod })

    // Insert a new file record and get the id
    const objectIdentifier = Utils.toBase58(Array.from(crypto.randomBytes(16)))
    // console.log('objectIdentifier:', objectIdentifier)
    await db('file').insert({
      fileSize,
      objectIdentifier
    })
    const file = await db('file').where({ objectIdentifier }).select('fileId').first()
    if (!file) {
      throw new Error('Failed to retrieve fileId after insertion.')
    }
    const fileId = file.fileId
    // console.log('fileId:', fileId)

    // Create a new transaction record
    const ORDER_ID = crypto.randomBytes(32).toString('base64')
    await db('transaction').insert({
      orderID: ORDER_ID,
      fileId,
      numberOfMinutesPurchased: retentionPeriod,
      referenceNumber: null, // TODO: change to reference
      amount,
      paid: false,
      identityKey: req.authrite.identityKey,
      created_at: new Date(),
      updated_at: new Date()
    })

    // Return the required info to the sender
    return res.status(200).json({
      status: 'success',
      message: 'Use /pay to submit the payment.',
      identityKey: PrivateKey.fromHex(SERVER_PRIVATE_KEY).toPublicKey.toString(), //POSSIBLE TODO? ERROR MAYBE...?
      amount,
      ORDER_ID,
      publicURL: `${HOSTING_DOMAIN}${ROUTING_PREFIX || ''}/cdn/${objectIdentifier}` // ${NODE_ENV === 'development' ? 'http' : 'https'}://
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({
      status: 'error',
      code: 'ERR_INTERNAL_PROCESSING_INVOICE',
      description: 'An internal error has occurred while processing invoice.'
    })
  }
}

export default {
  type: 'post',
  path: '/invoice',
  knex,
  summary: 'Use this route to create an invoice for the hosting of a file. The server will respond with an orderID. You will also receive the public URL where the file would be hosted if the invoice is paid.',
  parameters: {
    fileSize: 'Specify the size of the file you would like to host in bytes',
    retentionPeriod: 'Specify the whole number of minutes that you want the file to be hosted.'
  },
  exampleResponse: {
    status: 'success',
    identityKey: 'sdjlasldfj',
    message: 'Use /pay to submit the payment.',
    amount: 1337,
    ORDER_ID: 'asdfsdfsd=',
    publicURL: 'https://foo.com/bar.html'
  },
  errors: [
    'ERR_NO_SIZE',
    'ERR_NO_RETENTION_PERIOD',
    'ERR_INVALID_SIZE',
    'ERR_INVALID_RETENTION_PERIOD',
    'ERR_INTERNAL_PROCESSING_INVOICE'
  ],
  func: invoiceHandler
}
