import _ from 'lodash'
import { publishInstances } from '../../pubsub'

export default (Instances) => (instances) => {
  const ts = Date.now();
  for (let instName in instances) {
    const instance = instances[instName];
    instance._ts = ts;
    for (let serviceName in instance.services) {
      const service = instance.services[serviceName];
      service.labels = _.toPairs(service.labels).map( ([label, value]) => ({ label, value }));
    }
    Instances.update({name: instName}, {$set: instance}, {upsert: true});
  }
  Instances.remove({ $and: [{_ts: {$ne: ts}}, {state: {$ne: 'created'}}]});
  Instances.find({}, (err, docs) => publishInstances(docs));
};
