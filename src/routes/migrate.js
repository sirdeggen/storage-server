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
const { MIGRATE_KEY } = process.env;
const db = (0, knex_1.default)(knexfile_1.default.production);
const migrateHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof MIGRATE_KEY === 'string' &&
        MIGRATE_KEY.length > 10 &&
        req.body.migratekey === MIGRATE_KEY) {
        try {
            yield db.migrate.latest();
            res.status(200).json({
                status: 'success'
            });
        }
        catch (error) {
            console.error('Error running migrations:', error);
            res.status(500).json({
                status: 'error',
                code: 'ERR_MIGRATION_FAILED',
                description: 'An error occurred while running database migrations.'
            });
        }
    }
    else {
        res.status(401).json({
            status: 'error',
            code: 'ERR_UNAUTHORIZED',
            description: 'Migrate key is invalid'
        });
    }
});
exports.default = {
    type: 'post',
    path: '/migrate',
    knex: knex_1.default,
    summary: 'This is an administrative endpoint used by the server administrator to run any new database migrations and bring the database schema up-to-date.',
    parameters: {
        migrateKey: 'The database migration key that was configured by the server administrator.'
    },
    exampleResponse: {
        status: 'success'
    },
    errors: [
        'ERR_UNAUTHORIZED'
    ],
    func: migrateHandler
};
