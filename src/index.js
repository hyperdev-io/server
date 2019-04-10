import cors from 'cors'
import mqttHandler from './mqtt'
import connectNedb from './nedb-connector';
const mqtt = require('mqtt')
const express = require('express');
import { createServer } from 'http';
const bodyParser = require('body-parser');
const {graphqlExpress, graphiqlExpress} = require('apollo-server-express');
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { execute, subscribe } from 'graphql';
const schema = require('./schema');
const ldap = require('ldapjs');
const uuidv1 = require('uuid/v1');

const PORT = 3010;
const CFG = {
  mqtt: {
    url: process.env.MQTT_URL,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  },
  ldap: {
    url: process.env.LDAP_URL,
    bindDn: process.env.LDAP_BIND_DN,
    adminDn: process.env.LDAP_ADMIN_DN,
    adminPassword: process.env.LDAP_ADMIN_PASSWORD,
  }
};

const start = async () => {
  const mqttClient = mqtt.connect(CFG.mqtt.url, {
    username: CFG.mqtt.username,
    password: CFG.mqtt.password
  })

  mqttClient.on('connect', () => console.log('MQTT::Connected'))
  mqttClient.on('error', (err) => console.log('MQTT::An error occured', err))
  mqttClient.on('close', () => console.log('MQTT connection closed'))

  const getUserForToken = (token, cb) => db.AccessTokens.findOne({ token }, (err, at) => cb(at ? at.dn : false));

  const containsHeaders = (headers, ...headerNames) => headerNames.map(name => !!headers[name]).reduce((a, b) => a && b, true);
  const extractUserFromHeaderTokens = headers => {
    if(containsHeaders(headers, 'token-claim-admin', 'token-claim-email', 'token-claim-name', 'token-claim-nickname')){
      return {
        isAdmin: headers['token-claim-admin'] === 'true',
        email: headers['token-claim-email'],
        name: headers['token-claim-name'],
        username: headers['token-claim-nickname'],
      };
    }
    return null;
  };

  const authTokenMiddleware = (req, res, next) => {
    const user = extractUserFromHeaderTokens(req.headers);
    if(user){
      req.user = user;
      return next();
    }
    res.status(401);
    res.end();
  };

  // const authMiddleware = (req, res, next) => {
  //   let token;
  //   console.log('headers', req.headers)
  //   const authHeader = req.get('Authorization');
  //   if(authHeader && authHeader.split(' ')[0] === 'Bearer'){
  //     token = authHeader.split(' ')[1];
  //   }
  //   if (token) {
  //     getUserForToken(token, dn => {
  //       if(dn){
  //         console.log('token presented for user', token, dn);
  //         db.Accounts.findOne({ dn }, (err, user) => {
  //           req.user = user;
  //           next();
  //         });
  //
  //       } else {
  //         res.status(401);
  //         res.end();
  //       }
  //     })
  //   } else {
  //     res.status(401);
  //     res.end();
  //   }
  // };

  const db = connectNedb();
  var app = express();
  app.use(cors());
  app.use(bodyParser.urlencoded({extended: true, limit: '10mb'}));
  app.use('/graphql', authTokenMiddleware, bodyParser.json({ limit: '50mb' }), graphqlExpress(request => ({
    context: {db, request},
    schema,
    formatError: error => ({
      message: error.message,
      props: error.originalError && error.originalError.props,
      info: error.originalError && error.originalError.info,
      locations: error.locations,
      path: error.path,
    }),
  })));
  app.use('/graphiql', graphiqlExpress({
    endpointURL: '/api/graphql',
    subscriptionsEndpoint: `ws://localhost:8081/api/subscriptions`,
  }));
  app.use('/subscriptions', authTokenMiddleware)
  const server = createServer(app);
  server.listen(PORT, () => {
    console.log(`HyperDev GraphQL server running on port ${PORT}.`)
    new SubscriptionServer({
      execute,
      subscribe,
      schema: schema,
      onConnect: (connectionParams, webSocket) => {
        const user = extractUserFromHeaderTokens(webSocket.upgradeReq.headers);
        if(user){
          return { user };
        }
        throw new Error("Missing auth token");
      },
    }, {
      server: server,
      path: '/subscriptions',
    });
  })
  mqttHandler(db, mqttClient)
};

start().catch( x => console.log('ERROR', x))
