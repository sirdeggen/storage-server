exports.up = async knex => {
  await knex.schema.table('transaction', table => {
    table.dropColumn('paymail')
  })
}

exports.down = async knex => {
}
