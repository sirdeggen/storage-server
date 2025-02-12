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
const babbage_bsv_1 = require("babbage-bsv");
const ninja_base_1 = require("ninja-base");
const authrite_js_1 = require("authrite-js");
const pushdrop_1 = __importDefault(require("pushdrop"));
const uhrp_url_1 = require("uhrp-url");
const { UHRP_HOST_PRIVATE_KEY, SERVER_PRIVATE_KEY, DOJO_URL } = process.env;
/**
 * Creates an advertisement for a particular hosted file presenting its UHRP.
 *
 * @param {Object} obj All parameters are given in an object.
 * @param {string} obj.hash The 32-byte SHA-256 hash of the file, the UHRP (can be a URL, which has to be converted).
 * @param {Number} obj.expiryTime UTC timestamp.
 * @param {string} obj.url The HTTPS URL where the content can be reached
 * @param {Number} obj.contentLength The length of the content in bytes
 * @param {string} obj.confederacyHost HTTPS Url for for the Confederacy host with default setting.

 * @returns {Promise<Object>} The transaction object, containing `txid` identifer and `reference` for the advertisement.
 */
const createUHRPAdvertisement = (_a) => __awaiter(void 0, [_a], void 0, function* ({ hash, expiryTime, url, contentLength, confederacyHost = 'https://confederacy.babbage.systems' }) {
    console.log('hash:', hash);
    console.log('expiryTime:', expiryTime);
    const ninja = new ninja_base_1.Ninja({
        privateKey: SERVER_PRIVATE_KEY,
        config: {
            dojoURL: DOJO_URL
        }
    });
    const key = babbage_bsv_1.bsv.PrivateKey.fromWIF(UHRP_HOST_PRIVATE_KEY);
    const address = key.toAddress().toString();
    // Make into a hash, as necessary
    if (typeof hash === 'string') {
        hash = (0, uhrp_url_1.getHashFromURL)(hash);
    }
    console.log('hash:', hash);
    expiryTime = Math.floor(expiryTime / 1000);
    console.log('expiryTime:', expiryTime);
    const actionScript = yield pushdrop_1.default.create({
        fields: [
            Buffer.from('1UHRPYnMHPuQ5Tgb3AF8JXqwKkmZVy5hG', 'utf8'),
            Buffer.from(address, 'utf8'),
            hash,
            Buffer.from('advertise', 'utf8'),
            Buffer.from(url, 'utf8'),
            Buffer.from('' + expiryTime, 'utf8'),
            Buffer.from('' + contentLength, 'utf8')
        ],
        key
    });
    const tx = yield ninja.getTransactionWithOutputs({
        outputs: [{
                satoshis: 500,
                script: actionScript
            }],
        labels: [
            'nanostore'
        ],
        note: 'UHRP Confederacy Availability Advertisement',
        autoProcess: true
    });
    console.log('tx:', tx);
    try {
        // Submit the transaction to a Confederacy UHRP topic
        const response = yield new authrite_js_1.Authrite({ clientPrivateKey: SERVER_PRIVATE_KEY }).request(`${confederacyHost}/submit`, {
            method: 'POST',
            body: {
                rawTx: tx.rawTx,
                inputs: tx.inputs,
                mapiResponses: tx.mapiResponses,
                topics: ['UHRP']
            }
        });
        const submitResult = JSON.parse(Buffer.from(response.body).toString('utf8'));
        // Check for any errors returned and create error to notify bugsnag.
        if (submitResult.status && submitResult.status === 'error') {
            throw new Error(`${submitResult.code || 'ERR_UNKNOWN'}: ${submitResult.description}`);
        }
    }
    catch (e) {
        console.error('Error sending UHRP tx to Confederacy host, ignoring...', e);
        if (global.Bugsnag)
            global.Bugsnag.notify(e);
    }
    return {
        txid: new babbage_bsv_1.bsv.Transaction(tx.rawTx).id,
        reference: tx.referenceNumber
    };
});
exports.default = createUHRPAdvertisement;
