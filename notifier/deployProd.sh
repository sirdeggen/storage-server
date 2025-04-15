#!/bin/bash
set -euo pipefail

GCP_BUCKET_NAME=$1
echo "Deploying prodNotifier to bucket: $GCP_BUCKET_NAME"

gcloud functions deploy prodNotifier \
  --gen2 \
  --runtime=nodejs22 \
  --env-vars-file=prod.functions.env.yaml \
  --entry-point=notifier \
  --timeout=540 \
  --region=us-central1 \
  --trigger-event=google.storage.object.finalize \
  --trigger-resource=$GCP_BUCKET_NAME \
  --memory=4096 \
  --source .
