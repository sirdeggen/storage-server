exports.up = async knex => {
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
}

exports.down = async knex => {
  await knex.schema.dropTable('invoice')
}

