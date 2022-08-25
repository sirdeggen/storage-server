const knex =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
    ? require('knex')(require('../../knexfile.js').production)
    : require('knex')(require('../../knexfile.js').development)
const authenticateRequest = require('../utils/authenticateRequest')
const errors = require('../errors')

module.exports = {
  type: 'post',
  path: '/setemail',
  knex,
  summary: 'Set Email',
  parameters: {
    userId: 'The Id of the User whose email will be updated',
    email: 'The Email to be associated with the user'
  },
  exampleResponse: {},
  func: async (req, res) => {
    try {
      const userId = await authenticateRequest({ req, res, knex })
      if (!userId) return

      const { email } = req.body

      await knex('user').where({
        userId
      }).update({ email })

      res.status(200).json({
        result: 'User ' + userId + ' email set to ' + email,
        status: 'success'
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
