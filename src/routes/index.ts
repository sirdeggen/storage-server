const routes = {
  preAuthrite: [
    { ...require('./advertise'), type: 'post' as 'post' },
    { ...require('./quote'), type: 'post' as 'post' },
    { ...require('./migrate'), type: 'post' as 'post' },
    { ...require('./getChain'), type: 'get' as 'get' }
  ],
  postAuthrite: [
    { ...require('./pay'), type: 'post' as 'post' },
    { ...require('./invoice'), type: 'post' as 'post' }
  ]
};

export default routes;
