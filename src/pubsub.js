import { PubSub } from 'graphql-subscriptions';

const INSTANCES_TOPIC        = 'instances_topic'
const BUCKETS_TOPIC          = 'buckets_topic'
const APPS_TOPIC             = 'apps_topic'

const pubsub = new PubSub()
const publish = topic => data => pubsub.publish(topic, data)

export const publishInstances = publish(INSTANCES_TOPIC)
export const publishBuckets = publish(BUCKETS_TOPIC)
export const publishApps = publish(APPS_TOPIC)

export const instancesAsyncIterator = () => pubsub.asyncIterator(INSTANCES_TOPIC)
export const bucketsAsyncIterator = () => pubsub.asyncIterator(BUCKETS_TOPIC)
export const appsAsyncIterator = () => pubsub.asyncIterator(APPS_TOPIC)