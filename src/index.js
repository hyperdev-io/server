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


const connectNedb = require('./nedb-connector');

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
  app.use(bodyParser.urlencoded({extended: true, limit: '50mb'}))
  app.use('/graphql', bodyParser.json({ limit: '50mb' }), graphqlExpress({
    context: {db},
    schema
  }));
  app.use('/graphiql', graphiqlExpress({
    endpointURL: '/graphql',
    subscriptionsEndpoint: `ws://localhost:${PORT}/subscriptions`,
  }));
  const server = createServer(app);
  server.listen(PORT, () => {
    console.log(`Hackernews GraphQL server running on port ${PORT}.`)
    new SubscriptionServer({
      execute,
      subscribe,
      schema: schema,
    }, {
      server: server,
      path: '/subscriptions',
    });
  })
  // app.listen(PORT, () => {
  // });

  mqttHandler(db, mqttClient)
};

start().catch( x => console.log('ERROR', x))
