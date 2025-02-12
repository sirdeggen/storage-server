"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const knex_1 = __importDefault(require("knex"));
const knexfile_1 = __importDefault(require("../../knexfile"));
const ninja_base_1 = require("ninja-base");
const getUploadURL_1 = __importDefault(require("../utils/getUploadURL"));
const { DOJO_URL, SERVER_PRIVATE_KEY, NODE_ENV, HOSTING_DOMAIN, ROUTING_PREFIX } = process.env;
const enviornment = NODE_ENV || 'development';
const db = (0, knex_1.default)(knexfile_1.default[enviornment]);
const payHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Find valid request transaction
        const transaction = yield db('transaction')
            .where({
            identityKey: req.authrite.identityKey,
            orderID: req.body.orderID
        })
            .first();
        // console.log('transaction:', transaction)
        if (!transaction) {
            return res.status(400).json({
                status: 'error',
                code: 'ERR_TRANSACTION_NOT_FOUND',
                description: 'A transaction for the specified request was not found!'
            });
        }
        if (transaction.paid) {
            return res.status(400).json({
                status: 'error',
                code: 'ERR_ALREADY_PAID',
                description: `The order id you have provided is attached to an invoice that was already paid and is for Order Id ${transaction.orderID}`,
                orderID: transaction.orderID
            });
        }
        if (!req.body.transaction.rawTx) {
            return res.status(400).json({
                status: 'error',
                code: 'ERR_INVALID_TRANSACTION',
                description: 'The transaction object must include rawTx.'
            });
        }
        req.body.transaction.outputs = req.body.transaction.outputs.map(x => (Object.assign(Object.assign({}, x), { senderIdentityKey: req.authrite.identityKey })));
        const ninja = new ninja_base_1.Ninja({
            privateKey: SERVER_PRIVATE_KEY,
            config: {
                dojoURL: DOJO_URL
            }
        });
        // Submit and verify the payment
        let processedTransaction;
        try {
            processedTransaction = yield ninja.submitDirectTransaction({
                protocol: '3241645161d8',
                transaction: req.body.transaction,
                senderIdentityKey: req.authrite.identityKey,
                note: `payment for orderID:${req.body.orderID}`,
                derivationPrefix: req.body.derivationPrefix,
                amount: transaction.amount
            });
        }
        catch (e) { // Propagate processing errors to the client
            if (!e.code)
                throw e;
            return res.status(400).json({
                status: 'error',
                code: e.code,
                description: e.message,
                outputIndex: e.outputIndex
            });
        }
        if (!processedTransaction) {
            return res.status(400).json({
                status: 'error',
                code: 'ERR_PAYMENT_INVALID',
                description: 'Could not validate payment!'
            });
        }
        // Update transaction
        yield db('transaction')
            .where({
            identityKey: req.authrite.identityKey,
            orderID: req.body.orderID,
            paid: false
        })
            .update({
            referenceNumber: processedTransaction.referenceNumber, // TODO change to referenceNumber to reference
            paid: true,
            updated_at: new Date()
        });
        const file = yield db('file')
            .select('fileSize', 'objectIdentifier')
            .where({ fileId: transaction.fileId })
            .first();
        if (!file) {
            return res.status(500).json({
                status: 'error',
                code: 'ERR_INTERNAL_PAYMENT_PROCESSING',
                description: 'Could not retrieve file details after processing payment.'
            });
        }
        const uploadURL = (0, getUploadURL_1.default)({
            size: file.fileSize,
            objectIdentifier: file.objectIdentifier
        }).toString();
        return res.status(200).json({
            uploadURL,
            publicURL: `${HOSTING_DOMAIN}${ROUTING_PREFIX || ''}/cdn/${file.objectIdentifier}`,
            status: 'success'
        });
    }
    catch (e) {
        console.error(e);
        if (global.Bugsnag)
            global.Bugsnag.notify(e);
        res.status(500).json({
            status: 'error',
            code: 'ERR_INTERNAL_PAYMENT_PROCESSING',
            description: 'An internal error has occurred.'
        });
    }
});
exports.default = {
    type: 'post',
    path: '/pay',
    knex: knex_1.default,
    summary: 'Use this route to pay an invoice and retrieve a URL to upload the data you want to host.',
    parameters: {
        orderID: 'xyz',
        transaction: 'transaction envelope (rawTx, mapiResponses, inputs, proof), with additional outputs array containing key derivation information',
        'transaction.outputs': 'An array of outputs descriptors, each including vout, satoshis, derivationPrefix(optional, if global not used), and derivationSuffix',
        derivationPrefix: 'Provide the global derivation prefix for the payment'
    },
    exampleResponse: {
        status: 'success',
        uploadURL: 'https://upload-server.com/file/new',
        publicURL: 'https://foo.com/bar.html'
    },
    errors: [
        'ERR_TRANSACTION_NOT_FOUND',
        'ERR_ALREADY_PAID',
        'ERR_TRANSACTION_AMOUNT_DIFFERENT_TO_RECEIVED_AMOUNT',
        'ERR_PAYMENT_INVALID',
        'ERR_INTERNAL_PAYMENT_PROCESSING'
    ],
    func: payHandler
};
