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
const axios_1 = __importDefault(require("axios"));
const { PRICE_PER_GB_MO } = process.env;
/**
 * Calculates the satoshi price for file storage.
 *
 * @param {PriceCalculationParams} params - Parameters for price calculation.
 * @returns {Promise<number>} - The price in satoshis.
 */
const getPriceForFile = (_a) => __awaiter(void 0, [_a], void 0, function* ({ retentionPeriod, fileSize }) {
    if (!PRICE_PER_GB_MO) {
        throw new Error('PRICE_PER_GB_MO is undefined');
    }
    const pricePerGBMonth = parseFloat(PRICE_PER_GB_MO);
    if (isNaN(pricePerGBMonth)) {
        throw new Error('PRICE_PER_GB_MO must be a valid number');
    }
    // File size is in bytes, convert to gigabytes
    const fileSizeGB = fileSize / 1000000000;
    // Retention period is in minutes, convert it to months
    const retentionPeriodMonths = retentionPeriod / (60 * 24 * 30);
    // Calculate the USD price
    const usdPrice = fileSizeGB * retentionPeriodMonths * pricePerGBMonth;
    // Get the exchange rate
    let exchangeRate;
    try {
        const { data } = yield axios_1.default.get('https://api.whatsonchain.com/v1/bsv/main/exchangerate');
        if (typeof data !== 'object' || isNaN(data.rate)) {
            throw new Error('Invalid rate response');
        }
        exchangeRate = data.rate;
    }
    catch (e) {
        exchangeRate = 100;
        console.error('Exchange rate failed, using fallback rate of 100', e);
    }
    // Exchange rate is in BSV, convert to satoshis
    const exchangeRateInSatoshis = 1 / (exchangeRate / 100000000);
    // Avoid dust outputs (which are smaller than 546 satoshis)
    let satPrice = Math.max(546, Math.floor(usdPrice * exchangeRateInSatoshis));
    // TODO: Find out from miners if they will accept anything smaller
    return satPrice;
});
exports.default = getPriceForFile;
