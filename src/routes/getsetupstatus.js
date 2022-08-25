const knex =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)
const authenticateRequest = require('../utils/authenticateRequest')
const errors = require('../errors')

module.exports = {
  type: 'post',
  path: '/getsetupstatus',
  knex,
  summary: 'Get Setup Status',
  parameters: {
    bridgeId: 'The address of the bridge'
  },
  exampleResponse: {
    status: 'Completed'
  },
  func: async (req, res) => {
    try {
      const userId = await authenticateRequest({ req, res, knex })
      if (!userId) return

      const [bridge] = await knex('bridge').where({
        ownerId: userId,
        address: req.body.bridgeId
      }).select('setupStatus')

      if (!bridge) {
        return res.status(400).json({
          status: 'error',
          code: 'ERR_BRIDGE_NOT_FOUND',
          description: 'No bridge with this ID is found in your account.'
        })
      }

      res.status(200).json({
        status: bridge.setupStatus
      })
    } catch (e) {
      console.error(e)
      if (global.Bugsnag) global.Bugsnag.notify(e)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL',
        description: errors.ERR_INTERNAL
      })
    }
  }
}
