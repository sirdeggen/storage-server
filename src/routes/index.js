module.exports = {
  preAuthrite: [
    require('./advertise'),
    require('./quote'),
    require('./migrate')
  ],
  postAuthrite: [
    require('./pay'),
    require('./invoice')
  ]
}
