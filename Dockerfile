FROM node:9-alpine

WORKDIR /src

ADD ./dist .
ADD ./package.json .

RUN apk add --update python make gcc g++ 
RUN npm i --production

CMD ["node",  "index.js"]