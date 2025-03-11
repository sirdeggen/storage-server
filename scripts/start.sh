#!/bin/bash

if [ $NODE_ENV = 'production' ] || [ $NODE_ENV = 'staging' ]
then
  npm run build
  echo "$GCP_STORAGE_CREDS" > /app/out/storage-creds.json
  node ./out/src/index.js
  exit
fi

npm run dev