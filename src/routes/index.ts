import advertise from './advertise';
import quote from './quote';
import upload from './upload';

const routes = {
  preAuth: [
    advertise,
    quote
  ],
  postAuth: [
    upload
  ]
};

export default routes;
