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

  const getUserForToken = (token, cb) => db.AccessTokens.findOne({ token }, (err, at) => cb(at ? at.dn : false));

  const authMiddleware = (req, res, next) => {
    let token;
    const authHeader = req.get('Authorization');
    if(authHeader && authHeader.split(' ')[0] === 'Bearer'){
      token = authHeader.split(' ')[1];
    }
    if (token) {
      getUserForToken(token, userDn => {
        if(userDn){
          console.log('token presented for user', token, userDn);
          next();
        } else {
          res.status(401);
          res.end();
        }
      })
    } else {
      res.status(401);
      res.end();
    }
  };

  const db = await connectNedb();
  var app = express();
  app.use(cors())
  app.use(bodyParser.urlencoded({extended: true, limit: '10mb'}));
  app.post('/account/login', bodyParser.json({limit: '10kb'}), (request, response) => {
    const credentials = request.body;
    if(!credentials.username || !credentials.password){
      response.status(401);
      response.end();
      return;
    }
    const client = ldap.createClient({ url: CFG.ldap.url });
    client.bind(CFG.ldap.adminDn, CFG.ldap.adminPassword, (err, a,b,c) => {
      response.setHeader('Content-Type', 'application/json');
      var opts = {
        filter: `(uid=${credentials.username})`,
        scope: 'sub',
        attributes: ['dn', 'cn', 'uid', 'mail']
      };
      client.search(CFG.ldap.bindDn, opts, (err, res) => {
        const entries = [];
        res.on('searchEntry', entry => entries.push(entry) );
        res.on('end', () => {
          if(entries.length){
            const user = entries[0].object
            console.log('ldap user found', user)
            client.bind(user.dn, credentials.password, function(err) {
              if( err ){
                response.status(401);
                response.end();
              } else {
                db.Accounts.findOne({dn: user.dn}, (err, account) => {
                  if(account === null){
                    db.Accounts.insert({dn: user.dn, mail: user.mail, name: user.cn.length ? user.cn[0] : user.cn});
                    db.AccessTokens.insert({dn: user.dn, token: uuidv1()})
                  } else {
                    console.log('ACCOUNT !!!', account)
                    db.Accounts.update({dn: user.dn}, {$set: {mail: user.mail, name: user.cn.length ? user.cn[0] : user.cn}});
                  }
                  db.AccessTokens.findOne({dn: user.dn}, (err, at) => {
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
  app.use('/graphql', authMiddleware, bodyParser.json({ limit: '50mb' }), graphqlExpress({
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
  app.use('/subscriptions', authMiddleware)
  const server = createServer(app);
  server.listen(PORT, () => {
    console.log(`HyperDev GraphQL server running on port ${PORT}.`)
    new SubscriptionServer({
      execute,
      subscribe,
      schema: schema,
      onConnect: (connectionParams, webSocket) => {
        console.log("connectionParams", connectionParams)
        if(connectionParams.token){
          return new Promise((resolve, reject) => {
            getUserForToken(connectionParams.token, userDn => {
              if(userDn)
                resolve({user: userDn});
              else reject();
            })
          });
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
