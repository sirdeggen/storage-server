#!/bin/bash
gcloud functions deploy prodNotifier --gen2 --runtime=nodejs22 --env-vars-file=prod.functions.env.yaml --entry-point=notifier --timeout=540 --region=us-central1 --trigger-event=google.storage.object.finalize --trigger-location=us --trigger-resource=${env.GCP_BUCKET_NAME}
 --memory=4096 --source .
