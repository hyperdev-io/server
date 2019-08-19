import cors from 'cors'
import mqttHandler from './mqtt'
import { startListenLogsInstance, stopListenLogsInstance } from "./mqtt";
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
    if(containsHeaders(headers, 'token-claim-roles', 'token-claim-email', 'token-claim-name', 'token-claim-nickname')){
      return {
        name: headers['token-claim-name'],
        username: headers['token-claim-nickname'],
        email: headers['token-claim-email'],
        roles: headers['token-claim-roles'].split(','),
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

  app.use('/event-stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    let sessionId = uuidv1();
    let messageId = 0;
    let serviceFullName = req.query.serviceName + '/' + sessionId;
    mqttClient.subscribe("/send_log/" + serviceFullName);

    // prevent frontend part from closing connection
    let heartbeat = setInterval(() => {
      res.write(`event: ping\n`);
      res.write(`data: ping\n\n`);
    }, 10000);

    mqttClient.on("message", (topic, data) => {
      if (topic==="/send_log/" + serviceFullName){
        var message = data.toString('utf8');
        message = message.substring(1, message.length - 1);
        res.write(`id: ${messageId}\n`);
        res.write(`data: ${message}\n\n`);
        messageId += 1;
      }
    });

    startListenLogsInstance({serviceName: req.query.serviceName, serviceFullName: serviceFullName});

    req.on('close', () => {
      clearInterval(heartbeat);
      mqttClient.unsubscribe("/send_log/"+serviceFullName)
      stopListenLogsInstance({serviceFullName: serviceFullName});
    });

  });

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

start().catch( x => console.log('ERROR', x));
