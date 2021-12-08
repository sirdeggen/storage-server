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

# Create functions env yaml file
echo "Generating functions.env.yaml file..."
echo "NODE_ENV: $NODE_ENV" > functions.env.yaml
echo "HOSTING_DOMAIN: $HOSTING_DOMAIN" >> functions.env.yaml
echo "ROUTING_PREFIX: $ROUTING_PREFIX" >> functions.env.yaml
echo "KNEX_DB_CONNECTION: $KNEX_DB_CONNECTION" >> functions.env.yaml
echo "KNEX_DB_CLIENT: $KNEX_DB_CLIENT" >> functions.env.yaml
echo "MIGRATE_KEY: $MIGRATE_KEY" >> functions.env.yaml
echo "PRICE_PER_GB_MO: $PRICE_PER_GB_MO" >> functions.env.yaml
echo "UHRP_HOST_PRIVATE_KEY: $UHRP_HOST_PRIVATE_KEY" >> functions.env.yaml
echo "SERVER_XPRIV: $SERVER_XPRIV" >> functions.env.yaml
echo "MIN_HOSTING_MINUTES: $MIN_HOSTING_MINUTES" >> functions.env.yaml
echo "GCP_BUCKET_NAME: $GCP_BUCKET_NAME" >> functions.env.yaml
echo "GCP_PROJECT_ID: $GCP_PROJECT_ID" >> functions.env.yaml
echo "SERVER_PAYMAIL: $SERVER_PAYMAIL" >> functions.env.yaml
echo "CWI_NPM_TOKEN: $CWI_NPM_TOKEN" >> functions.env.yaml

# Create credential file
echo "Generating storage credential file..."
echo "$GCP_STORAGE_CREDS" > storage-creds.json
