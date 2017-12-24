import swarmHandler from './docker/swarm'
import bucketHandler from './buckets'
export default (db, mqtt) => {

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