import {publishStorage} from '../pubsub'

export default DataStores => (storage) => {
    DataStores.update({name: storage.name}, {$set: storage}, {upsert: true})
    DataStores.find({}, (err, docs) => publishStorage(docs))
};
