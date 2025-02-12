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
Object.defineProperty(exports, "__esModule", { value: true });
const ninja_base_1 = require("ninja-base");
const { SERVER_PRIVATE_KEY, DOJO_URL } = process.env;
const getChainHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('processing getChain...');
        const ninja = new ninja_base_1.Ninja({
            privateKey: SERVER_PRIVATE_KEY,
            config: {
                dojoURL: DOJO_URL
            }
        });
        const chain = yield ninja.getChain();
        // Return the required info to the sender
        return res.status(200).json({
            status: 'success',
            chain
        });
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 'error',
            code: 'ERR_INTERNAL_PROCESSING_GETCHAIN',
            description: 'An internal error has occurred while processing getChain.'
        });
    }
});
exports.default = {
    type: 'get',
    path: '/getChain',
    summary: 'Use this route to confirm the chain this service is configured to run on.',
    parameters: {},
    exampleResponse: {
        status: 'success',
        chain: 'test'
    },
    errors: [],
    func: getChainHandler
};
