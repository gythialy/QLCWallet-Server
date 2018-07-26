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

### License

 MIT Copyright (c) 2018 QLC Chain Team