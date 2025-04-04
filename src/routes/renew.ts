import { Request, Response } from 'express'
import { Storage } from '@google-cloud/storage'
import { getObjectIdentifier } from '../utils/getObjectIdentifier'
import getPriceForFile from '../utils/getPriceForFile'
import { getWallet } from '../utils/walletSingleton'
import { PushDrop, StorageUtils, Transaction, UnlockingScript, Utils } from '@bsv/sdk'

const storage = new Storage()
const GCP_BUCKET_NAME = process.env.GCP_BUCKET_NAME as string
const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY as string

interface RenewRequest extends Request {
    body: {
        uhrpUrl: string
        additionalMinutes: number
    }
}

interface RenewResponse {
    status: 'success' | 'error'
    newExpiryTime?: number
    prevExpiryTime?: number
    amount?: number
    code?: string
    description?: string
}

const renewHandler = async (req: RenewRequest, res: Response<RenewResponse>) => {
    try {
        const { uhrpUrl, additionalMinutes } = req.body
        if (!uhrpUrl || !additionalMinutes) {
            return res.status(400).json({
                status: 'error',
                code: 'ERR_MISSING_FIELDS',
                description: 'Missing objectIdentifier or additionalMinutes.'
            })
        }
        const objectIdentifier = getObjectIdentifier(uhrpUrl)
        if (!objectIdentifier) {
            return res.status(404).json({
                status: 'error',
                code: 'ERR_FILE_NOT_FOUND',
                description: `File\'s object idetifier was not found for uhrpUrl ${uhrpUrl}`
            })
        }


        const file = storage.bucket(GCP_BUCKET_NAME!).file(`cdn/${objectIdentifier}`)
        const [metadata] = await file.getMetadata()

        const prevExpiryTimeString = metadata.customTime || metadata.updated
        const prevExpiryTimeMs = new Date(prevExpiryTimeString).getTime()
        const prevExpiryTime = Math.floor(prevExpiryTimeMs / (1000 * 60))

        const newExpiryTime = prevExpiryTime + additionalMinutes
        const newExpiryTimeMS = newExpiryTime * 60 * 1000
        const newCustomTimeIso = new Date(newExpiryTimeMS).toISOString()

        let amount = 0
        const fileSize = parseInt(metadata.metadata?.fileSize, 10) || 0
        if (fileSize) {
            amount = await getPriceForFile({
                fileSize,
                retentionPeriod: additionalMinutes
            })
        }

        // Redeeming old advertisement token and replacing it with the new ones
        const wallet = await getWallet()
        const { outputs, BEEF } = await wallet.listOutputs({
            basket: 'uhrp advertisements',
            includeTags: true,
            include: 'entire transactions',
            limit: 200
        })

        const prevAdvertisement = outputs.find(o => {
            if (!o.tags) return false
            return (
                o.tags.includes(`uhrpUrl_${uhrpUrl}`) &&
                o.tags.includes(`objectIdentifier_${objectIdentifier}`)
            )
        })

        if (!prevAdvertisement) {
            return res.status(404).json({
                status: 'error',
                code: 'ERR_OLD_ADVERTISEMENT_NOT_FOUND',
                description: `Couldn't find old advertisement output for uhrpUrl ${uhrpUrl}`
            })
        }

        // Building the new action's locking script
        const newExpiryTimeSeconds = Math.floor(newExpiryTimeMS / 1000)
        const hash = StorageUtils.getHashFromURL(uhrpUrl)

        const fields: number[][] = [
            Utils.toArray(SERVER_PRIVATE_KEY, 'hex'),
            hash,
            Utils.toArray(uhrpUrl, 'utf8'),
            new Utils.Writer().writeVarIntNum(newExpiryTimeSeconds).toArray(),
            new Utils.Writer().writeVarIntNum(fileSize).toArray()
        ]

        const pushdrop = new PushDrop(wallet)
        const newLockingScript = await pushdrop.lock(
            fields,
            [2, 'uhrp advertisement'],
            '1',
            'anyone',
            true
        )

        // Creating new tags
        const newTags = []
        if (prevAdvertisement.tags) {
            const uploaderTag = prevAdvertisement.tags.find(t => t.startsWith('uploaderIdentityKey_'))
            if (uploaderTag) newTags.push(uploaderTag)
        }
        newTags.push(`uhrpUrl_${uhrpUrl}`)
        newTags.push(`objectIdentifier_${objectIdentifier}`)
        newTags.push(`expiryTime_${newExpiryTimeSeconds}`)

        await file.setMetadata({ customTime: newCustomTimeIso })

        const { signableTransaction } = await wallet.createAction({
            inputBEEF: BEEF,
            inputs: [
                {
                    outpoint: prevAdvertisement.outpoint,
                    unlockingScriptLength: 74,
                    inputDescription: 'Redeeming old advertisement'
                }

            ],
            outputs: [{
                lockingScript: newLockingScript.toHex(),
                satoshis: 1,
                basket: 'uhrp advertisements',
                outputDescription: 'UHRP advertisement token (renewed)',
                tags: newTags
            }],
            description: `Renew advertisement for uhrpUrl ${uhrpUrl}`
        })

        if (!signableTransaction) {
            return res.status(404).json({
                status: 'error',
                code: 'ERR_CREATE_ACTION_FAILED',
                description: `Old advertisement could not be redeemed and new advertisement could not be created for uhrpUrl ${uhrpUrl}`
            })
        }

        const unlocker = pushdrop.unlock([2, 'uhrp advertisement'], '1', 'anyone')
        const tx = Transaction.fromAtomicBEEF(signableTransaction.tx)
        const unlockingScript = await unlocker.sign(tx, 0)
        const { txid } = await wallet.signAction({
            reference: signableTransaction.reference,
            spends:
            {
                0: {
                    unlockingScript: unlockingScript.toHex()
                }
            }
        })
        if (!txid) {
            return res.status(200).json({
                status: 'error',
                code: 'ERR_SIGNING_OLD_ADVERTISEMENT'
            })
        }

        return res.status(200).json({
            status: 'success',
            prevExpiryTime,
            newExpiryTime,
            amount
        })
    } catch (error) {
        console.error('[renewHandler] error:', error)
        return res.status(500).json({
            status: 'error',
            code: 'ERR_INTERNAL_RENEW',
            description: 'An error occurred while handling the renewal.'
        })
    }
}

export default {
    type: 'post',
    path: '/renew',
    summary: 'Renews storage time by adding additionalMinutes to the GCS customTime of a file found by uhrpUrl.',
    parameters: {
        uhrpUrl: 'The UHRP URL (e.g. "uhrp://somehash")',
        additionalMinutes: 'Number of minutes to extend'
    },
    exampleResponse: {
        status: 'success',
        newExpiryTime: 28921659,
        prevExpiryTime: 28921599,
        amount: 42
    },
    errors: ['ERR_MISSING_FIELDS', 'ERR_NOT_FOUND', 'ERR_INTERNAL_RENEW'],
    func: renewHandler
}
