import _ from 'lodash'
import {publishBuckets} from '../pubsub'

export const bucketHandler = (BucketsDb) => (buckets) => {
    for (let bucket of buckets) {
        BucketsDb.update({name: bucket.name}, {$set: bucket}, {upsert: true})
    }
    BucketsDb.remove({name: {$nin: _.map(buckets, 'name')}})
    BucketsDb.find({}, (err, docs) => publishBuckets(docs))
};

export const bucketSizeHandler = (BucketsDb) => (bucketSize) => {
    BucketsDb.update({name: bucketSize.name}, {$set: bucketSize}, {upsert: true})
};

