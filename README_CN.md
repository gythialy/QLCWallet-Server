# QLC Wallet Server

**[English](README.md)** **[中文](README_CN.md)**

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
- 修改 PostgreSQL 密码，在 docker-compose.yml#L14 行， `POSTGRES_PASSWORD=SHOULD_BE_CHANGED`
- 修改 `wallet-server/.env`#L9 行中登录信息 `DB_PASS=SHOULD_BE_CHANGED` （需要与上一步中密码保持一致）
- 启动所有容器 `docker-compose up -d`
- 停止并删除所有容器 `docker-compose down -v`