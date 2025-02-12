import { Request, Response } from 'express'
import knex, { Knex } from 'knex'
import knexConfig from '../../knexfile'

const {
  MIGRATE_KEY
} = process.env

const db: Knex = knex(knexConfig.production)

interface MigrateRequest extends Request {
  body: {
    migratekey: string
  }
}

interface MigrateResponse {
  status: 'success' | 'error'
  code?: string
  description?: string
}

const migrateHandler = async (req: MigrateRequest, res: Response<MigrateResponse>) => {
  if (
    typeof MIGRATE_KEY === 'string' &&
    MIGRATE_KEY.length > 10 &&
    req.body.migratekey === MIGRATE_KEY
  ) {
    try {
      await db.migrate.latest()
      res.status(200).json({
        status: 'success'
      })
    } catch (error) {
      console.error('Error running migrations:', error)
      res.status(500).json({
        status: 'error',
        code: 'ERR_MIGRATION_FAILED',
        description: 'An error occurred while running database migrations.'
      })
    }
  } else {
    res.status(401).json({
      status: 'error',
      code: 'ERR_UNAUTHORIZED',
      description: 'Migrate key is invalid'
    })
  }
}

export default {
  type: 'post',
  path: '/migrate',
  knex,
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
}