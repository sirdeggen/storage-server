#!/bin/bash

if [ $NODE_ENV = 'production' ] || [ $NODE_ENV = 'staging' ]
then
  echo "$GCP_STORAGE_CREDS" > /app/storage-creds.json
  npm run build
  node ./out/src/index.js
  exit
fi

npm run dev