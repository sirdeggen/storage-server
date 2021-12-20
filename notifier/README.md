# NanoStore Notifier

This is a simple Google Cloud Function that is triggered whenever a new object is finalized in the Cloud Storage bucket.

The function calculates the hash of the new object, determines which storage contract it relates to (based on the Object ID), and then calls the HTTP route that makes a UHRP advertisement.
