var Promise = require('bluebird')
  , Mesh = require('happner-2')
  , Emitter = require('./lib/emitter')
  , Subscriber = require('./lib/subscriber')
  , Feed = require('./lib/feed')
  , Worker = require('./lib/worker')
  , Portal = require('./lib/portal/component')
  , Queue = require('./lib/queue')
  , Service = require('./lib/service')
  , Utilities = require('./lib/utilities')
  , async = require('async')
  ;

function ElasticFeedService(options){

  this.components = {};
}

ElasticFeedService.prototype.__parseBaseConfig = function(config){

  if (!config) config = {};

  if (!config.data) config.data = {};

  if (!config.data.port) config.data.port = 55001;

  if (!config.data.elastic_url) config.data.elastic_url = "http://localhost:9200";

  if (!config.data.dataroutes) config.data.dataroutes = [
    {
      dynamic: true,//dynamic routes generate a new index/type according to the items in the path
      pattern: "/feed/{{index}}/{{type}}/{{metric}}/{{timestamp:date}}/{{value:integer}}"
    },
    {
      pattern: "/happner-feed-system/{{type}}",
      index: "happner-feed-system"
    }
  ];

  if (!config.data.indexes) config.data.indexes = [
    {index: "happner-system"},
    {index: "happner-feed"}
  ];

  var CREDS_DATA_PASSWORD = process.env.CREDS_DATA_PASSWORD?process.env.OUTPUT_PASSWORD:CREDS_DATA_PASSWORD;

  var __happnConfig = {
    port:config.data.port,
    secure:true,
    services: {
      security:{
        adminPassword:CREDS_DATA_PASSWORD
      },
      data: {
        config: {
          datastores: [
            {
              name: 'happner-elastic-feed',
              provider: 'happner-elastic-dataprovider',
              settings: {
                host: config.data.url,
                indexes: config.data.indexes,
                dataroutes: config.data.dataroutes
              }
            },
            {
              name: 'local-store',
              isDefault: true
            }
          ]
        }
      }
    }
  };

  var config = {
    name: 'happner-elastic-feed',
    happn: __happnConfig,
    modules: {
      "service": {
        instance: new Service(config.service)
      },
      "feed": {
        instance: new Feed(config.feed)
      },
      "worker": {
        instance: new Worker(config.worker)
      },
      "utilities": {
        instance: new Utilities(config.utilities)
      }
    },
    components:{
      "service":{
        startMethod: "initialize"
      },
      "feed":{
        startMethod: "initialize"
      },
      "worker":{
        startMethod: "initialize"
      },
      "utilities": {}
    // },
    // endpoints:{
    //   "happner-elastic-feed-in": {
    //     config: {
    //       port: config.input.port,
    //       username: '_ADMIN',
    //       password: CREDS_INPUT_PASSWORD
    //     }
    //   }
    }
  };

  return config;
};

ElasticFeedService.prototype.__parseEmitterConfig = function(config){

  if (!config) config = this.__parseBaseConfig();

  if (config.modules.queue == null && !config.queue) config.queue = {
    name: "happner-elastic-queue",
    happn: {
      host:'localhost',
      port: 55000,
      secure:true,
      user:'_ADMIN',
      password:'happn'
    }
  };

  config.modules.emitter = {instance: new Emitter(config.emitter)};

  config.components.emitter = {
    startMethod: "initialize"
  };

  if (config.queue) config.endpoints[config.queue.name] = {config:config.queue.happn};

  return config;
};

ElasticFeedService.prototype.__parseWorkerConfig = function(config){

  if (!config) config = this.__parseBaseConfig();

  if (config.modules.queue == null && !config.queue) config.queue = {
    name: "happner-elastic-queue",
    happn: {
      host:'localhost',
      port: 55000,
      secure:true,
      user:'_ADMIN',
      password:'happn'
    }
  };

  config.modules.emitter = {instance: new Emitter(config.emitter)};

  config.components.emitter = {
    startMethod: "initialize"
  };

  if (config.queue) config.endpoints[config.queue.name] = {config:config.queue.happn};

  return config;
};

ElasticFeedService.prototype.__parseQueueConfig = function(config){

  if (!config) config = this.__parseBaseConfig();

  config.modules.queue = {instance: new Queue(config.queue)};

  config.components.queue = {
    startMethod: "initialize"
  };

  return config;
};

ElasticFeedService.prototype.__parsePortalConfig = function(config){

  if (!config) config = this.__parseBaseConfig();

  config.modules.portal = {instance: new Portal(config.portal)};

  config.components.portal = {
    startMethod: "initialize"
  };

  return config;
};


ElasticFeedService.prototype.__parseSubscriberConfig = function(config){

  if (!config) config = this.__parseBaseConfig();

  var CREDS_SUBSCRIBER_PASSWORD = process.env.CREDS_SUBSCRIBER_PASSWORD?process.env.CREDS_SUBSCRIBER_PASSWORD:CREDS_SUBSCRIBER_PASSWORD;

  if (!config.subscriber) {
    config.subscriber = {port:55000, password:CREDS_SUBSCRIBER_PASSWORD};
  }

  config.modules.subscriber = {instance: new Subscriber(config.subscriber)};

  config.components.subscriber = {
    startMethod: "initialize"
  };

  return config;
};

ElasticFeedService.prototype.__appendComponent = function(config, callback){

  var _this = this;

  async.eachSeries(Object.keys(config.components), function(componentName, componentNameCB){

    if (_this.__mesh._mesh.elements[componentName] != null) return componentNameCB();

    _this.__mesh._createElement({
      module: {
        name:componentName,
        config:{
          instance:config.modules[componentName].instance
        }
      },
      component: {
        name:componentName,
        config: config.components[componentName]
      }
    })
    .then(function(){

      _this.components[componentName] = config.modules[componentName].instance;
    })
    .catch(componentNameCB);

  }, callback);
};

ElasticFeedService.prototype.__initializeMesh = function(config, callback){

  var _this = this;

  if (_this.__mesh == null) {

    return Mesh.create(config, function (err, instance) {

      if (err) return callback(err);

      _this.__mesh = instance;

      callback();
    });
  }

  _this.__appendComponent(config, callback);
};

ElasticFeedService.prototype.SERVICE_TYPE = {
  QUEUE:0,
  PORTAL:1,
  WORKER:2,
  SUBSCRIBER:3
};

ElasticFeedService.prototype.__activateService = function(type, config, callback){

  try{

    var baseConfig = this.__parseBaseConfig(config);

    var typeConfig;

    if (type == this.SERVICE_TYPE.QUEUE) typeConfig = this.__parseQueueConfig(baseConfig);

    if (type == this.SERVICE_TYPE.PORTAL) typeConfig = this.__parsePortalConfig(baseConfig);

    if (type == this.SERVICE_TYPE.WORKER) typeConfig = this.__parseEmitterConfig(baseConfig);

    if (type == this.SERVICE_TYPE.SUBSCRIBER) typeConfig = this.__parseSubscriberConfig(baseConfig);

    return this.__initializeMesh(typeConfig, callback);

  }catch(e){
    callback(e);
  }
};

ElasticFeedService.prototype.queue = function(config){

  var _this = this;

  return new Promise(function(resolve, reject){

      _this.__activateService(_this.SERVICE_TYPE.QUEUE, config, function(e){
        if (e) return reject(e);
        resolve(_this);
      });
  });
};

ElasticFeedService.prototype.emitter = function(config){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.__activateService(_this.SERVICE_TYPE.WORKER, config, function(e){
      if (e) return reject(e);
      resolve(_this);
    });
  });
};

ElasticFeedService.prototype.subscriber = function(config){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.__activateService(_this.SERVICE_TYPE.SUBSCRIBER, config, function(e){
      if (e) return reject(e);
      resolve(_this);
    });
  });
};

ElasticFeedService.prototype.portal = function(config){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.__activateService(_this.SERVICE_TYPE.PORTAL, config, function(e){
      if (e) return reject(e);
      resolve(_this);
    });
  });
};

ElasticFeedService.prototype.stop = function(opts, callback){

  if (typeof opts == 'function') {
    callback = opts;
    opts = {};
  }

  if (!opts) opts = {};

  return this.__mesh.stop(opts, callback);
};


module.exports = ElasticFeedService;