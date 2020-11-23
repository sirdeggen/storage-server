require('dotenv').config()
const express = require('express')
const bodyparser = require('body-parser')
const prettyjson = require('prettyjson')
const serverless = require('serverless-http')
const routes = require('./routes')

const HTTP_PORT = process.env.HTTP_PORT || 8080
const ROUTING_PREFIX = process.env.ROUTING_PREFIX || ''

const app = express()
app.use(bodyparser.json())

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
  console.log(`[${req.method}] req._parsedUrl.pathname`)
  console.log(`[${req.method}] ${req._parsedUrl.pathname}`)
  const logObject = { ...req.body }
  if (logObject.secret) logObject.secret = '********'
  if (logObject.oldsecret) logObject.oldsecret = '********'
  if (logObject.newsecret) logObject.newsecret = '********'
  console.log(prettyjson.render(logObject, { keysColor: 'blue' }))
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
  console.log('404', req)
  res.status(404).json({
    status: 'error',
    error: 'Route not found.'
  })
})

app.listen(HTTP_PORT, () => {
  console.log('Hash brown listening on port', HTTP_PORT)
})

module.exports.handler = serverless(app)
