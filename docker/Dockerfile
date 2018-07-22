FROM node:alpine

RUN apk add --update libc6-compat \
    && rm -rf /var/cache/apk/*
# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json /app

# If you are building your code for production
# RUN npm install --only=production
RUN npm install --only=production

# Bundle app source
COPY ./ /app

VOLUME [ "/app/config" ]

COPY docker/docker-entry.sh /docker-entry.sh
RUN chmod +x /docker-entry.sh

EXPOSE 3000 8888 8889
CMD ["/bin/sh",  "/docker-entry.sh"]