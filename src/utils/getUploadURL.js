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
const path_1 = __importDefault(require("path"));
const { NODE_ENV, GCP_BUCKET_NAME, GCP_PROJECT_ID } = process.env;
const devUploadFunction = () => {
    console.log('[DEV] Returning pretend upload URL http://localhost:8080/upload');
    return { uploadURL: 'http://localhost:8080/upload' };
};
const prodUploadFunction = (_a) => __awaiter(void 0, [_a], void 0, function* ({ size, objectIdentifier }) {
    if (!GCP_BUCKET_NAME || !GCP_PROJECT_ID) {
        throw new Error('Missing required Google Cloud Storage eviornment variables.');
    }
    const serviceKey = path_1.default.join(__dirname, '../../storage-creds.json');
    const storage = new storage_1.Storage({
        keyFilename: serviceKey,
        projectId: GCP_PROJECT_ID
    });
    const bucket = storage.bucket(GCP_BUCKET_NAME);
    const bucketFile = bucket.file(`cdn/${objectIdentifier}`);
    const uploadURL = yield (bucketFile.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 604000 * 1000, // 1 week
        extensionHeaders: {
            'content-length': size.toString()
        }
    })).toString();
    return { uploadURL };
});
const getUploadURL = NODE_ENV === 'development' ? devUploadFunction : prodUploadFunction;
exports.default = getUploadURL;
