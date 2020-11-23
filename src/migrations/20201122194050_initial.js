exports.up = async (knex) => {
  await knex.schema.createTable('file', (table) => {
    table.increments()
    table.timestamps()
    table.string('file_name', 64)
    table.bigInteger('file_size')
    table.string('file_hash', 52)
  })
}

exports.down = async (knex) => {
  await knex.schema.dropTable('users')
}
