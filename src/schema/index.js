import { makeExecutableSchema } from "graphql-tools";
import { resolvers } from "./resolvers";

export const typeDefs = `

scalar JSON
scalar DateTime

# An app is a blueprint for a running Instance
type App {
  # This is the id
  id: ID!
  name: String!
  version: String!
  dockerCompose: String!
  bigboatCompose: String!
  tags: [String!]!
}
type AppstoreApp {
  name: String!
  version: String!
  image: String!
  dockerCompose: String!
  bigboatCompose: String!
}

type AgentInfo {
  url: String!
}
type AppInfo {
  name: String!
  version: String!
}
type ContainerInfo {
  id: ID!
  name: [String!]!
  created: Float!
  node: String!
}
type ServiceInfo {
  name: String!
  fqdn: String
  ip: String
  state: String
  errors: String
  logs: [String]
  container: ContainerInfo
  ports: [String!]
}
# An instance is a running App
type Instance {
  id: ID!
  name: String!
  agent: AgentInfo
  app: AppInfo
  storageBucket: String
  startedBy: User!
  state: String
  desiredState: String
  status: String
  services(name: String): [ServiceInfo]!
}

type Bucket {
  id: ID!
  name: String!
  isLocked: Boolean!
}

type DataStore {
  id: ID!
  name: String!
  percentage: String!
  total: String
  used: String
  createdAt: DateTime
}

type CPU {
  idle: Float!
  used: Float!
  iowait: Float!
}
type Memory {
  total: Float!
  used: Float!
}
type Disk {
  total: Float!
  used: Float!
  free: Float!
}
interface Resource {
  name: String!
  lastUpdated: String!
}
type ComputeNode implements Resource {
  name: String!
  lastUpdated: String!
  cpu: CPU
  memory: Memory
  disk: Disk
}
type StorageNode implements Resource {
  name: String!
  lastUpdated: String!
  disk: Disk
}
type User {
  name: String!
  username: String!
  email: String!
  picture: String!
}
type CurrentUser {
  name: String!
  email: String!
  picture: String!
  roles: [String!]!
}

# The root query for BigBoat
type Query {
  # Returns a list of all applications
  apps: [App!]!
  # Returns a list of all instances
  instances(name: String): [Instance!]!
  buckets: [Bucket!]!
  resources: [Resource!]!
  datastores: [DataStore!]!
  appstoreApps: [AppstoreApp!]!
  currentUser: CurrentUser!
}

type Subscription {
  instances: [Instance!]!
  buckets: [Bucket!]!
  apps: [App!]!
  resources: [Resource!]!
}

input Options {
  storageBucket: String
  stateful: Boolean
}

type Mutation {
  createOrUpdateApp(
    name: String!
    version: String!
    dockerCompose: String
    bigboatCompose: String
  ) : App!
  removeApp(name: String!, version: String!): Int!
  stopInstance(name: String!): Instance!
  startInstance(name: String!, appName: String!, appVersion: String!, parameters: JSON, options: Options): Instance!
  copyBucket(sourceName: String!, destinationName: String!): Bucket!
  deleteBucket(name: String!): Int!
}

`;

module.exports = makeExecutableSchema({ typeDefs, resolvers });
