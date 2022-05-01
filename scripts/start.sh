#!/bin/bash
until nc -z -v -w30 nanostore-mysql 3114
do
  echo "Waiting for database connection..."
  sleep 1
done
knex migrate:latest
npm run dev