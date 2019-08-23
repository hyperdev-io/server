import _ from "lodash";
import GraphQLJSON from "graphql-type-json";
import fetch from "node-fetch";
import yaml from "js-yaml";
import crypto from 'crypto';
import pubsub, {
  instancesAsyncIterator,
  bucketsAsyncIterator,
  appsAsyncIterator,
  resourcesAsyncIterator,
  publishApps,
  publishInstances,
  publishBuckets
} from "../pubsub";
import { stopInstance, startInstance, deleteBucket, copyBucket } from "../mqtt";
import { enhanceForHyperDev } from "../dockerComposeEnhancer";
import {AppDoesNotExistError, InvalidInstanceNameError} from './errors';
const { GraphQLDateTime } = require("graphql-iso-date");
const APPSTORE_URL =
  "https://raw.githubusercontent.com/bigboat-io/appstore/master/apps.yml";

const md5 = data => crypto.createHash('md5').update(data).digest("hex");

const pFindAll = (db, filter = {}) =>
  new Promise((resolve, reject) =>
    db.find(filter, (err, docs) => resolve(docs))
  );

export const resolvers = {
  JSON: GraphQLJSON,
  DateTime: GraphQLDateTime,
  Query: {
    apps: async (root, args, context) => pFindAll(context.db.Apps),
    instances: async (root, args, context) =>
      pFindAll(context.db.Instances, args),
    buckets: async (root, args, context) => pFindAll(context.db.Buckets),
    resources: async (root, args, context) => pFindAll(context.db.Resources),
    datastores: async (root, args, context) => pFindAll(context.db.DataStores),
    appstoreApps: async (root, args, context) => {
      return fetch(APPSTORE_URL)
        .then(res => res.text())
        .then(text => yaml.safeLoad(text));
    },
    currentUser: (root, args, context) => {
      return {
        name: context.request.user.name,
        email: context.request.user.email,
        picture: `https://www.gravatar.com/avatar/${md5(context.request.user.email)}?d=robohash`,
        roles: context.request.user.roles
      }
    }
  },
  Resource: {
    __resolveType(obj, context, info) {
      if (obj.type === "compute") {
        return "ComputeNode";
      } else if (obj.type === "storage") {
        return "StorageNode";
      }
      return null;
    }
  },
  App: {
    id: app => app._id
  },
  Instance: {
    id: instance => instance._id,
    services: (instance, args) => {
      return Object.keys(instance.services)
        .filter(
          serviceName =>
            Object.keys(args).length != 0 ? args.name === serviceName : true
        )
        .map(key => Object.assign({ name: key }, instance.services[key]));
    }
  },
  Bucket: {
    id: b => b._id
  },
  DataStore: {
    id: ds => ds._id
  },
  ServiceInfo: {
    logs: async si => {
      const logs = await fetch(si.logs["follow1000"]);
      const lines = await logs.text();
      return lines.split("\n").map(l => l.slice(8));
    }
  },
  ContainerInfo: container => {
    return container;
  },
  Subscription: {
    instances: {
      resolve: (payload, args, context, info) => payload,
      subscribe: () => instancesAsyncIterator()
    },
    buckets: {
      resolve: (payload, args, context, info) => payload,
      subscribe: () => bucketsAsyncIterator()
    },
    apps: {
      resolve: (payload, args, context, info) => payload,
      subscribe: () => appsAsyncIterator()
    },
    resources: {
      resolve: (payload, args, context, info) => payload,
      subscribe: () => resourcesAsyncIterator()
    },
  },
  Mutation: {
    createOrUpdateApp: async (root, data, { db: { Apps } }) => {
      const bigboatCompose = yaml.safeLoad(data.bigboatCompose);
      data.tags = bigboatCompose.tags || [];
      return new Promise((resolve, reject) => {
        Apps.update(
          _.pick(data, "name", "version"),
          { $set: data },
          { upsert: true, returnUpdatedDocs: true },
          (err, numDocs, doc) => resolve(doc)
        );
        pFindAll(Apps).then(docs => publishApps(docs));
      });
    },
    removeApp: async (root, data, { db: { Apps } }) => {
      return new Promise((resolve, reject) => {
        Apps.remove(_.pick(data, "name", "versi33on"), {}, (err, numRemoved) => {
          resolve(numRemoved);
          pFindAll(Apps).then(docs => publishApps(docs));
        });
      });
    },
    startInstance: async (root, data, { db: { Instances, Apps }, request: { user } }) => {
      console.log("startInstance", data, user);
      console.log(user)
      const regex = /^(?:[A-Za-z0-9][A-Za-z0-9\-]{0,30}[A-Za-z0-9]|[A-Za-z0-9])$/
      return new Promise((resolve, reject) => {
        if(!data.name.match(regex)){
          return reject(new InvalidInstanceNameError({name: data.name, regex: `${regex}`}));
        }
        Apps.findOne(
          { name: data.appName, version: data.appVersion },
          (err, doc) => {
            if (doc == null) {
              return reject(new AppDoesNotExistError(data));
            }
            const options =
              data.options && Object.keys(data.options).length > 0
                ? data.options
                : { storageBucket: data.name };
            const app = enhanceForHyperDev(data.name, options, doc, user);
            console.log('enhanced', app)
            Instances.update(
              {name: data.name},
              {
                name: data.name,
                storageBucket: options.storageBucket,
                startedBy: { picture: '', ...user},
                state: "created",
                desiredState: "running",
                status: "Request sent to agent",
                app: app,
                services: []
              },
              {upsert: true, returnUpdatedDocs: true},
              (err, numAffected, affectedDocuments, upsert) => {
                startInstance({
                  app: app,
                  instance: {
                    name: data.name,
                    options: options
                  }
                });
                pFindAll(Instances).then(docs => publishInstances(docs));
                resolve(affectedDocuments);
              }
            );
          }
        );
      });
    },
    stopInstance: async (root, data, { db: { Instances } }) => {
      return new Promise((resolve, reject) => {
        const updateFields = {
          desiredState: "stopped",
          status: "Instance stop is requested",
          stoppedBy: 0 //ToDo: record actual user
        };
        Instances.update(
          _.pick(data, "name"),
          { $set: updateFields },
          { returnUpdatedDocs: true },
          (err, numDocs, doc) => {
            if (doc) {
              const body = {
                app: {
                  name: doc.app.name,
                  version: doc.app.version,
                  definition: "??",
                  bigboatCompose: "??"
                },
                instance: {
                  name: doc.name,
                  options: {}
                }
              };
              console.log("POST body", body);
              stopInstance(body);
              resolve(doc);
            } else reject(`Instance ${data.name} does not exist`);
          }
        );
      });
    },
    deleteBucket: async (root, data, { db: { Buckets } }) => {
      Buckets.update(
        { name: data.name },
        { $set: { isLocked: true } },
        (err, numDocs) => {
          pFindAll(Buckets).then(docs => publishBuckets(docs));
        }
      );
      deleteBucket(data.name);
      return 1;
    },
    copyBucket: async (root, data, { db: { Buckets } }) => {
      return new Promise((resolve, reject) => {
        Buckets.update(
          { name: data.sourceName },
          { $set: { isLocked: true } },
          (err, numDocs) => {
            Buckets.insert(
              { name: data.destinationName, isLocked: true },
              (err, newDoc) => {
                copyBucket(data.sourceName, data.destinationName);
                resolve(newDoc);
              }
            );
          }
        );
      });
    }
  }
};
