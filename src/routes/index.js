module.exports = {
  preAuthrite: [
    require('./getemail'),
    require('./setemail'),
    require('./getsetupstatus'),
    require('./download'),
    require('./quote'),
    require('./oldUpload'),
    require('./migrate'),
    require('./advertise')
  ],
  postAuthrite: [
    require('./pay'),
    require('./invoice')
  ]
}
