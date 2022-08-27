
exports.up = async knex => {
  await knex.schema.createTable('user', table => {
    table.increments('userId')
    table.timestamps()
    table.string('identityKey', 130)
  })
}
exports.down = async knex => {
  await knex.schema.dropTable('user')
}
