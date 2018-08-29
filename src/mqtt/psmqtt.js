import _ from "lodash";
import { publishResources } from "../pubsub";

module.exports = Resources => topic => resources => {
  const type = topic.split("/")[1];
  const nodeName = topic.split("/")[2];
  const resource = topic.split("/")[3];
  const obj = {};
  if (resource === "cpu_percent") {
    obj.cpu = {
      used: Math.ceil(_.reduce(_.values(_.omit(resources, "idle")), _.add)),
      idle: Math.ceil(resources["idle"]),
      iowait: Math.ceil(resources["iowait"])
    };
  }
  if (resource === "virtual_memory") {
    obj.memory = { total: resources.total, used: resources.used };
  }
  if (resource === "disk_usage") {
    obj.disk = {
      total: resources.total,
      used: resources.used,
      free: resources.free
    };
  }

  obj.name = nodeName;
  obj.lastUpdated = "";
  obj.type = type;
  Resources.update({ name: nodeName }, { $set: obj }, { upsert: true });
  Resources.find({}, (err, docs) => publishResources(docs));
};
