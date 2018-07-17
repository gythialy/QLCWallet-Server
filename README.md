# QLC Wallet Server

QLC Chain online wallet inspired by [Nanovault](https://nanovault.io/), some code are ported from it.

**[English](README.md)** **[中文](README_CN.md)**

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
- Change PostgreSQL password in docker-compose.yml#L14 `POSTGRES_PASSWORD=SHOULD_BE_CHANGED`
- Change `wallet-server/.env`#L9 `DB_PASS=SHOULD_BE_CHANGED`
- Start all containers `docker-compose up -d`
- Stop and remove all containers `docker-compose down -v`