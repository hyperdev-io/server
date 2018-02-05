FROM node:9-alpine

WORKDIR /src

ADD ./dist .
ADD ./package.json .

RUN apk add --no-cache --virtual .build-deps python make gcc g++ \
    && npm i --production \
    && apk del .build-deps

CMD ["node",  "index.js"]