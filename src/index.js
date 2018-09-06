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
const ldap = require('ldapjs');
const uuidv1 = require('uuid/v1');
const connectNedb = require('./nedb-connector');

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
  

  const db = await connectNedb();
  var app = express();
  app.use(cors())
  app.use(bodyParser.urlencoded({extended: true, limit: '50mb'}))
  app.post('/account/login', bodyParser.json({limit: '10kb'}), (request, response) => {
    const credentials = request.body;
    const client = ldap.createClient({ url: CFG.ldap.url });
    client.bind(CFG.ldap.adminDn, CFG.ldap.adminPassword, (err, a,b,c) => {
      response.setHeader('Content-Type', 'application/json');
      var opts = {
        filter: `(uid=${credentials.username})`,
        scope: 'sub',
        attributes: ['dn']
      };
      client.search(CFG.ldap.bindDn, opts, (err, res) => {
        const dn = [];
        res.on('searchEntry', entry => dn.push(entry.object.dn));
        res.on('end', () => {
          if(dn.length){
            client.bind(dn[0], credentials.password, function(err) {
              if( err ){
                response.status(401);
                response.end();
              } else {
                db.Accounts.findOne({dn: dn[0]}, (err, account) => {
                  if(account === null){
                    db.Accounts.insert({dn: dn[0]});
                    db.AccessTokens.insert({dn: dn[0], token: uuidv1()})
                  }
                  db.AccessTokens.findOne({dn: dn[0]}, (err, at) => {
                    response.end(JSON.stringify({token: at.token}));
                  })
                });
              }
            });
          }else{
            response.status(401);
            response.end();
          }
        });
      })

      // console.log('admin login', err, a)
    })
    // client.bind(credentials.username, credentials.password, function(err, a,b,c) {
    //   console.log('bind', err,a,b,c);
    // });

  });
  app.use('/graphql', bodyParser.json({ limit: '50mb' }), graphqlExpress({
    context: {db},
    schema,
    formatError: error => ({
      message: error.message,
      props: error.originalError && error.originalError.props,
      info: error.originalError && error.originalError.info,
      locations: error.locations,
      path: error.path,
    }),
  }));
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
    }, {
      server: server,
      path: '/subscriptions',
    });
  })
  mqttHandler(db, mqttClient)
};

start().catch( x => console.log('ERROR', x))
