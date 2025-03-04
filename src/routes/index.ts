import advertise from './advertise';
import quote from './quote';
import upload from './upload';

const routes = {
  preAuthrite: [
    { ...advertise, type: 'post' as 'post' },
    { ...quote, type: 'post' as 'post' },
  ],
  postAuthrite: [
    { ...upload, type: 'upload' as 'upload' },
  ]
};

export default routes;
