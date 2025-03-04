import { Storage } from '@google-cloud/storage';
import createUHRPAdvertisement from '../utils/createUHRPAdvertisement';
import { Request, Response } from 'express';

const {
  ADMIN_TOKEN,
  NODE_ENV,
  ROUTING_PREFIX,
  HOSTING_DOMAIN,
  GCP_BUCKET_NAME
} = process.env

const storage = new Storage()

interface AdvertiseRequest extends Request {
  body: {
    adminToken: string
    fileHash: string
    objectIdentifier: string
    fileSize: number
    retentionPeriod: number
  }
}

interface AdvertiseResponse {
  status: 'success' | 'error';
  code?: string;
  description?: string;
}

const advertiseHandler = async (req: AdvertiseRequest, res: Response<AdvertiseResponse>) => {
  if (typeof ADMIN_TOKEN === 'string' && ADMIN_TOKEN.length > 10 && req.body.adminToken === ADMIN_TOKEN) {
    try {
      const expiryTime = Date.now() + req.body.retentionPeriod * 60 * 1000

      const storageFile = storage
        .bucket(GCP_BUCKET_NAME as string)
        .file(`cdn/${req.body.objectIdentifier}`)

      const { txid: adTXID } = await createUHRPAdvertisement({
        hash: req.body.fileHash,
        url: `${HOSTING_DOMAIN}${ROUTING_PREFIX}/cdn/${req.body.objectIdentifier}`,
        expiryTime,
        contentLength: req.body.fileSize,
        confederacyHost:
          NODE_ENV === 'development'
            ? 'http://localhost:3002'
            : NODE_ENV === 'staging'
              ? 'https://staging-confederacy.babbage.systems'
              : ''
      })

      await storageFile.setMetadata({
        customTime: new Date(expiryTime + 300 * 1000).toISOString()
      })

      res.status(200).json({ status: 'success' })
    } catch (error) {
      console.error('Error processing advertisement:', error)
      res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: 'An internal error occurred while processing the request.'
      })
    }
  } else {
    res.status(401).json({
      status: 'error',
      code: 'ERR_UNAUTHORIZED',
      description: 'Failed to advertise hosting commitment!'
    })
  }
}

export default {
  type: 'post',
  path: '/advertise',
  summary: 'Administrative endpoint to trigger UHRP advertisements when new files are uploaded.',
  parameters: {
    adminToken: 'Server admin token',
    fileHash: 'The UHRP hash to advertise',
    objectIdentifier: 'The ID of this contract',
    fileSize: 'The length of the file'
  },
  exampleResponse: { status: 'success' },
  errors: ['ERR_UNAUTHORIZED'],
  func: advertiseHandler
}