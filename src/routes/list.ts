import { Storage } from '@google-cloud/storage'
import { Request, Response } from 'express'
import { getWallet } from '../utils/walletSingleton'

interface ListRequest extends Request {
    auth: {
        identityKey: string
    }
}

interface ListResponse {
    status: 'success' | 'error'
    uploads?: Array<{
        uhrpUrl: string
        expiryTime: number
    }>
    code?: string
    description?: string
}

const listHandler = async (req: ListRequest, res: Response<ListResponse>) => {
    try {
        const identityKey = req.auth.identityKey
        const wallet = await getWallet()

        const { outputs } = await wallet.listOutputs({
            basket: 'uhrp advertisements', 
            includeTags: true,
            limit: 200
        })
        const result: ListResponse['uploads'] = []

        for (const out of outputs) {
            if (!out.tags) continue

            const uploaderTag = out.tags.find(t => t.startsWith('uploaderIdentityKey_'))
            if (!uploaderTag) continue

            const uploaderValue = uploaderTag.substring('uploaderIdentityKey_'.length, 10)
            
            if (uploaderValue === identityKey) {
                const uhrpUrlTag = out.tags.find(t => t.startsWith('uhrpUrl_'))
                const expiryTimeTag = out.tags.find(t => t.startsWith('expiryTime_'))

                const uhrpUrl = uhrpUrlTag
                ? uhrpUrlTag.substring('uhrpUrl_'.length)
                : ''

                const expiryTime = expiryTimeTag
                ? parseInt(expiryTimeTag.substring('expiryTime_'.length), 10)
                : 0

                result.push({
                    uhrpUrl,
                    expiryTime
                })
            }
        }
        
        return res.status(200).json({
            status: 'success',
            uploads: result
        })
    } catch (error) {
        console.error('[list] error:', error)
        return res.status(500).json({
            status: 'error',
            code: 'ERR_LIST',
            description: 'Error listing user-uploaded advertisements.'
        })
    }
}

export default {
    type: 'get',
    path: '/list',
    summary: 'Lists all UHRP files (advertisements) matching the user\'s identityKey in transaction tags.',
    parameters: {},
    exampleResponse: {
        status: 'success',
        uploads: [
            {
                
                uhrpUrl: 'uhrp://abcd1234...',
                expiryTime: 1691234567
            }
        ]
    },
    errors: ['ERR_LIST'],
    func: listHandler
}