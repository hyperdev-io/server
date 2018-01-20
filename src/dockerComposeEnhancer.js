import _    from 'lodash'
import yaml from 'js-yaml'

const merge = (a,b) => Object.assign({}, a, b)

const defaultLabels = (instanceName, serviceName, app) => {
    return {
        labels: {
            'bigboat.instance.name': instanceName,
            'bigboat.service.name': serviceName,
            'bigboat.service.type': 'service',
            'bigboat.application.name': app.name,
            'bigboat.application.version': app.version,
            'bigboat.startedBy': 'TBD',
        }
    }
}
const oneoffMods = (serviceName, service, bigboatService) => {
    if(_.get(bigboatService, 'type') == 'oneoff'){
        return {
            restart: service.restart || 'no',
            labels: {'bigboat.service.type': 'oneoff'}
        }
    }
    return {};
}
const storageBucketLabel = (options) => {
    return {labels: {'bigboat.storage.bucket': options.storageBucket}}
}
const endpointPathLabel = bigboatCompose => {
    if (bigboatCompose.endpoint){
         return {labels: {'bigboat.instance.endpoint.path': bigboatCompose.endpoint}}
    }
    return {}
}
const endpointProtocolLabel = bigboatCompose => {
    if (bigboatCompose.protocol){
         return {labels: {'bigboat.instance.endpoint.protocol': bigboatCompose.protocol}}
    }
    return {}
}

export const enhanceForBigBoat = (instanceName, options, app) => {
    var dockerCompose = yaml.safeLoad(app.dockerCompose)
    var bigboatCompose = yaml.safeLoad(app.bigboatCompose)
    
    dockerCompose.services = _.mapValues(dockerCompose.services, (service, serviceName) => {
        const serviceBigBoatCompose = bigboatCompose[serviceName] || {}
        return _.merge( {},
            service,
            defaultLabels(instanceName, serviceName, app),
            oneoffMods(serviceName, service, serviceBigBoatCompose),
            storageBucketLabel(options),
            endpointPathLabel(serviceBigBoatCompose),
            endpointProtocolLabel(serviceBigBoatCompose),
        )
    })
    
    return Object.assign({}, app, {dockerCompose: yaml.safeDump(dockerCompose)})
}