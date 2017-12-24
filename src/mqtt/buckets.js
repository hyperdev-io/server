import _ from 'lodash'
import pubsub, {BUCKETS_TOPIC} from '../pubsub'

module.exports = (BucketsDb) => (buckets) => {
    for (let bucket of buckets) {        
        BucketsDb.update({name: bucket.name}, {$set: bucket}, {upsert: true})
    }    
    BucketsDb.remove({name: {$nin: _.map(buckets, 'name')}})
    BucketsDb.find({}, (err, docs) => pubsub.publish(BUCKETS_TOPIC, docs))
};

