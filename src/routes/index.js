"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const routes = {
    preAuthrite: [
        Object.assign(Object.assign({}, require('./advertise')), { type: 'post' }),
        Object.assign(Object.assign({}, require('./quote')), { type: 'post' }),
        Object.assign(Object.assign({}, require('./migrate')), { type: 'post' }),
        Object.assign(Object.assign({}, require('./getChain')), { type: 'get' })
    ],
    postAuthrite: [
        Object.assign(Object.assign({}, require('./pay')), { type: 'post' }),
        Object.assign(Object.assign({}, require('./invoice')), { type: 'post' })
    ]
};
exports.default = routes;
