import _ from 'lodash'
import {publishBuckets} from '../pubsub'

module.exports = (BucketsDb) => (buckets) => {
    for (let bucket of buckets) {        
        BucketsDb.update({name: bucket.name}, {$set: bucket}, {upsert: true})
    }    
    BucketsDb.remove({name: {$nin: _.map(buckets, 'name')}})
    BucketsDb.find({}, (err, docs) => publishBuckets(docs))
};

