import pubsub, {INSTANCES_TOPIC} from '../../pubsub'

module.exports = (Instances) => (instances) => {
  for (let instName in instances) {
    const instance = instances[instName]
    Instances.update({name: instName}, instance, {upsert: true})
  }
  Instances.find({}, (err, docs) => pubsub.publish(INSTANCES_TOPIC, docs))
  
};

