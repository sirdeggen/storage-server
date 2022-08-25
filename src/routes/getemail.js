const knex =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)
const authenticateRequest = require('../utils/authenticateRequest')
const errors = require('../errors')

module.exports = {
  type: 'post',
  path: '/getemail',
  knex,
  summary: 'Get Email',
  parameters: {},
  exampleResponse: {
    email: 'cryptodude@babbage.com'
  },
  func: async (req, res) => {
    try {
      const userId = await authenticateRequest({ req, res, knex })
      if (!userId) return

      const [user] = await knex('user').where({
        userId
      }).select(
        'email'
      )

      res.status(200).json({
        email: user.email
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
