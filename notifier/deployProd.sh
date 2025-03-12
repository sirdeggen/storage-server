#!/bin/bash
gcloud functions deploy prodNotifier --gen2 --runtime=nodejs22 --env-vars-file=prod.functions.env.yaml --entry-point=notifier --timeout=540 --trigger-event=google.storage.object.finalize --trigger-resource=hashbrown.babbage.systems --memory=4096 --source .
