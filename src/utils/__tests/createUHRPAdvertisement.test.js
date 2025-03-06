/* eslint-env jest */
// set up env vars before requiring
process.env.UHRP_HOST_PRIVATE_KEY = '5KU2L5qbkL5MPnUK1cuC5fWamjz7aoKCAZAbKdqmChed8TTbWCZ'

const remembrance = require('@cwi/remembrance')
import createUHRPAdvertisement from "../createUHRPAdvertisement"
import { getHashFromURL } from "@bsv/sdk"


jest.mock('@cwi/remembrance')
jest.mock('@bsv/sdk')
let valid

describe('createUHRPAdvertisement', () => {
  beforeEach(() => {
    getHashFromURL.mockReturnValue(require('crypto').randomBytes(32))
    remembrance.mockReturnValue('MOCK_RV')
    valid = {
      hash: 'MOCK_HASH',
      objectIdentifier: 'MOCK_IDENTIFIER',
      url: 'MOCK_HTTPS_URL',
      expiryTime: 1620253222257,
      contentLength: 'MOCK_LEN'
    }
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  it('Calls remembrance with correct data', async () => {
    await createUHRPAdvertisement(valid)
    expect(remembrance).toHaveBeenCalledWith({
      wif: process.env.UHRP_HOST_PRIVATE_KEY,
      data: [
        '1UHRPYnMHPuQ5Tgb3AF8JXqwKkmZVy5hG',
        '15fZmaM8etGtTBQ6m4fxopsP2f2tSb73P2',
        expect.any(Uint8Array),
        'advertise',
        'MOCK_HTTPS_URL',
        '1620253222',
        'MOCK_LEN'
      ]
    })
  })
  it('Returns the value from remembrance', async () => {
    const returnValue = await createUHRPAdvertisement(valid)
    expect(returnValue).toEqual('MOCK_RV')
  })
  it('Throws an error if broadcast fails', async () => {
    remembrance.mockImplementation(() => {
      throw new Error('Failed')
    })
    await expect(createUHRPAdvertisement(valid)).rejects.toThrow(new Error(
      'Address 15fZmaM8etGtTBQ6m4fxopsP2f2tSb73P2 cannot broadcast UHRP advertisement! You should ensure that there are funds available in the address.'
    ))
  })
})
