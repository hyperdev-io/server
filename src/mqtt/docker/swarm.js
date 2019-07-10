import _ from 'lodash';
import crypto from 'crypto';
import { publishInstances } from '../../pubsub';

const md5 = data => crypto.createHash('md5').update(data).digest("hex");

export default (Instances) => (instances) => {
  const ts = Date.now();
  for (let instName in instances) {
    const instance = instances[instName];
    instance._ts = ts;
    for (let serviceName in instance.services) {
      const service = instance.services[serviceName];
      service.labels = _.mapKeys(service.labels, (value, key) => key.replace(/\./g, '_'));
    }
    const service = instance.services[Object.keys(instance.services)[0]];
    service.startedBy = {
      name: service.labels['io_hyperdev_startedby_name'],
      username: service.labels['io_hyperdev_startedby_username'],
      email: service.labels['io_hyperdev_startedby_email'],
      picture: `https://www.gravatar.com/avatar/${md5(service.labels['io_hyperdev_startedby_email'])}?d=robohash`,
    };
    Instances.update({name: instName}, {$set: instance}, {upsert: true});
  }
  Instances.remove({ $and: [{_ts: {$ne: ts}}, {state: {$ne: 'created'}}]});
  Instances.find({}, (err, docs) => publishInstances(docs));
};
