const download = require('../download')
const mockKnex = require('mock-knex')

jest.mock('@google-cloud/storage')

const mockRes = {}
mockRes.status = jest.fn(() => mockRes)
mockRes.json = jest.fn(() => mockRes)
let queryTracker, validReq

/*

TODO: Find a way to mock Cloud Storage API, so that we can actually test the functionality here.
*/

describe('download', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(e => {
      throw e
    })
    mockKnex.mock(download.knex)
    queryTracker = require('mock-knex').getTracker()
    queryTracker.install()
    validReq = {
      params: {
        objectIdentifier: 'MOCK_OBJ_ID'
      }
    }
  })
  afterEach(() => {
    jest.clearAllMocks()
    queryTracker.uninstall()
    mockKnex.unmock(download.knex)
  })
  it('Queries for a file with the object id', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        expect(q.method).toEqual('select')
        expect(q.sql).toEqual(
          'select `mimeType`, `fileHash` from `file` where `objectIdentifier` = ? and `isAvailable` = ?'
        )
        expect(q.bindings).toEqual([
          'MOCK_OBJ_ID',
          true
        ])
        q.response([
          /* TODO: make things not break when this is un-commented
          {
          mimeType: 'image/png',
          hash: 'MOCK_HASH'
          }
          */
        ])
      }
    })
    await download.func(validReq, mockRes)
  })
  it('Returns error if file not found', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([])
      }
    })
    await download.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(404)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_NOT_FOUND'
    }))
  })
  it('Throws unknown errors', async () => {
    queryTracker.on('query', (q, s) => {
      throw new Error('Failed')
    })
    await expect(download.func(validReq, mockRes)).rejects.toThrow()
  })
})
