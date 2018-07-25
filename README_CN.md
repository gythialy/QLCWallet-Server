<div align="right">Language: 
<a title="Chinese" href="README_CN.md">:cn:</a>
<a title="Englisth" href="README.md">:us:</a></div>

# QLC Wallet Server

---
QLC Chain 在线钱包，部分设计参考至 [Nanovault](https://nanovault.io/)。

## 特点

- 代理钱包与 QLC 链直接的 RPC 请求，为移动端设备提供 PoW 算力支持
- Websocket 服务在收到 QLC 链上块的同时会即时推送给相关钱包用户，提高相应速度

## 编译

### 依赖项

- Redis
- PostgreSQL
- QLCChain node

### 编译启动
```
# 设置 .env 中变量，可参考 `.env.example`
cp .env.example .env
npm install
npm start
```

## Docker

### 编译 Docker 镜像

```bash
cd docker
./build.sh
```

### 启动 Docker 容器

```bash
docker container run -d --name qlcwallet-server \
    -p 8888:8888 \
    qlcwallet-server:latest
```

### 通过 docker-compose 启动

- 安装 docker-compse
- 修改 PostgreSQL 密码，在 [docker-compose.yml#L14](docker/docker-compose/docker-compose.yml#L14)行， `POSTGRES_PASSWORD=SHOULD_BE_CHANGED`
- 修改 [wallet-server/.env#L9](docker/docker-compose/wallet-server/.env#L9) 行中登录信息 `DB_PASS=SHOULD_BE_CHANGED` （需要与上一步中密码保持一致）
- 启动所有容器 `docker-compose up -d`
- 停止并删除所有容器 `docker-compose down -v`