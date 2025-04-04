import { getWallet } from './walletSingleton'

/**
 * Fetches the objectIdentifier corresponding to a given uhrpUrl
 * by inspecting the "uhrp advertisements" basket outputs.
 *
 * @param {string} uhrpUrl - The UHRP URL to look for in tags (e.g. "uhrp://...").
 * @returns {Promise<string | null>} The objectIdentifier if found, or null if not found.
 */
export async function getObjectIdentifier(uhrpUrl: string): Promise<string | null> {
  const wallet = await getWallet()
  const { outputs } = await wallet.listOutputs({
    basket: 'uhrp advertisements',
    includeTags: true,
    limit: 200,
  })

  for (const out of outputs) {
    if (!out.tags) continue

    // Check for "uhrpUrl_..." tag
    const urlTag = out.tags.find(t => t.startsWith('uhrpUrl_'))
    if (!urlTag) continue

    const urlValue = urlTag.substring('uhrpUrl_'.length)
    if (urlValue === uhrpUrl) {
      // Found the matching uhrpUrl, now read objectIdentifier
      const objectIdTag = out.tags.find(t => t.startsWith('objectIdentifier_'))
      if (objectIdTag) {
        return objectIdTag.substring('objectIdentifier_'.length)
      }
    }
  }

  return null
}
