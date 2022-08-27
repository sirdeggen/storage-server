module.exports = {
  preAuthrite: [
    require('./download'),
    require('./quote'), // not currently used?
    require('./migrate')
  ],
  postAuthrite: [
    require('./pay'),
    require('./invoice')
  ]
}
