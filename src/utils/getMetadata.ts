// /utils/getMetadata.ts
import { Storage } from '@google-cloud/storage'
import { getWallet } from './walletSingleton'

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
export async function getMetadata(uhrpUrl: string): Promise<FileMetadata> {
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
            if (objectIdTag) {
                objectIdentifier = objectIdTag.substring('objectIdentifier_'.length)
                break
            }
        }
    }

    if (!objectIdentifier) {
        throw new Error(`No advertisement found for uhrpUrl: ${uhrpUrl}`)
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
