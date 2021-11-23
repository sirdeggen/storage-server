require('dotenv').config()
const express = require('express')
const bodyparser = require('body-parser')
const prettyjson = require('prettyjson')
const sendSeekable = require('send-seekable')
const routes = require('./routes')
const bsv = require('bsv')
const spdy = require('spdy')
const http = require('http')

const { UHRP_HOST_PRIVATE_KEY } = process.env

if (process.env.NODE_ENV !== 'development') {
  require('@google-cloud/debug-agent').start({
    serviceContext: { enableCanary: false }
  })
}

const HTTP_PORT = process.env.PORT || process.env.HTTP_PORT || 8080
const ROUTING_PREFIX = process.env.ROUTING_PREFIX || ''

const app = express()
app.use(bodyparser.json())
app.use(sendSeekable)
// app.use((req, res, next) => {
//   if (
//     !req.secure &&
//     req.get('x-forwarded-proto') !== 'https' &&
//     process.env.NODE_ENV !== 'development'
//   ) {
//     return res.redirect('https://' + req.get('host') + req.url)
//   }
//   next()
// })
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  )
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS, POST')
  next()
})
app.use((req, res, next) => {
  console.log('[' + req.method + '] <- ' + req._parsedUrl.pathname)
  const logObject = { ...req.body }
  // if (logObject.secret) logObject.secret = '********'
  console.log(prettyjson.render(logObject, { keysColor: 'blue' }))
  res.nologJson = res.json
  res.json = json => {
    res.nologJson(json)
    console.log('[' + req.method + '] -> ' + req._parsedUrl.pathname)
    console.log(prettyjson.render(json, { keysColor: 'green' }))
  }
  next()
})
app.use(express.static('public'))

app.options('*', (req, res) =>
  res.status(200).json({
    message: 'Send a POST request to see the results.'
  })
)

// Cycle through routes
routes.forEach((route) => {
  // If we need middleware for a route, attach it
  if (route.middleware) {
    app[route.type](
      `${ROUTING_PREFIX}${route.path}`,
      route.middleware,
      route.func
    )
  } else {
    app[route.type](`${ROUTING_PREFIX}${route.path}`, route.func)
  }
})

app.use((req, res) => {
  console.log('404', req.url)
  res.status(404).json({
    status: 'error',
    error: 'Route not found.'
  })
})

const server = spdy.createServer(http.Server, {
  plain: true,
  ssl: false,
  protocols: ['h2', 'h2c', 'spdy/3.1', 'spdy/3', 'spdy/2', 'http/1.1', 'http/1.0']
}, app)

server.listen(HTTP_PORT, () => {
  console.log('Nanostore listening on port', HTTP_PORT)
  const addr = bsv
    .PrivateKey
    .fromString(UHRP_HOST_PRIVATE_KEY)
    .toAddress()
    .toString()
  console.log(`UHRP Host Address: ${addr}`)
})
