import { PushDrop, PrivateKey, Transaction, StorageUtils, Utils, WalletWireTransceiver, AtomicBEEF } from "@bsv/sdk"
import { wallet } from "./walletSingleton"

const
    UHRP_HOST_PRIVATE_KEY = process.env.UHRP_HOST_PRIVATE_KEY as string,
    SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY as string,
    STORAGE_URL = process.env.STORAGE_URL as string

export interface AdvertisementParams {
    hash: string | Buffer
    objectIdentifier: string
    expiryTime: number
    url: string
    contentLength: number
    confederacyHost?: string
}

export interface AdvertisementResponse {
    txid: string
    reference: string
}

export default async function createUHRPAdvertisement({
    hash,
    objectIdentifier,
    expiryTime,
    url,
    contentLength,
    confederacyHost = 'https://confederacy.babbage.systems'
}: AdvertisementParams): Promise<AdvertisementResponse> {
    if (typeof hash === 'string') {
        hash = StorageUtils.getHashFromURL(hash)
    }

    const expiryTimeSeconds = Math.floor(expiryTime / 1000)
    const key = PrivateKey.fromWif(UHRP_HOST_PRIVATE_KEY)
    const address = key.toAddress().toString()

    const fields: number[][] = [
        Utils.toArray('1UHRPYnMHPuQ5Tgb3AF8JXqwKkmZVy5hG', 'utf8'),
        Utils.toArray(address, 'utf8'),
        Array.isArray(hash) ? hash : Array.from(hash as Buffer),
        Utils.toArray('advertise', 'utf8'),
        Utils.toArray(url, 'utf8'),
        Utils.toArray(String(expiryTimeSeconds), 'utf8'),
        Utils.toArray(String(contentLength), 'utf8')
    ]

    const pushdrop = new PushDrop(wallet)
    
    const lockingScript = await pushdrop.lock(
        fields,
        [2, 'uhrp.confederacy'],
        'advertismentKey',
        'self'
    )

    const uhrpURL = StorageUtils.getURLForHash(hash as Buffer<ArrayBufferLike>)

    const createResult = await wallet.createAction({
        outputs: [{
            lockingScript: lockingScript.toHex(),
            satoshis: 500,
            outputDescription: 'UHRP Advertisement Output',
            tags: [`uhrp-url_${uhrpURL}`, `objectIdentifier_${objectIdentifier}`]
        }],
        description: 'UHRP Confederacy Availability Advertisement',
        options: {
            signAndProcess: false,
            noSend: true
        }
        
    })
    if (!createResult.signableTransaction?.reference) {
        throw new Error('No signable transaction returned from createAction')
    }

    const signResult = await wallet.signAction({
        reference: createResult.signableTransaction.reference,
        spends: {}
    })
    if (!signResult) {
        throw new Error('No signed transaction returned from signAction.')
    }

    const internalizeResult = await wallet.internalizeAction({
        tx: (signResult.tx as AtomicBEEF),
        outputs: [{
            outputIndex: 0,
            protocol: 'wallet payment'
        }],
        description: 'Broadcasting confederacy advertisement'
    })

    const rawTx = signResult.tx as AtomicBEEF
    const rawTxHex = Utils.toHex(rawTx)
    const transaction = Transaction.fromHex(rawTxHex)
    const txid = transaction.id('hex')

    return {
        txid,
        reference: createResult.signableTransaction.reference
    }
}