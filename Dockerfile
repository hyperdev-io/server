FROM node:10-alpine as build

WORKDIR /src
ADD . /src

RUN apk add --no-cache --virtual .build-deps python make gcc g++ \
    && npm i \
    && npm run build \
    && apk del .build-deps

FROM node:10-alpine

WORKDIR /dist
COPY --from=build /src/dist .
COPY --from=build /src/node_modules ./node_modules

CMD ["node", "index.js"]