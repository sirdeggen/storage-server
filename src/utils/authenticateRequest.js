const errors = require('../errors')

module.exports = async ({ req, res, knex/* not "next" but "knex" */ }) => {
  try {
    // First, we make sure the user has provided the required fields
    if (!req || !req.authrite || !req.authrite.identityKey) {
    // If the request has not been authenticated, a 401 error is returned
      res.status(401).json({
        status: 'error',
        code: 'ERR_UNAUTHORIZED',
        description: errors.ERR_UNAUTHORIZED
      })
      return null
    }

    // Check if a user with the provided identityKey exists
    const [user] = await knex('user').where({
      identityKey: req.authrite.identityKey
    }).select('userId')

    // If the user exists, their user ID is returned
    if (user) {
      return user.userId
    }

    // Otherwise, a new user is inserted with their new identity key
    await knex('user').insert({
      identityKey: req.authrite.identityKey,
      balance: 0,
      created_at: new Date(),
      updated_at: new Date()
    })

    // We need to know the ID of the newly-inserted user
    const [newUser] = await knex('user').where({
      identityKey: req.authrite.identityKey
    }).select('userId')

    // Finally, their new user ID is returned
    return newUser.userId
  } catch (e) {
    console.error(e)
    // In case of any errors, such as verification failure, a 401 error is returned
    res.status(401).json({
      status: 'error',
      code: 'ERR_UNAUTHORIZED',
      description: errors.ERR_UNAUTHORIZED
    })
    return null
  }
}
