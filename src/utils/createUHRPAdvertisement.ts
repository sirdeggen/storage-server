import { PushDrop, PrivateKey, Transaction, StorageUtils, Utils, AtomicBEEF, SHIPBroadcaster } from "@bsv/sdk"
import { getWallet } from "./walletSingleton"

const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY as string
const BSV_NETWORK = process.env.BSV_NETWORK as 'mainnet' | 'testnet'

export interface AdvertisementParams {
    hash: number[]
    objectIdentifier: string
    expiryTime: number
    url: string
    contentLength: number
    confederacyHost?: string
}

export interface AdvertisementResponse {
    txid: string
}

export default async function createUHRPAdvertisement({
    hash,
    objectIdentifier,
    expiryTime,
    url,
    contentLength
}: AdvertisementParams): Promise<AdvertisementResponse> {
    if (typeof hash === 'string') {
        hash = StorageUtils.getHashFromURL(hash)
    }

    const expiryTimeSeconds = Math.floor(expiryTime / 1000)
    const key = PrivateKey.fromHex(SERVER_PRIVATE_KEY)
    const serverPublicKey = key.toPublicKey().toString()

    // Comply with the UHRP Protocol
    const fields: number[][] = [
        // The identity key of the storage host
        Utils.toArray(serverPublicKey, 'hex'),
        // The hash of what they are hosting
        hash,
        // The URL where it can be found
        Utils.toArray(url, 'utf8'),
        // The UTC timestamp in seconds from 1970 as VarInt
        new Utils.Writer().writeVarIntNum(expiryTimeSeconds).toArray(),
        // The content length as VarInt
        new Utils.Writer().writeVarIntNum(contentLength).toArray()
    ]
    console.log('fields', fields)

    const wallet = await getWallet()
    const pushdrop = new PushDrop(wallet)

    const lockingScript = await pushdrop.lock(
        fields,
        [2, 'uhrp advertisement'],
        '1',
        'anyone',
        true
    )

    const uhrpURL = StorageUtils.getURLForHash(hash)

    const createResult = await wallet.createAction({
        outputs: [{
            lockingScript: lockingScript.toHex(),
            satoshis: 1,
            outputDescription: 'UHRP advertisement token',
            tags: [`uhrp-url_${uhrpURL}`, `objectIdentifier_${objectIdentifier}`]
        }],
        description: 'UHRP Content Availability Advertisement'
    })
    const transaction = Transaction.fromAtomicBEEF(createResult.tx!)
    const txid = transaction.id('hex')
    const broadcaster = new SHIPBroadcaster(['tm_uhrp'], {
        networkPreset: BSV_NETWORK
    })
    await broadcaster.broadcast(transaction)

    return {
        txid
    }
}