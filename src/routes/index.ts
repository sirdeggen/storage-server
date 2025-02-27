import advertise from './advertise';
import quote from './quote';
import migrate from './migrate';
import pay from './pay';
import invoice from './invoice';

const routes = {
  preAuthrite: [
    { ...advertise, type: 'post' as 'post' },
    { ...quote, type: 'post' as 'post' },
    { ...migrate, type: 'post' as 'post' },
  ],
  postAuthrite: [
    { ...pay, type: 'post' as 'post' },
    { ...invoice, type: 'post' as 'post' }
  ]
};

export default routes;
