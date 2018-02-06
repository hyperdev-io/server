const Datastore = require('nedb')

const db = {
  Instances: new Datastore(),
  Apps: new Datastore(({filename: './data/apps.db', autoload: true})),
  Buckets: new Datastore(),
  Resources: new Datastore(),
  DataStores: new Datastore(),
}

module.exports = async () => {
  return db
}
