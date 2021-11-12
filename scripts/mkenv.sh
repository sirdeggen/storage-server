#!/bin/bash

# Create .env file
echo "Generating .env file..."
echo "NODE_ENV=$NODE_ENV" > .env
echo "HOSTING_DOMAIN=$HOSTING_DOMAIN" >> .env
echo "ROUTING_PREFIX=$ROUTING_PREFIX" >> .env
echo "KNEX_DB_CONNECTION=$KNEX_DB_CONNECTION" >> .env
echo "KNEX_DB_CLIENT=$KNEX_DB_CLIENT" >> .env
echo "MIGRATE_KEY=$MIGRATE_KEY" >> .env
echo "PRICE_PER_GB_MO=$PRICE_PER_GB_MO" >> .env
echo "UHRP_HOST_PRIVATE_KEY=$UHRP_HOST_PRIVATE_KEY" >> .env
echo "SERVER_XPRIV=$SERVER_XPRIV" >> .env
echo "MIN_HOSTING_MINUTES=$MIN_HOSTING_MINUTES" >> .env
echo "GCP_BUCKET_NAME=$GCP_BUCKET_NAME" >> .env
echo "GCP_PROJECT_ID=$GCP_PROJECT_ID" >> .env
echo "SERVER_PAYMAIL=$SERVER_PAYMAIL" >> .env
echo "CWI_NPM_TOKEN=$CWI_NPM_TOKEN" >> .env

# Create credential file
echo "Generating storage credential file..."
echo "$GCP_STORAGE_CREDS" > storage-creds.json

# Create .npmrc
echo "Generating .npmrc"
echo "@cwi:registry=https://npm-registry.babbage.systems/" > .npmrc
echo "//npm-registry.babbage.systems/:_authToken=$CWI_NPM_TOKEN" >> .npmrc

# Create deployment file with needed variables
if [ $NODE_ENV = "production" ]; then
  echo "Generating production GAE descriptor..."
  echo "runtime: nodejs14" > app.production.yaml
  echo "service: default" >> app.production.yaml
  echo "env_variables:" >> app.production.yaml
  echo "  CWI_NPM_TOKEN: $CWI_NPM_TOKEN" >> app.production.yaml
else
  echo "Generating staging GAE descriptor..."
  echo "runtime: nodejs14" > app.staging.yaml
  echo "service: staging" >> app.staging.yaml
  echo "env_variables:" >> app.staging.yaml
  echo "  CWI_NPM_TOKEN: $CWI_NPM_TOKEN" >> app.staging.yaml
fi
