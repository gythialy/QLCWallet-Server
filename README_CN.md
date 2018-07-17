# QLC Wallet Server

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
