#!/bin/bash
echo "Generating .env file..."
echo "NODE_ENV=$NODE_ENV" > .env
echo "ROUTING_PREFIX=$ROUTING_PREFIX" >> .env
echo "KNEX_DB_CONNECTION=$KNEX_DB_CONNECTION" >> .env
echo "KNEX_DB_CLIENT=$KNEX_DB_CLIENT" >> .env
echo "MIGRATE_KEY=$MIGRATE_KEY" >> .env
echo "PRICE_PER_GB_MO=$PRICE_PER_GB_MO" >> .env
echo "UHRP_HOST_PRIVATE_KEY=$UHRP_HOST_PRIVATE_KEY" >> .env
echo "MIN_HOSTING_MINUTES=$MIN_HOSTING_MINUTES" >> .env
echo "GCP_BUCKET_NAME=$GCP_BUCKET_NAME" >> .env
echo "GCP_PROJECT_ID=$GCP_PROJECT_ID" >> .env

echo "Generating storage credential file..."
echo "$GCP_STORAGE_CREDS" > storage-creds.json
