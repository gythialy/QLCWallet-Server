FROM node:alpine
LABEL LABEL="Goren G <yong.gu@qlink.mobi>"

RUN apk add --update libc6-compat \
    && rm -rf /var/cache/apk/*
# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json /app/

# If you are building your code for production
RUN npm install --only=production

# Bundle app source
COPY ./ /app/

# VOLUME [ "/app/config","/var/log/wallet-server" ]
ENV QLC_NODE_URL=http://qlc_node:29735 \
    QLC_WORK_NODE_URL=http://qlc_node:29735 \
    USE_REDIS= \
    REDIS_HOST=redis \
    DB_HOST=postgresql \
    DB_USER=qlc \
    DB_PASS=qlctest \
    DB_NAME=qlcwallet \
    DB_PORT=5432 \
    DB_PASS=pass 

EXPOSE 8888

CMD [ "npm", "start" ]