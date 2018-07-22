#!/bin/bash

sudo rm -rf postgresql/data
sudo rm -rf qlc_node/QLCChain/data.ldb qlc_node/QLCChain/data.ldb-lock qlc_node/QLCChain/log
sudo rm -rf traefik/acme
mkdir -p postgresql/data
mkdir -p traefik/acme && touch traefik/acme/acme.json

