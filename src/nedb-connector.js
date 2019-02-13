import Datastore from 'nedb';

const db = {
  Instances: new Datastore(),
  Apps: new Datastore(({filename: './data/apps.db', autoload: true})),
  Accounts: new Datastore(({filename: './data/accounts.db', autoload: true})),
  AccessTokens: new Datastore(({filename: './data/tokens.db', autoload: true})),
  Buckets: new Datastore(),
  Resources: new Datastore(),
  DataStores: new Datastore(),
}

export default () => {
  return db
}
