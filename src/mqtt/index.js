import swarmHandler from './docker/swarm'
import bucketHandler from './buckets'

var _mqtt;
const publishJson = (topic, json) => _mqtt.publish(topic, JSON.stringify(json), { qos: 2})

export default (db, mqtt) => {
    _mqtt = mqtt

    const handlers = {}
    const subscribe = (topicName, handler) => {
        handlers[topicName] = handler
        mqtt.subscribe(topicName);
    }
    mqtt.on('message', (topic, data) => handlers[topic](JSON.parse(data.toString())))

    const publish = (topic, msg, options = {}) => mqtt.publish(topic, JSON.stringify(msg), options)

    subscribe('/bigboat/instances', swarmHandler(db.Instances))
    subscribe('/agent/storage/buckets', bucketHandler(db.Buckets))

}

export const stopInstance = (data) => publishJson('/commands/instance/stop', data)

export const startInstance = (data) => publishJson('/commands/instance/start', data)

export const deleteBucket = (name) => publishJson('/commands/storage/bucket/delete', {name})
