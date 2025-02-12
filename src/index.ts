import  'dotenv/config'
import express, {Request, Response, NextFunction} from 'express'
import bodyparser from 'body-parser'
import prettyjson from 'prettyjson'
import sendSeekable from 'send-seekable'
import { spawn } from 'child_process'
import authrite from 'authrite-express'
import * as bsv from 'babbage-bsv'
import routes from './routes'

const {
  UHRP_HOST_PRIVATE_KEY,
  NODE_ENV,
  HTTP_PORT = 8080,
  SERVER_PRIVATE_KEY,
  HOSTING_DOMAIN
} = process.env

const ROUTING_PREFIX = process.env.ROUTING_PREFIX || ''
const app = express()
app.use(bodyparser.json({ limit: '1gb', type: 'application/json' }))
app.use(sendSeekable)

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
  func: (req: Request, res:Response, next : NextFunction) => void | Promise<void>
  unsecured?: boolean
  middleware?: (req: Request, res: Response, next: NextFunction) => void
}

const preAuthriteRoutes: Route<any>[] = routes.preAuthrite as Route<any>[];
const postAuthriteRoutes: Route<any>[] = routes.postAuthrite as Route<any>[];

// Cycle through pre-authrite routes
preAuthriteRoutes.filter(route => route.unsecured).forEach((route: Route) => {
  console.log(`adding route ${route.path} pre-authrite`)
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
preAuthriteRoutes.filter(route => !route.unsecured).forEach((route: Route) => {
  console.log(`adding route ${route.path} https required`)
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

// Authrite is enforced from here forward
app.use(authrite.middleware({
  serverPrivateKey: SERVER_PRIVATE_KEY,
  baseUrl: HOSTING_DOMAIN
}));

// Secured, post-Authrite routes are added
postAuthriteRoutes.forEach((route: Route) => {
  console.log(`adding route ${route.path} https and authrite required`)
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
    code: 'ERR_ROUTE_NOT_FOUND',
    description: 'Route not found.'
  })
})

app.listen(HTTP_PORT, () => {
  console.log('Nanostore listening on port', HTTP_PORT)

  if (NODE_ENV !== 'development') {
    spawn('nginx', [], { stdio: [process.stdin, process.stdout, process.stderr] })
  }

  const addr = bsv
    .PrivateKey
    .fromString(UHRP_HOST_PRIVATE_KEY)
    .toAddress()
    .toString()
  console.log(`UHRP Host Address: ${addr}`)
})
