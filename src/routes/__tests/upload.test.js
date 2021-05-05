const upload = require('../upload')
const mockKnex = require('mock-knex')
const isFinal = require('bsv-is-final-tx')
const axios = require('axios')
const uploadSingleFile = require('../../utils/uploadSingleFile')
const bsv = require('bsv')

const { SERVER_XPUB } = process.env

jest.mock('bsv-is-final-tx')
jest.mock('axios')
jest.mock('../../utils/uploadSingleFile')
jest.mock('@google-cloud/storage')

const mockRes = {}
mockRes.status = jest.fn(() => mockRes)
mockRes.json = jest.fn(() => mockRes)
let queryTracker, validReq, validTx

describe('upload', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(e => {
      throw e
    })
    isFinal.mockReturnValue(true)
    mockKnex.mock(upload.knex)
    queryTracker = require('mock-knex').getTracker()
    queryTracker.install()
    axios.post.mockReturnValue({
      status: 400,
      data: '257: txn-already-known'
    })
    isFinal.mockReturnValue(true)
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
    const childPublicKey = bsv.HDPublicKey.fromString(SERVER_XPUB)
      .deriveChild(24).publicKey // "24" is the path from the transaction
    const address = bsv.Address.fromPublicKey(childPublicKey)
    const outputScript = bsv.Script.fromAddress(address).toHex()
    const bsvtx = new bsv.Transaction()
    bsvtx.addOutput(new bsv.Transaction.Output({
      script: dataOutputScript,
      satoshis: 0
    }))
    bsvtx.addOutput(new bsv.Transaction.Output({
      script: outputScript,
      satoshis: 1337 // From the file amount
    }))
    // No need to actually sign
    // This only works because we are mocking a successful transaction broadcast with axios. In reality, while this passes our validation, the miners would never accept this transaction and so no one could actually do something like this.
    const txhex = bsvtx.uncheckedSerialize()

    validReq = {
      file: {
        buffer: Buffer.from('hello', 'utf8'),
        size: 5
      },
      body: {
        transactionHex: txhex,
        referenceNumber: 'MOCK_REFNO'
      }
    }
    validTx = {
      fileId: 'MOCK_FILE_ID',
      amount: 1337,
      path: 24,
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
          'select `fileId`, `amount`, `path`, `numberOfMinutesPurchased`, `txid`, `paid` from `transaction` where `referenceNumber` = ?'
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
    const childPublicKey = bsv.HDPublicKey.fromString(SERVER_XPUB)
      .deriveChild(24).publicKey // "24" is the path from the transaction
    const address = bsv.Address.fromPublicKey(childPublicKey)
    const outputScript = bsv.Script.fromAddress(address).toHex()
    const bsvtx = new bsv.Transaction()
    bsvtx.addOutput(new bsv.Transaction.Output({
      script: outputScript,
      satoshis: 1337 // From the file amount
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
  it('Returns error if transaction has no payment output', async () => {
    const dataOutputScript = bsv
      .Script
      .buildSafeDataOut(['MOCK_REFNO']) // From the transaction
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
  it('Returns error if transaction has wrong data output script', async () => {
    const childPublicKey = bsv.HDPublicKey.fromString(SERVER_XPUB)
      .deriveChild(24).publicKey // "24" is the path from the transaction
    const address = bsv.Address.fromPublicKey(childPublicKey)
    const outputScript = bsv.Script.fromAddress(address).toHex()
    const dataOutputScript = bsv
      .Script
      .buildSafeDataOut(['WRONG'])
      .toHex()
    const bsvtx = new bsv.Transaction()
    bsvtx.addOutput(new bsv.Transaction.Output({
      script: dataOutputScript,
      satoshis: 0
    }))
    bsvtx.addOutput(new bsv.Transaction.Output({
      script: outputScript,
      satoshis: 1337 // From the file amount
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
  it('Returns error if transaction has wrong payment output script', async () => {
    const childPublicKey = bsv.HDPublicKey.fromString(SERVER_XPUB)
      .deriveChild(21).publicKey // using the wrong path
    const address = bsv.Address.fromPublicKey(childPublicKey)
    const outputScript = bsv.Script.fromAddress(address).toHex()
    const dataOutputScript = bsv
      .Script
      .buildSafeDataOut(['MOCK_REFNO'])
      .toHex()
    const bsvtx = new bsv.Transaction()
    bsvtx.addOutput(new bsv.Transaction.Output({
      script: dataOutputScript,
      satoshis: 0
    }))
    bsvtx.addOutput(new bsv.Transaction.Output({
      script: outputScript,
      satoshis: 1337 // From the file amount
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
  it('Returns error if transaction has wrong payment output amount', async () => {
    const childPublicKey = bsv.HDPublicKey.fromString(SERVER_XPUB)
      .deriveChild(24).publicKey
    const address = bsv.Address.fromPublicKey(childPublicKey)
    const outputScript = bsv.Script.fromAddress(address).toHex()
    const dataOutputScript = bsv
      .Script
      .buildSafeDataOut(['MOCK_REFNO'])
      .toHex()
    const bsvtx = new bsv.Transaction()
    bsvtx.addOutput(new bsv.Transaction.Output({
      script: dataOutputScript,
      satoshis: 0
    }))
    bsvtx.addOutput(new bsv.Transaction.Output({
      script: outputScript,
      satoshis: 580 // wrong amount
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
  it('Returns error if transaction not final', async () => {
    isFinal.mockReturnValue(false)
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
      code: 'ERR_TX_NOT_FINAL'
    }))
  })
  it('Returns error if broadcast fails', async () => {
    axios.post.mockReturnValue({
      status: 400,
      data: "ye didn' sign th' bloody thin ye fekin basterd"
    })
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
      description: "The Bitcoin network has rejected this transaction: ye didn' sign th' bloody thin ye fekin basterd"
    }))
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
