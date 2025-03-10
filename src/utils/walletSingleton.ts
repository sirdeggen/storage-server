import { WalletClient } from '@bsv/sdk'

let walletInstance: WalletClient | null = null

export function getWallet(): WalletClient {
    if (!walletInstance) {
        walletInstance = new WalletClient('json-api')
    }
    return walletInstance
}