exports.up = async knex => {
  await knex.schema.dropTable('invoice')
  await knex.schema.dropTable('user')

  await knex.schema.table('transaction', table => {
    table.string('orderID')
    table.string('paymail')
    table.string('identityKey')
  })
}

exports.down = async knex => {
  await knex.schema.createTable('invoice', table => {
    table.increments('invoiceID')
    table.string('orderID')
    table.string('paymail')
    table.string('identityKey')
    table.string('referenceNumber').unique()
    table.integer('userID').unsigned().references('userId').inTable('user')
    table.integer('amount')
    table.boolean('processed')
  })
await knex.schema.table('transaction', table => {
  table.dropColumn('identityKey')
  table.dropColumn('paymail')
  table.dropColumn('orderID')
})
  await knex.schema.table('transaction', table => {
    table.dropColumn('orderID')
    table.dropColumn('paymail')
    table.dropColumn('identityKey')
  })
}
