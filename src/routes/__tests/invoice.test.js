/* eslint-env jest */
const invoice = require('../invoice')
const mockKnex = require('mock-knex')
const getPriceForFile = require(
  '../../utils/getPriceForFile'
)
const createNewTransaction = require('../../utils/createNewTransaction')

const {
  MIN_HOSTING_MINUTES,
  HOSTING_DOMAIN,
  ROUTING_PREFIX
} = process.env

jest.mock('../../utils/getPriceForFile')
jest.mock('../../utils/createNewTransaction')

const mockRes = {}
mockRes.status = jest.fn(() => mockRes)
mockRes.json = jest.fn(() => mockRes)
let queryTracker, validReq

describe('invoice', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(e => {
      throw e
    })
    mockKnex.mock(invoice.knex)
    queryTracker = require('mock-knex').getTracker()
    queryTracker.install()
    getPriceForFile.mockReturnValue(1024)
    createNewTransaction.mockReturnValue({
      outputs: [
        { amount: 2250, outputScript: 'MOCK_OS_1' },
        { amount: 750, outputScript: 'MOCK_OS_2' }
      ],
      referenceNumber: 'MOCK_REFNO'
    })
    validReq = {
      body: {
        fileSize: 65000,
        retentionPeriod: 525600
      }
    }
  })
  afterEach(() => {
    jest.clearAllMocks()
    queryTracker.uninstall()
    mockKnex.unmock(invoice.knex)
  })
  it('Returns error if fileSize missing', async () => {
    delete validReq.body.fileSize
    await invoice.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_NO_SIZE'
    }))
  })
  it('Returns error if retentionPeriod missing', async () => {
    delete validReq.body.retentionPeriod
    await invoice.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_NO_RETENTION_PERIOD'
    }))
  })
  it('Returns error if fileSize is not an int', async () => {
    validReq.body.fileSize = -3.14
    await invoice.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_SIZE'
    }))
  })
  it('Returns error if retentionPeriod is invalid', async () => {
    validReq.body.retentionPeriod = 525600.1
    await invoice.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_RETENTION_PERIOD'
    }))
  })
  it('Returns error if retentionPeriod is under MIN_HOSTING_MINUTES', async () => {
    validReq.body.retentionPeriod = MIN_HOSTING_MINUTES - 1
    await invoice.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_RETENTION_PERIOD'
    }))
  })
  it('Returns error if retentionPeriod is over 130 years', async () => {
    validReq.body.retentionPeriod = 525600 * 140 // 140 years
    await invoice.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_INVALID_RETENTION_PERIOD'
    }))
  })
  it('Call getPriceForFile with correct parameters', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([])
      } else if (s === 2) {
        q.response([{ fileId: 'MOCK_FILE_ID' }])
      }
    })
    await invoice.func(validReq, mockRes)
    expect(getPriceForFile).toHaveBeenCalledWith({
      fileSize: 65000,
      retentionPeriod: 525600
    })
  })
  it('Inserts a new file record', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        expect(q.method).toEqual('insert')
        expect(q.sql).toEqual(
          'insert into `file` (`fileSize`, `objectIdentifier`) values (?, ?)'
        )
        expect(q.bindings).toEqual([
          65000,
          expect.any(String)
        ])
        q.response([])
      } else if (s === 2) {
        q.response([{ fileId: 'MOCK_FILE_ID' }])
      }
    })
    await invoice.func(validReq, mockRes)
  })
  it('Retrieves id of newly created record', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([])
      } else if (s === 2) {
        expect(q.method).toEqual('select')
        expect(q.sql).toEqual(
          'select `fileId` from `file` where `objectIdentifier` = ?'
        )
        expect(q.bindings).toEqual([expect.any(String)])
        q.response([{ fileId: 'MOCK_FILE_ID' }])
      }
    })
    await invoice.func(validReq, mockRes)
  })
  it('Call createNewTransaction with correct parameters', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([])
      } else if (s === 2) {
        q.response([{ fileId: 'MOCK_FILE_ID' }])
      }
    })
    await invoice.func(validReq, mockRes)
    expect(createNewTransaction).toHaveBeenCalledWith({
      fileId: 'MOCK_FILE_ID',
      numberOfMinutesPurchased: 525600,
      knex: invoice.knex,
      amount: 1024
    })
  })
  it('Returns successful response', async () => {
    let oid
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([])
        oid = q.bindings[1]
      } else if (s === 2) {
        q.response([{ fileId: 'MOCK_FILE_ID' }])
      }
    })
    await invoice.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith({
      referenceNumber: 'MOCK_REFNO',
      outputs: [
        { amount: 2250, outputScript: 'MOCK_OS_1' },
        { amount: 750, outputScript: 'MOCK_OS_2' }
      ],
      publicURL: `https://${HOSTING_DOMAIN}${ROUTING_PREFIX || ''}/file/${oid}`
    })
  })
  it('Throws unknown errors', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([])
      } else if (s === 2) {
        q.response([{ fileId: 'MOCK_FILE_ID' }])
      }
    })
    createNewTransaction.mockImplementation(() => {
      throw new Error('Failed')
    })
    await expect(invoice.func(validReq, mockRes)).rejects.toThrow(
      new Error('Failed')
    )
  })
})
