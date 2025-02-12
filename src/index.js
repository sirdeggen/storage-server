"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const prettyjson_1 = __importDefault(require("prettyjson"));
const send_seekable_1 = __importDefault(require("send-seekable"));
const child_process_1 = require("child_process");
const authrite_express_1 = __importDefault(require("authrite-express"));
const babbage_bsv_1 = __importDefault(require("babbage-bsv"));
const routes_1 = __importDefault(require("./routes"));
const { UHRP_HOST_PRIVATE_KEY, NODE_ENV, HTTP_PORT = 8080, SERVER_PRIVATE_KEY, HOSTING_DOMAIN } = process.env;
const ROUTING_PREFIX = process.env.ROUTING_PREFIX || '';
const app = (0, express_1.default)();
app.use(body_parser_1.default.json({ limit: '1gb', type: 'application/json' }));
app.use(send_seekable_1.default);
// This allows the API to be used when CORS is enforced
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Expose-Headers', '*');
    res.header('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') {
        res.send(200);
    }
    else {
        next();
    }
});
app.use((req, res, next) => {
    console.log(`[${req.method}] <- ${req.url}`);
    const logObject = Object.assign({}, req.body);
    console.log(prettyjson_1.default.render(logObject, { keysColor: 'blue' }));
    const originalJson = res.json.bind(res);
    res.json = (json) => {
        console.log(`[${req.method}] -> ${req.url}`);
        console.log(prettyjson_1.default.render(json, { keysColor: 'green' }));
        return originalJson(json);
    };
    next();
});
app.use(express_1.default.static('public'));
const preAuthriteRoutes = routes_1.default.preAuthrite;
const postAuthriteRoutes = routes_1.default.postAuthrite;
// Cycle through pre-authrite routes
preAuthriteRoutes.filter(route => route.unsecured).forEach((route) => {
    console.log(`adding route ${route.path} pre-authrite`);
    // If we need middleware for a route, attach it
    if (route.middleware) {
        app[route.type](`${ROUTING_PREFIX}${route.path}`, route.middleware, route.func);
    }
    else {
        app[route.type](`${ROUTING_PREFIX}${route.path}`, route.func);
    }
});
// This ensures that HTTPS is used unless you are in development mode
app.use((req, res, next) => {
    if (!req.secure &&
        req.get('x-forwarded-proto') !== 'https' &&
        NODE_ENV !== 'development') {
        return res.redirect('https://' + req.get('host') + req.url);
    }
    next();
});
// Secured pre-Authrite routes are added after the HTTPS redirect
preAuthriteRoutes.filter(route => !route.unsecured).forEach((route) => {
    console.log(`adding route ${route.path} https required`);
    // If we need middleware for a route, attach it
    if (route.middleware) {
        app[route.type](`${ROUTING_PREFIX}${route.path}`, route.middleware, route.func);
    }
    else {
        app[route.type](`${ROUTING_PREFIX}${route.path}`, route.func);
    }
});
// Authrite is enforced from here forward
app.use(authrite_express_1.default.middleware({
    serverPrivateKey: SERVER_PRIVATE_KEY,
    baseUrl: HOSTING_DOMAIN
}));
// Secured, post-Authrite routes are added
postAuthriteRoutes.forEach((route) => {
    console.log(`adding route ${route.path} https and authrite required`);
    // If we need middleware for a route, attach it
    if (route.middleware) {
        app[route.type](`${ROUTING_PREFIX}${route.path}`, route.middleware, route.func);
    }
    else {
        app[route.type](`${ROUTING_PREFIX}${route.path}`, route.func);
    }
});
app.use((req, res) => {
    console.log('404', req.url);
    res.status(404).json({
        status: 'error',
        code: 'ERR_ROUTE_NOT_FOUND',
        description: 'Route not found.'
    });
});
app.listen(HTTP_PORT, () => {
    console.log('Nanostore listening on port', HTTP_PORT);
    if (NODE_ENV !== 'development') {
        (0, child_process_1.spawn)('nginx', [], { stdio: [process.stdin, process.stdout, process.stderr] });
    }
    const addr = babbage_bsv_1.default
        .PrivateKey
        .fromString(UHRP_HOST_PRIVATE_KEY)
        .toAddress()
        .toString();
    console.log(`UHRP Host Address: ${addr}`);
});
