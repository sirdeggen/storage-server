import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import bodyparser from 'body-parser'
import prettyjson from 'prettyjson'
import { spawn } from 'child_process'
import { PrivateKey } from '@bsv/sdk'
import { createAuthMiddleware } from '@bsv/auth-express-middleware'
import { createPaymentMiddleware } from '@bsv/payment-express-middleware'
import knex, { Knex } from 'knex'
import { wallet } from './utils/walletSingleton'
import knexConfig from '../knexfile'
import routes from './routes'


const UHRP_HOST_PRIVATE_KEY = process.env.UHRP_HOST_PRIVATE_KEY as string
const NODE_ENV = process.env.NODE_ENV
const HTTP_PORT = 8080
const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY as string
const HOSTING_DOMAIN = process.env.HOSTING_DOMAIN as string

const enviornment = (NODE_ENV as 'development' | 'staging' | 'production') || 'development'
const db: Knex = knex(knexConfig[enviornment])

const ROUTING_PREFIX = process.env.ROUTING_PREFIX || ''
const app = express()
app.use(bodyparser.json({ limit: '1gb', type: 'application/json' }))

// This allows the API to be used when CORS is enforced
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Expose-Headers', '*')
  res.header('Access-Control-Allow-Private-Network', 'true')
  if (req.method === 'OPTIONS') {
    res.send(200)
  } else {
    next()
  }
})

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${req.method}] <- ${req.url}`);
  const logObject = { ...req.body }
  console.log(prettyjson.render(logObject, { keysColor: 'blue' }))
  const originalJson = res.json.bind(res)
  res.json = (json: any) => {
    console.log(`[${req.method}] -> ${req.url}`)
    console.log(prettyjson.render(json, { keysColor: 'green' }))
    return originalJson(json)
  }
  next()
})

app.use(express.static('public'))

// Unsecured pre-Authrite routes are added first
interface Route<T = Request> {
  path: string,
  type: 'get' | 'post' | 'put' | 'delete' | 'patch'
  func: (req: Request, res: Response, next: NextFunction) => void | Promise<void>
  unsecured?: boolean
  middleware?: (req: Request, res: Response, next: NextFunction) => void
}

const preAuthriteRoutes = Object.values(routes.preAuthrite);
const postAuthriteRoutes = Object.values(routes.postAuthrite);

// Cycle through pre-authrite routes
preAuthriteRoutes.filter(route => (route as any).unsecured).forEach((route) => {
  console.log(`adding route ${route.path} pre-authrite`)
  // If we need middleware for a route, attach it
  if ((route as any).middleware) {
    app[route.type](
      `${ROUTING_PREFIX}${route.path}`,
      (route as any).middleware,
      (route as any).func
    )
  } else {
    app[route.type](`${ROUTING_PREFIX}${route.path}`, (route as any).func)
  }
})

// This ensures that HTTPS is used unless you are in development mode
app.use((req: Request, res: Response, next: NextFunction) => {
  if (
    !req.secure &&
    req.get('x-forwarded-proto') !== 'https' &&
    NODE_ENV !== 'development'
  ) {
    return res.redirect('https://' + req.get('host') + req.url)
  }
  next()
});

// Secured pre-Authrite routes are added after the HTTPS redirect
preAuthriteRoutes.filter(route => !(route as any).unsecured).forEach((route) => {
  console.log(`adding route ${route.path} https required`)
  // If we need middleware for a route, attach it
  if ((route as any).middleware) {
    app[route.type](
      `${ROUTING_PREFIX}${route.path}`,
      (route as any).middleware,
      (route as any).func
    )
  } else {
    app[route.type](`${ROUTING_PREFIX}${route.path}`, (route as any).func)
  }
})

// Authrite is enforced from here forward

const authMiddleware = createAuthMiddleware({
  wallet,
  allowUnauthenticated: false
})

const paymentMiddleware = createPaymentMiddleware({
  wallet,
  calculateRequestPrice: async (req) => {
    const orderID = (req as any).body?.orderID || (req as any).query?.orderID
    if (!orderID) {
      return 0
    }

    const transaction = await db('transaction')
      .where({ orderID })
      .first()    
    if (!transaction) {
      return 0
    }
    if (transaction.paid) {
      return 0
    }

    return transaction.amount || 0
  }
})

app.use(authMiddleware);
app.use(paymentMiddleware)


// Secured, post-Authrite routes are added
postAuthriteRoutes.forEach((route) => {
  console.log(`adding route ${route.path} https and authrite required`)
  // If we need middleware for a route, attach it
  if ((route as any).middleware) {
    app[route.type](
      `${ROUTING_PREFIX}${route.path}`,
      (route as any).middleware,
      (route as any).func
    )
  } else {
    app[route.type](`${ROUTING_PREFIX}${route.path}`, (route as any).func)
  }
})

app.use((req, res) => {
  console.log('404', req.url)
  res.status(404).json({
    status: 'error',
    code: 'ERR_ROUTE_NOT_FOUND',
    description: 'Route not found.'
  })
})

app.listen(HTTP_PORT, () => {
  console.log('Nanostore listening on port', HTTP_PORT)

  if (NODE_ENV !== 'development') {
    spawn('nginx', [], { stdio: [process.stdin, process.stdout, process.stderr] })
  }

  const addr = PrivateKey
    .fromString(UHRP_HOST_PRIVATE_KEY)
  console.log(`UHRP Host Address: ${addr}`)
})
