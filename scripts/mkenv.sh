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
echo "ADMIN_TOKEN=$ADMIN_TOKEN" >> .env
echo "GCP_BUCKET_NAME=$GCP_BUCKET_NAME" >> .env
echo "GCP_PROJECT_ID=$GCP_PROJECT_ID" >> .env
echo "SERVER_PAYMAIL=$SERVER_PAYMAIL" >> .env
echo "CWI_NPM_TOKEN=$CWI_NPM_TOKEN" >> .env

# Create notifier functions env yaml file
echo "Generating notifier/functions.env.yaml file..."
echo "NODE_ENV: '$NODE_ENV'" > notifier/functions.env.yaml
echo "HOSTING_DOMAIN: '$HOSTING_DOMAIN'" >> notifier/functions.env.yaml
echo "GCP_BUCKET_NAME: '$GCP_BUCKET_NAME'" >> notifier/functions.env.yaml
echo "GCP_PROJECT_ID: '$GCP_PROJECT_ID'" >> notifier/functions.env.yaml
echo "ADMIN_TOKEN: '$ADMIN_TOKEN'" >> notifier/functions.env.yaml

# Create credential file
echo "Generating storage credential file..."
echo "$GCP_STORAGE_CREDS" > storage-creds.json
