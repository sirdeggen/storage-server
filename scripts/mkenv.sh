#!/bin/bash

echo "Creating $1"
echo "apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: $SERVICE_NAME
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
  for (@ARGV) {
    my $val = $ENV{$_} // "";
    $val =~ s/\\/\\\\/g;      # escape backslashes
    $val =~ s/\n/\\n/g;       # escape newlines
    $val =~ s/"/\\"/g;        # escape double quotes
    say "        - name: $_\n          value: \"$val\"";
  }
' NODE_ENV \
  PRICE_PER_GB_MO \
  MIN_HOSTING_MINUTES \
  HOSTING_DOMAIN \
  ADMIN_TOKEN \
  SERVER_PRIVATE_KEY \
  GCP_STORAGE_CREDS \
  GCP_PROJECT_ID \
  GCP_BUCKET_NAME \
  HTTP_PORT >> $1

echo "Built! Contents of $1:"
cat $1
