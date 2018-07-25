<div align="right">Language:
<a title="Chinese" href="README_CN.md">:cn:</a>
<a title="Englisth" href="README.md">:us:</a></div>

# QLC Wallet Server

QLC Chain online wallet inspired by [Nanovault](https://nanovault.io/).

## Feature

- Brokers public communication between the wallet and the QLCChain Node.
- Websocket server that receives new blocks from the Q;CChain node and sends them in real time to the wallet ui.

## Build Instructions

### Required build tools

- Redis
- PostgreSQL
- QLCChain node

### Build and start
```
# set env
cp .env.example .env
npm install
npm start
```

## Docker

### Build docker images

```bash
cd docker
./build.sh
```

### Start docker container

```bash
docker container run -d --name qlcwallet-server \
    -p 8888:8888 \
    qlcwallet-server:latest
```

### docker-compose

- Install docker-compse
- Change PostgreSQL password in [docker-compose.yml#L14](docker/docker-compose/docker-compose.yml#L14) `POSTGRES_PASSWORD=SHOULD_BE_CHANGED`
- Change PostgreSQL login info in [wallet-server/.env#L9](docker/docker-compose/wallet-server/.env#L9) `DB_PASS=SHOULD_BE_CHANGED` (the password should be matched)
- Start all containers `docker-compose up -d`
- Stop and remove all containers `docker-compose down -v`