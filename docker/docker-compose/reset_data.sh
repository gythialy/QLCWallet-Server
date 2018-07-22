#!/bin/bash

sudo rm -rf postgresql/data/*
sudo rm -rf qlc_node/QLCChain/data.ldb qlc_node/QLCChain/data.ldb-lock qlc_node/QLCChain/log

if [ -d traefik/acme/ ]; then
    sudo rm -rf traefik/acme/*
else
    mkdir -p traefik/acme/
fi

if [ ! -f traefik/acme/acme.json ]; then
    touch traefik/acme/acme.json
fi

if [ -d wallet-server/logs ]; then
    sudo rm -f wallet-server/logs/*
else
    mkdir -p wallet-server/logs
    echo 'create folder >> wallet-server/logs'
fi

