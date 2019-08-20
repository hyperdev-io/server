import _ from "lodash";
import swarmHandler from "./docker/swarm";
import storageHandler from "./storage";
import {bucketHandler, bucketSizeHandler} from "./buckets";
import psmqttHandler from "./psmqtt"

const TOPIC_INSTANCES = "/bigboat/instances";
const TOPIC_BUCKETS = "/agent/storage/buckets";
const TOPIC_PSMQTT = "psmqtt/#";
const TOPIC_BUCKET_SIZE = "/agent/storage/bucket/size";
const TOPIC_STORAGE = "/agent/storage/size";
const TOPIC_LOGS = "/send_log";

const SUBSCRIBE_TO_TOPICS = [TOPIC_INSTANCES, TOPIC_BUCKETS, TOPIC_PSMQTT, TOPIC_BUCKET_SIZE, TOPIC_STORAGE];

var _mqtt;
const publishJson = (topic, json) =>
  _mqtt.publish(topic, JSON.stringify(json), { qos: 2 });

const unknownTopicHandler = topic => data =>
  console.log("received data for unknown topic", topic, data);

const selectHandler = db => topic => {
  switch (topic) {
    case TOPIC_INSTANCES: {
      return swarmHandler(db.Instances);
    }
    case TOPIC_BUCKETS: {
      return bucketHandler(db.Buckets);
    }
    case TOPIC_STORAGE: {
      return storageHandler(db.DataStores);
    }
    case TOPIC_BUCKET_SIZE: {
      return bucketSizeHandler(db.Buckets);
    }
    default: {
      if (_.startsWith(topic, "psmqtt/")) return psmqttHandler(db.Resources)(topic);
      //do nothing. logs handler placed in src/index.js
      if (_.startsWith(topic, TOPIC_LOGS)) {
        return topic => data => {};
      }
      else return unknownTopicHandler(topic);
    }
  }
};

export default (db, mqtt) => {
  _mqtt = mqtt;

  mqtt.on("message", (topic, data) => {
    selectHandler(db)(topic)(JSON.parse(data.toString()));
  });

  SUBSCRIBE_TO_TOPICS.forEach(t => _mqtt.subscribe(t));
};

export const stopInstance = data =>
  publishJson("/commands/instance/stop", data);

export const startInstance = data =>
  publishJson("/commands/instance/start", data);

export const startDownloadLogs = data =>{
  publishJson("/commands/logs/download", data)
}

export const startListenLogsInstance = data =>{
  publishJson("/commands/logs/start", data);
}

export const stopListenLogsInstance = data =>{
  publishJson("/commands/logs/stop", data);
}

export const deleteBucket = name =>
  publishJson("/commands/storage/bucket/delete", { name });

export const copyBucket = (source, destination) =>
  publishJson("/commands/storage/bucket/copy", { source, destination });
