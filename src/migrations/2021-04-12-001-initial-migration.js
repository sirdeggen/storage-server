exports.up = async knex => {
  await knex.schema.createTable('file', table => {
    table.increments('fileId')
    table.timestamps()
    table.bigInteger('fileSize')
    table.string('fileHash', 52)
    table.string('mimeType')
    table.datetime('deleteAfter', { useTz: false })
    table.boolean('isUploaded')
    table.boolean('isAvailable')
    table.boolean('isDeleted')
    table.string('objectIdentifier')
  })
  await knex.schema.createTable('transaction', table => {
    table.increments('transactionId')
    table.timestamps()
    table.string('referenceNumber', 64)
    table.bigInteger('path')
    table.bigInteger('amount')
    table.string('txid')
    table.integer('numberOfMinutesPurchased')
    table.boolean('paid')
    table.boolean('redeemedByServerOperator')
    table.string('advertisementTXID')
    table.integer('fileId').unsigned().references('fileId').inTable('file')
  })
}

exports.down = async knex => {
  await knex.schema.dropTable('transaction')
  await knex.schema.dropTable('file')
}
