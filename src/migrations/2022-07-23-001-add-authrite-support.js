
exports.up = async knex => {
  await knex.schema.createTable('user', table => {
    table.increments('userId')
    table.timestamps()
    table.string('identityKey', 130)
    table.bigInteger('balance')
    table.string('email', 100)
    table.boolean('isBusiness')
    table.string('firstName', 40)
    table.string('lastName', 40)
    table.string('companyName', 60)
  })
}
exports.down = async knex => {
  await knex.schema.dropTable('user')
}
