module.exports = {
  preAuthrite: [
    require('./download'),
    require('./quote'),
    require('./oldUpload'),
    require('./migrate')
  ],
  postAuthrite: [
    require('./pay'),
    require('./invoice')
  ]
}
