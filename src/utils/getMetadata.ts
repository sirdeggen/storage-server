// /utils/getMetadata.ts
import { Storage } from '@google-cloud/storage'
import { getWallet } from './walletSingleton'
import upload from '../routes/upload'

const storage = new Storage()
const { GCP_BUCKET_NAME } = process.env

interface FileMetadata {
    objectIdentifier: string
    name: string
    size: string
    contentType: string
    expiryTime: number  // minutes since the Unix epoch
}

/**
 * Finds the 'objectIdentifier' by scanning the 'uhrp advertisements' basket
 * for a matching `uhrpUrl_{uhrpUrl}` tag, then fetches GCS metadata.
 *
 * @param uhrpUrl The UHRP URL
 * @returns {Promise<FileMetadata>} An object containing file info.
 * @throws If no matching advertisement is found or GCS metadata fails.
 */
export async function getMetadata(uhrpUrl: string, uploaderIdentityKey: string, limit?: number, offset?: number): Promise<FileMetadata> {
    const wallet = await getWallet()
    const { outputs } = await wallet.listOutputs({
        basket: 'uhrp advertisements',
        tags: [`uhrpUrl_${uhrpUrl}`, `uploaderIdentityKey_${uploaderIdentityKey}`],
        tagQueryMode: 'all',
        includeTags: true,
        limit: limit !== undefined ? limit : 200,
        offset: offset !== undefined ? offset : 0
    })

    let objectIdentifier
    let maxpiry = 0
    // Finding the identifier for the file with the maxpiry date
    for (const out of outputs) {
        if (!out.tags) continue
        const objectIdTag = out.tags.find(t => t.startsWith('objectIdentifier_'))
        const expiryTag = out.tags.find(t => t.startsWith('expiryTime_'))
        if (!objectIdTag || !expiryTag) continue
        
        const expiryNum = parseInt(expiryTag.substring('expiryTime_'.length), 10) || 0
        
        if (expiryNum > maxpiry) {
            maxpiry = expiryNum
            objectIdentifier = objectIdTag.substring('objectIdentifier_'.length)
        }
    }

    if (!objectIdentifier) {
        throw new Error(`No advertisement found for uhrpUrl: ${uhrpUrl} uploaderIdentityKey: ${uploaderIdentityKey}`)
    }

    // Fetch GCS metadata
    const file = storage.bucket(GCP_BUCKET_NAME!).file(`cdn/${objectIdentifier}`)
    const [gcsMetadata] = await file.getMetadata()

    const {
        name,
        size,
        contentType = '',
        customTime
    } = gcsMetadata

    let expiryTime = 0
    if (customTime) {
        // Convert to minutes
        expiryTime = Math.floor(new Date(customTime).getTime() / (1000 * 60))
    } else {
        // If no customTime is set, fallback to "updated"
        const updated = new Date(gcsMetadata.updated).getTime()
        expiryTime = Math.floor(updated / (1000 * 60))
    }

    return {
        objectIdentifier,
        name,
        size,
        contentType,
        expiryTime
    }
}
