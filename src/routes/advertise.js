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
const storage_1 = require("@google-cloud/storage");
const knexfile_1 = __importDefault(require("../../knexfile"));
const createUHRPAdvertisement_1 = __importDefault(require("../utils/createUHRPAdvertisement"));
const knex_1 = __importDefault(require("knex"));
const { ADMIN_TOKEN, NODE_ENV, ROUTING_PREFIX, HOSTING_DOMAIN, GCP_BUCKET_NAME } = process.env;
const storage = new storage_1.Storage();
const environment = NODE_ENV || 'development';
const db = (0, knex_1.default)(knexfile_1.default[environment]);
const advertiseHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof ADMIN_TOKEN === 'string' && ADMIN_TOKEN.length > 10 && req.body.adminToken === ADMIN_TOKEN) {
        try {
            // Retrieve file ID
            const file = yield db('file')
                .where({ objectIdentifier: req.body.objectIdentifier })
                .select('fileId')
                .first();
            if (!file) {
                return res.status(404).json({
                    status: 'error',
                    code: 'ERR_FILE_NOT_FOUND',
                    description: 'File not found in database.'
                });
            }
            const fileId = file.fileId;
            const transaction = yield db('transaction')
                .where({ advertisementTXID: null, fileId })
                .select('numberOfMinutesPurchased')
                .first();
            if (!transaction) {
                return res.status(404).json({
                    status: 'error',
                    code: 'ERR_TRANSACTION_NOT_FOUND',
                    description: 'Transaction record not found.'
                });
            }
            const expiryTime = Date.now() + transaction.numberOfMinutesPurchased * 60 * 1000;
            const storageFile = storage
                .bucket(GCP_BUCKET_NAME)
                .file(`cdn/${req.body.objectIdentifier}`);
            const { txid: adTXID } = yield (0, createUHRPAdvertisement_1.default)({
                hash: req.body.fileHash,
                url: `${HOSTING_DOMAIN}${ROUTING_PREFIX}/cdn/${req.body.objectIdentifier}`,
                expiryTime,
                contentLength: req.body.fileSize,
                confederacyHost: NODE_ENV === 'development'
                    ? 'http://localhost:3002'
                    : NODE_ENV === 'staging'
                        ? 'https://staging-confederacy.babbage.systems'
                        : ''
            });
            yield storageFile.setMetadata({
                customTime: new Date(expiryTime + 300 * 1000).toISOString()
            });
            yield db('file')
                .where({ objectIdentifier: req.body.objectIdentifier })
                .update({
                isUploaded: true,
                isAvailable: true,
                fileHash: req.body.fileHash
            });
            yield db('transaction')
                .where({ advertisementTXID: null, fileId })
                .update({ advertisementTXID: adTXID });
            res.status(200).json({ status: 'success' });
        }
        catch (error) {
            console.error('Error processing advertisement:', error);
            res.status(500).json({
                status: 'error',
                code: 'ERR_INTERNAL',
                description: 'An internal error occurred while processing the request.'
            });
        }
    }
    else {
        res.status(401).json({
            status: 'error',
            code: 'ERR_UNAUTHORIZED',
            description: 'Failed to advertise hosting commitment!'
        });
    }
});
exports.default = {
    type: 'post',
    path: '/advertise',
    knex: db,
    summary: 'Administrative endpoint to trigger UHRP advertisements when new files are uploaded.',
    parameters: {
        adminToken: 'Server admin token',
        fileHash: 'The UHRP hash to advertise',
        objectIdentifier: 'The ID of this contract',
        fileSize: 'The length of the file'
    },
    exampleResponse: { status: 'success' },
    errors: ['ERR_UNAUTHORIZED'],
    func: advertiseHandler
};
