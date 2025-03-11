#!/bin/bash

echo "Creating $1"
echo "apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: $SERVICE
spec:
  template:
    spec:
      timeoutSeconds: 3540
      containers:
      - image: $IMAGE
        ports:
        - name: h2c
          containerPort: 8080
        env:" > $1

echo "Appending environment variables to $1"
perl -E'
  say "        - name: $_
          value: \x27$ENV{$_}\x27" for @ARGV;
' NODE_ENV \
    PRICE_PER_GB_MO \
    MIN_HOSTING_MINUTES \
    HOSTING_DOMAIN \
    ADMIN_TOKEN \
    SERVER_PRIVATE_KEY \
    GCP_STORAGE_CREDS \
    GCP_PROJECT_ID \
    GCP__NAME \
    STORAGE_URL \
    HTTP_PORT >> $1

echo "Built! Contents of $1:"
cat $1
