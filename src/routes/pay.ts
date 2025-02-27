import { Request, Response } from 'express'
import knex, { Knex } from 'knex'
import knexConfig from '../../knexfile'
import getUploadURL from '../utils/getUploadURL'

const {
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
}

const payHandler = async (req: PayRequest, res: Response<PayResponse>) => {
    try {
        const transaction = await db('transaction')
            .where({
                identityKey: req.authrite.identityKey,
                orederID: req.body.orderID
            })
            .first()

        if (!transaction) {
            return res.status(400).json({
                status: 'error',
                code: 'ERR_TRANSACTION_NOT_FOUND',
                description: 'No record found for the specified orderID and identityKey.'
            })
        }
        if (transaction.paid) {
            return res.status(400).json({
                status: 'error',
                code: 'ERR_ALREADY_PAID',
                description: `This invoice/order is already paid.`,
                orderID: transaction.orderID
            })
        }

        const file = await db('file')
            .select('fileSize', 'objectIdentifier')
            .where({ fileId: transaction.fileID })
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
            status: 'success',
            uploadURL,
            publicURL: `${HOSTING_DOMAIN}${ROUTING_PREFIX || ''} /cdn/${file.objectIdentifier}`
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
    summary: 'Pay an invoice and retrieve a URL to upload the data you want to host, (no wallet logic here).',
    parameters: {
      orderID: 'xyz',
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
      'ERR_PAYMENT_INVALID',
      'ERR_INTERNAL_PAYMENT_PROCESSING'
    ],
    func: payHandler
  }