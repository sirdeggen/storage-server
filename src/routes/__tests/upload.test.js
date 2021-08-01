const upload = require('../upload')
const mockKnex = require('mock-knex')
const uploadSingleFile = require('../../utils/uploadSingleFile')
const bsv = require('bsv')
const atfinder = require('atfinder')

const { SERVER_PAYMAIL, HOSTING_DOMAIN } = process.env

jest.mock('../../utils/uploadSingleFile')
jest.mock('@google-cloud/storage')
jest.mock('atfinder')

const mockRes = {}
mockRes.status = jest.fn(() => mockRes)
mockRes.json = jest.fn(() => mockRes)
let queryTracker, validReq, validTx

describe('upload', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(e => {
      throw e
    })
    mockKnex.mock(upload.knex)
    queryTracker = require('mock-knex').getTracker()
    queryTracker.install()
    uploadSingleFile.mockReturnValue({
      adTXID: 'MOCK_AD_TXID',
      publicURL: 'MOCK_PUBLIC_URL',
      hash: 'MOCK_HASH'
    })

    // We need to actually create a transaction that will work.
    // mocking the "bsv" library would be another option.
    const dataOutputScript = bsv
      .Script
      .buildSafeDataOut(['MOCK_REFNO']) // From the transaction
      .toHex()
    const bsvtx = new bsv.Transaction()
    bsvtx.addOutput(new bsv.Transaction.Output({
      script: dataOutputScript,
      satoshis: 0
    }))
    // No need to actually sign
    // This only works because we are mocking a successful transaction broadcast with atfinder. In reality, while this passes our validation, the miners would never accept this transaction and so no one could actually do something like this.
    const txhex = bsvtx.uncheckedSerialize()
    atfinder.submitSPVTransaction.mockReturnValue({ txid: 'MOCK_TXID' })

    validReq = {
      file: {
        buffer: Buffer.from('hello', 'utf8'),
        size: 5
      },
      body: {
        transactionHex: txhex,
        referenceNumber: 'MOCK_REFNO',
        inputs: '{"mock":true}',
        mapiResponses: '[{"mock":true}]'
      }
    }
    validTx = {
      fileId: 'MOCK_FILE_ID',
      amount: 1337,
      numberOfMinutesPurchased: 90,
      txid: null,
      paid: false
    }
  })
  afterEach(() => {
    jest.clearAllMocks()
    queryTracker.uninstall()
    mockKnex.unmock(upload.knex)
  })
  it('Returns error if file is missing', async () => {
    delete validReq.file.buffer
    await upload.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_FILE_MISSING'
    }))
  })
  it('Returns error if referenceNumber is missing', async () => {
    delete validReq.body.referenceNumber
    await upload.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_NO_REF'
    }))
  })
  it('Returns error if transactionHex is missing', async () => {
    delete validReq.body.transactionHex
    await upload.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_NO_TX'
    }))
  })
  it('Queries for transactions with referenceNumber', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        expect(q.method).toEqual('select')
        expect(q.sql).toEqual(
          'select `fileId`, `amount`, `numberOfMinutesPurchased`, `txid`, `paid` from `transaction` where `referenceNumber` = ?'
        )
        expect(q.bindings).toEqual(['MOCK_REFNO'])
        q.response([validTx])
      } else if (s === 2) {
        q.response([{ fileSize: 5 }])
      } else if (s === 3) {
        q.response([])
      } else if (s === 4) {
        q.response([])
      }
    })
    await upload.func(validReq, mockRes)
  })
  it('Returns error if no transaction found', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([])
      } else if (s === 2) {
        q.response([{ fileSize: 5 }])
      } else if (s === 3) {
        q.response([])
      } else if (s === 4) {
        q.response([])
      }
    })
    await upload.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_BAD_REF'
    }))
  })
  it('Returns error if transaction already paid', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([{ ...validTx, paid: true, txid: 'MOCK_TXID' }])
      } else if (s === 2) {
        q.response([{ fileSize: 5 }])
      } else if (s === 3) {
        q.response([])
      } else if (s === 4) {
        q.response([])
      }
    })
    await upload.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_ALREADY_PAID',
      txid: 'MOCK_TXID'
    }))
  })
  it('Queries for file with the fileId', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([validTx])
      } else if (s === 2) {
        expect(q.method).toEqual('select')
        expect(q.sql).toEqual(
          'select `fileSize` from `file` where `fileId` = ?'
        )
        expect(q.bindings).toEqual(['MOCK_FILE_ID'])
        q.response([{ fileSize: 5 }])
      } else if (s === 3) {
        q.response([])
      } else if (s === 4) {
        q.response([])
      }
    })
    await upload.func(validReq, mockRes)
  })
  it('Returns error if file size is mismatched', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([validTx])
      } else if (s === 2) {
        q.response([{ fileSize: 7 }])
      } else if (s === 3) {
        q.response([])
      } else if (s === 4) {
        q.response([])
      }
    })
    await upload.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_SIZE_MISMATCH'
    }))
  })
  it('Returns error if transactionHex invalid', async () => {
    validReq.body.transactionHex = 'foo is a bar'
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([validTx])
      } else if (s === 2) {
        q.response([{ fileSize: 5 }])
      } else if (s === 3) {
        q.response([])
      } else if (s === 4) {
        q.response([])
      }
    })
    await upload.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_BAD_TX'
    }))
  })
  it('Returns error if transaction has no data output', async () => {
    const bsvtx = new bsv.Transaction()
    validReq.body.transactionHex = bsvtx.uncheckedSerialize()
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([validTx])
      } else if (s === 2) {
        q.response([{ fileSize: 5 }])
      } else if (s === 3) {
        q.response([])
      } else if (s === 4) {
        q.response([])
      }
    })
    await upload.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_TX_REJECTED'
    }))
  })
  it('Returns error if transaction has wrong data output script', async () => {
    const dataOutputScript = bsv
      .Script
      .buildSafeDataOut(['WRONG'])
      .toHex()
    const bsvtx = new bsv.Transaction()
    bsvtx.addOutput(new bsv.Transaction.Output({
      script: dataOutputScript,
      satoshis: 0
    }))
    validReq.body.transactionHex = bsvtx.uncheckedSerialize()
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([validTx])
      } else if (s === 2) {
        q.response([{ fileSize: 5 }])
      } else if (s === 3) {
        q.response([])
      } else if (s === 4) {
        q.response([])
      }
    })
    await upload.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_TX_REJECTED'
    }))
  })
  it('Returns error if submitting to atfinder fails', async () => {
    atfinder.submitSPVTransaction.mockReturnValueOnce('no')
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([validTx])
      } else if (s === 2) {
        q.response([{ fileSize: 5 }])
      } else if (s === 3) {
        q.response([])
      } else if (s === 4) {
        q.response([])
      }
    })
    await upload.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      code: 'ERR_TX_REJECTED',
      description: 'This transaction was rejected: The transaction does not contain the required outputs.'
    }))
    // Also check the call to atfinder
    expect(atfinder.submitSPVTransaction).toHaveBeenLastCalledWith(
      SERVER_PAYMAIL,
      {
        rawTx: validReq.body.transactionHex,
        inputs: { mock: true },
        mapiResponses: [{ mock: true }],
        reference: 'MOCK_REFNO',
        metadata: {
          note: `Payment from ${HOSTING_DOMAIN}, 90 minutes, ref. MOCK_REFNO`
        }
      }
    )
  })
  it('Updates transaction with new TXID and paid', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([validTx])
      } else if (s === 2) {
        q.response([{ fileSize: 5 }])
      } else if (s === 3) {
        expect(q.method).toEqual('update')
        expect(q.sql).toEqual(
          'update `transaction` set `txid` = ?, `paid` = ? where `referenceNumber` = ?'
        )
        expect(q.bindings).toEqual([
          expect.any(String),
          true,
          'MOCK_REFNO'
        ])
        q.response([])
      } else if (s === 4) {
        q.response([])
      }
    })
    await upload.func(validReq, mockRes)
  })
  it('Calls uploadSingleFile with correct parameters', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([validTx])
      } else if (s === 2) {
        q.response([{ fileSize: 5 }])
      } else if (s === 3) {
        q.response([])
      } else if (s === 4) {
        q.response([])
      }
    })
    await upload.func(validReq, mockRes)
    expect(uploadSingleFile).toHaveBeenCalledWith({
      fileId: 'MOCK_FILE_ID',
      file: {
        size: 5,
        buffer: Buffer.from('hello', 'utf8')
      },
      knex: upload.knex,
      numberOfMinutesPurchased: 90
    })
  })
  it('Updates the transaction with associated advertisement TXID', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([validTx])
      } else if (s === 2) {
        q.response([{ fileSize: 5 }])
      } else if (s === 3) {
        q.response([])
      } else if (s === 4) {
        expect(q.method).toEqual('update')
        expect(q.sql).toEqual(
          'update `transaction` set `advertisementTXID` = ? where `referenceNumber` = ?'
        )
        expect(q.bindings).toEqual([
          'MOCK_AD_TXID',
          'MOCK_REFNO'
        ])
        q.response([])
      }
    })
    await upload.func(validReq, mockRes)
  })
  it('Returns public URL and hash', async () => {
    queryTracker.on('query', (q, s) => {
      if (s === 1) {
        q.response([validTx])
      } else if (s === 2) {
        q.response([{ fileSize: 5 }])
      } else if (s === 3) {
        q.response([])
      } else if (s === 4) {
        q.response([])
      }
    })
    await upload.func(validReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      publicURL: 'MOCK_PUBLIC_URL',
      hash: 'MOCK_HASH',
      published: true
    }))
  })
  it('Throws unknown errors', async () => {
    queryTracker.on('query', (q, s) => {
      throw new Error('Failed')
    })
    await expect(upload.func(validReq, mockRes)).rejects.toThrow()
  })
})
