"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ejs_1 = require("ejs");
const fs_1 = require("fs");
require('dotenv').config();
(0, ejs_1.renderFile)('src/templates/documentation.ejs', Object.assign(Object.assign({}, process.env), { routes: require('../src/routes') }), {}, (err, res) => {
    if (err) {
        throw err;
    }
    console.log('Generating API Documentation...');
    (0, fs_1.writeFileSync)('public/index.html', res);
});
