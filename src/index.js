import cors from 'cors'
import mqttHandler from './mqtt'
const mqtt = require('mqtt')
const express = require('express');
import { createServer } from 'http';
const bodyParser = require('body-parser');
const {graphqlExpress, graphiqlExpress} = require('apollo-server-express');
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { execute, subscribe } from 'graphql';
const schema = require('./schema');
const jwt = require('express-jwt');
const jwtAuthz = require('express-jwt-authz');
const jwksRsa = require('jwks-rsa');
const jwt_decode = require('jwt-decode');



const connectNedb = require('./nedb-connector');

const checkJwt = jwt({
    // Dynamically provide a signing key
    // based on the kid in the header and
    // the signing keys provided by the JWKS endpoint.
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://hyperdev.eu.auth0.com/.well-known/jwks.json`
    }),

    // Validate the audience and the issuer.
    audience: '',
    issuer: `https://hyperdev.eu.auth0.com/`,
    algorithms: ['RS256']
});


const PORT = 3010;
const CFG = {
  mqtt: {
    url: process.env.MQTT_URL,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  }
}

const start = async () => {
  const mqttClient = mqtt.connect(CFG.mqtt.url, {
    username: CFG.mqtt.username,
    password: CFG.mqtt.password
  })

  mqttClient.on('connect', () => console.log('MQTT::Connected'))
  mqttClient.on('error', (err) => console.log('MQTT::An error occured', err))
  mqttClient.on('close', () => console.log('MQTT connection closed'))
  

  const db = await connectNedb();
  var app = express();
  app.use(cors())
  app.use(checkJwt)
  app.use(bodyParser.urlencoded({extended: true, limit: '50mb'}))
  app.use('/graphql', bodyParser.json({ limit: '50mb' }), graphqlExpress( request => ({
    context: {db, request},
    schema
  })));
  app.use('/graphiql', graphiqlExpress({
    endpointURL: '/graphql',
    subscriptionsEndpoint: `ws://localhost:8080/api/subscriptions`,
  }));
  const server = createServer(app);
  server.listen(PORT, () => {
    console.log(`Hackernews GraphQL server running on port ${PORT}.`)
    new SubscriptionServer({
      execute,
      subscribe,
      schema: schema,
      onConnect: (connectionParams, webSocket) => {
        console.log("connectionParams", connectionParams)
        if(connectionParams.token){
            return { user: jwt_decode(connectionParams.token) }
        }
        throw new Error("Missing auth token")
      },
    }, {
      server: server,
      path: '/subscriptions',
    });
  })
  mqttHandler(db, mqttClient)
};

start().catch( x => console.log('ERROR', x))
