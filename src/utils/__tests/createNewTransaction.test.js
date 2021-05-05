// set up env before requiring
process.env.SERVER_XPUB = 'xpub661MyMwAqRbcF69UPxmbYrNDxAqpTsUN1nVGpSUwmAYnyPsXwBKmdV9UuxUCHdzJAmCQUtCwSADKQw7oxnAANtdiGcDKKzA6U2rLAyUtLKp'

const createNewTransaction = require('../createNewTransaction')
const mockKnex = require('mock-knex')
const knex =
  (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging')
    ? require('knex')(require('../../../knexfile.js').production)
    : require('knex')(require('../../../knexfile.js').development)
const bsv = require('bsv')

const mockRes = {}
mockRes.status = jest.fn(() => mockRes)
mockRes.json = jest.fn(() => mockRes)
let queryTracker, validInput

describe('createNewTransaction', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(e => {
      throw e
    })
    mockKnex.mock(knex)
    queryTracker = require('mock-knex').getTracker()
    queryTracker.install()
    validInput = {
      fileId: 'MOCK_FILE_ID',
      amount: 1337,
      numberOfMinutesPurchased: 90,
      knex
    }
  })
  afterEach(() => {
    jest.clearAllMocks()
    queryTracker.uninstall()
    mockKnex.unmock(knex)
  })
  it('Starts a knex transaction', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        expect(q.sql).toEqual('BEGIN;')
        expect(q.transacting).toEqual(true)
        q.response([])
      } else if (s === 2) {
        q.response([{ path: 16 }])
      } else if (s === 3) {
        q.response([])
      }
    })
    await createNewTransaction(validInput)
  })
  it('Queries for the highest output', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([])
      } else if (s === 2) {
        expect(q.method).toEqual('select')
        expect(q.sql).toEqual(
          'select `path` from `transaction` order by `path` desc limit ?'
        )
        expect(q.bindings).toEqual([1])
        q.response([{ path: 16 }])
      } else if (s === 3) {
        q.response([])
      }
    })
    await createNewTransaction(validInput)
  })
  it('Inserts a new transaction', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([])
      } else if (s === 2) {
        q.response([{ path: 16 }])
      } else if (s === 3) {
        expect(q.method).toEqual('insert')
        expect(q.sql).toEqual(
          'insert into `transaction` (`amount`, `fileId`, `numberOfMinutesPurchased`, `path`, `referenceNumber`) values (?, ?, ?, ?, ?)'
        )
        expect(q.bindings).toEqual([
          1337,
          'MOCK_FILE_ID',
          90,
          17,
          expect.any(String)
        ])
        q.response([])
      }
    })
    await createNewTransaction(validInput)
  })
  it('Inserts a new transaction with the first path', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([])
      } else if (s === 2) {
        q.response([])
      } else if (s === 3) {
        expect(q.method).toEqual('insert')
        expect(q.sql).toEqual(
          'insert into `transaction` (`amount`, `fileId`, `numberOfMinutesPurchased`, `path`, `referenceNumber`) values (?, ?, ?, ?, ?)'
        )
        expect(q.bindings).toEqual([
          1337,
          'MOCK_FILE_ID',
          90,
          0,
          expect.any(String)
        ])
        q.response([])
      }
    })
    await createNewTransaction(validInput)
  })
  it('Returns the correct values', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([])
      } else if (s === 2) {
        q.response([{ path: 16 }])
      } else if (s === 3) {
        q.response([])
      }
    })
    const returnValue = await createNewTransaction(validInput)
    const childPublicKey = bsv.HDPublicKey.fromString(process.env.SERVER_XPUB)
      .deriveChild(17).publicKey
    const address = bsv.Address.fromPublicKey(childPublicKey)
    const outputScript = bsv.Script.fromAddress(address).toHex()
    expect(returnValue).toEqual({
      referenceNumber: expect.any(String),
      outputs: [
        {
          outputScript,
          amount: 1337
        },
        {
          outputScript: bsv
            .Script
            .buildSafeDataOut([returnValue.referenceNumber])
            .toHex(),
          amount: 0
        }
      ]
    })
  })
})
