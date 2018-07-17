#!/bin/bash

cd /app

if [ -f "/app/config/.env" ]; then
    echo "find mount config use it."
    cp "/app/config/.env" "/app/.env"
else
    echo 'can not find any config, use default'
    cp /app/.env.example /app/.env
fi

npm start
