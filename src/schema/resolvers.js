import GraphQLJSON from 'graphql-type-json';
import pubsub, {INSTANCES_TOPIC} from '../pubsub'
const {
  GraphQLDateTime
} = require('graphql-iso-date');

const pFindAll = (db) =>  {
  return new Promise((resolve, reject) => {
    db.find({}, (err, docs) => resolve(docs))
  })
}

export const resolvers = {
  JSON: GraphQLJSON,
  DateTime: GraphQLDateTime,
  Query: {
    apps: (root, args, context) => pFindAll(context.db.Apps),
    instances: async (root, args, context) => pFindAll(context.db.Instances),
    buckets: (root, args, context) => pFindAll(context.db.Buckets),
    resources: (root, args, context) => pFindAll(context.db.Resources),
    datastores: (root, args, context) => pFindAll(context.db.DataStores),
    appstoreApps: (root, args, context) => pFindAll(context.db.AppstoreApps),
  },
  App: {
    id: app => app._id
  },
  Instance: {
    id: instance => instance._id,
    services: instance => Object.keys(instance.services).map(key => Object.assign({name: key}, instance.services[key])),
  },
  Bucket: {
    id: b => b._id,
  },
  Resource: {
    id: r => r._id,
  },
  DataStore: {
    id: ds => ds._id,
  },
  LogsInfo: {
    n200: logs => logs['200'],
    n500: logs => logs['500'],
    n1000: logs => logs['1000'],
  },
  ContainerInfo: container => {console.log('cntr', container); return container},
  Subscription: {
    instances: {
      resolve: (payload, args, context, info) => {
        // Manipulate and return the new value
        console.log('paylo', payload);
        payload.id = 1
        return payload
      },
      subscribe: () => pubsub.asyncIterator(INSTANCES_TOPIC),
    },
  }
}
