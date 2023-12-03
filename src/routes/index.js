module.exports = {
  preAuthrite: [
    require('./advertise'),
    require('./quote'),
    require('./migrate'),
    require('./getChain')
  ],
  postAuthrite: [
    require('./pay'),
    require('./invoice')
  ]
}
