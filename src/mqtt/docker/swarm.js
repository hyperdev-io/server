import pubsub, {INSTANCES_TOPIC} from '../../pubsub'

module.exports = (Instances) => (instances) => {
  const ts = Date.now()
  for (let instName in instances) {
    const instance = instances[instName]
    instance._ts = ts
    Instances.update({name: instName}, instance, {upsert: true})
  }
  Instances.remove({_ts: {$ne: ts}})
  Instances.find({}, (err, docs) => pubsub.publish(INSTANCES_TOPIC, docs))
  
};

