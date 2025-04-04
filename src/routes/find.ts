import { Request, Response } from 'express'
import { Storage } from '@google-cloud/storage'
import { getWallet } from '../utils/walletSingleton'

const storage = new Storage()
const { GCP_BUCKET_NAME } = process.env

interface FindRequest extends Request {
    query: {
        uhrpUrl?: string
    }
}

interface FindResponse {
    status: 'success' | 'error'
    data?: {
        name: string
        size: string
        mimeType: string
        expiryTime: number
    }
    code?: string
    description?: string
}

const findHandler = async (req: FindRequest, res: Response<FindResponse>) => {
    try {
        const { uhrpUrl } = req.query
        if (!uhrpUrl) {
            return res.status(400).json({
                status: 'error',
                code: 'ERR_NO_UHRP_URL',
                description: 'You must provide a uhrpUrl query parameter'
            })
        }

        const wallet = await getWallet()
        const { outputs } = await wallet.listOutputs({
            basket: 'uhrp advertisements',
            includeTags: true,
            limit: 200
        })

        let objectIdentifier: string | null = null
        for (const out of outputs) {
            if (!out.tags) continue

            const urlTag = out.tags.find(t => t.startsWith('uhrpUrl_'))
            if (!urlTag) continue
            
            const urlValue = urlTag.substring('uhrpUrl_'.length)
            if (urlValue === uhrpUrl) {
                const objectIdTag = out.tags.find(t => t.startsWith('objectIdentifier_'))
                if (!objectIdTag) continue

                objectIdentifier = objectIdTag.substring('objectIdentifier_'.length)
                break
            }
        }

        if (!objectIdentifier) {
            return res.status(404).json({
                status: 'error',
                code: 'ERR_NOT_FOUND',
                description: `No advertisement found for uhrpUrl ${uhrpUrl}`
            })
        }
        
        const file = storage.bucket(GCP_BUCKET_NAME!).file(`cdn/${objectIdentifier}`)
        const [metadata] = await file.getMetadata()

        const {
            name,
            size,
            contentType,
            customTime
        } = metadata

        let expiryTime = 0
        if (customTime) {
            expiryTime = Math.floor(new Date(customTime).getTime() / (1000 * 60))
        }

        return res.status(200).json({
            status: 'success',
            data: {
                name,
                size,
                mimeType: contentType || '',
                expiryTime
            }
        })
    } catch (error) {
        console.error('[findHandler] error:', error)
        return res.status(500).json({
            status: 'error',
            code: 'ERR_FIND',
            description: 'An error occurred while retrieving the file from uhrpUrl.'
        })
    }
}

export default {
    type: 'get',
    path: '/find',
    summary: 'Finds metadata for the file matching a given uhrpUrl',
    parameters: {
      uhrpUrl: 'The UHRP URL, e.g. ?uhrpUrl=uhrp://some-hash'
    },
    exampleResponse: {
      status: 'success',
      data: {
        name: 'cdn/abc123',
        size: '4096',
        mimeType: 'application/octet-stream',
        expiryTime: '2025-04-03T14:00:00Z'
      }
    },
    errors: ['ERR_NO_UHRP_URL', 'ERR_NOT_FOUND', 'ERR_FIND'],
    func: findHandler
  }