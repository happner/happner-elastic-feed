var Promise = require('bluebird')
  , Mesh = require('happner-2')
  , Worker = require('./lib/worker')
  , Feed = require('./lib/feed')
  , Portal = require('./lib/portal/component')
  , Queue = require('./lib/queue')
  , Service = require('./lib/service')
  , Utilities = require('./lib/utilities')
  ;

function ElasticFeedService(options){

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
      "utilities": {
        instance: new Utilities(config.utilities)
      },
      "queue": {
        instance: new Queue(config.queue)
      }
    },
    components:{
      "service":{
        startMethod: "initialize"
      },
      "feed":{
        startMethod: "initialize"
      },
      "utilities": {},
      "queue":{
        startMethod: "initialize"
      }
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

ElasticFeedService.prototype.__parseWorkerConfig = function(config){

  if (!config) config = this.__parseBaseConfig();

  config.modules.worker = {instance: new Worker(config.worker)};

  config.components.worker = {
    startMethod: "initialize"
  };

  return config;
};

ElasticFeedService.prototype.__parseQueueConfig = function(config){

  if (!config) config = this.__parseBaseConfig();

  config.modules.queue = {instance: new Queue(config.worker)};

  config.components.queue = {
    startMethod: "initialize"
  };

  return config;
};

ElasticFeedService.prototype.__parsePortalConfig = function(config){

  if (!config) config = this.__parseBaseConfig();

  config.modules.portal = {instance: new Portal(config.worker)};

  config.components.portal = {
    startMethod: "initialize"
  };

  return config;
};


ElasticFeedService.prototype.__parseWorkerConfig = function(config){

  if (!config) config = this.__parseBaseConfig();

  config.modules.worker = {instance: new Worker(config.worker)};

  config.components.worker = {
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

ElasticFeedService.prototype.workerMesh = function(config, existing){

  var _this = this;

  return new Promise(function(resolve, reject){

    try{

      var baseConfig = _this.__parseBaseConfig(config);

      var workerConfig = _this.__parseWorkerConfig(baseConfig);

      if (existing){

        return existing._createElement({
            module: workerConfig.modules.worker,
            component: workerConfig.components.worker
          })
          .then(function () {
            resolve(existing)
          })
          .catch(reject);
      }

      Mesh.create(workerConfig, function (err, instance) {

        if (err) return reject(err);

        resolve(instance);
      });

    }catch(e){
      return reject(e);
    }
  });
};

ElasticFeedService.prototype.subscriberMesh = function(config, existing){

  var _this = this;

  return new Promise(function(resolve, reject){

    try{

      var baseConfig = _this.__parseBaseConfig(config);

      var subscriberConfig = _this.__parseWorkerConfig(baseConfig);

      if (existing){

        return existing._createElement({
            module: subscriberConfig.modules.subscriber,
            component: subscriberConfig.components.subscriber
          })
          .then(function () {
            resolve(existing)
          })
          .catch(reject);
      }

      Mesh.create(subscriberConfig, function (err, instance) {

        if (err) return reject(err);

        resolve(instance);
      });

    }catch(e){
      return reject(e);
    }
  });
};

ElasticFeedService.prototype.queueMesh = function(config, existing){

  var _this = this;

  return new Promise(function(resolve, reject){

    try{

      var baseConfig = _this.__parseBaseConfig(config);

      var queueConfig = _this.__parseQueueConfig(baseConfig);

      if (existing){

        return existing._createElement({
            module: queueConfig.modules.queue,
            component: queueConfig.components.queue
          })
          .then(function () {
            resolve(existing)
          })
          .catch(reject);
      }

      Mesh.create(queueConfig, function (err, instance) {

        if (err) return reject(err);

        resolve(instance);
      });

    }catch(e){
      return reject(e);
    }
  });
};

ElasticFeedService.prototype.portalMesh = function(config, existing){

  var _this = this;

  return new Promise(function(resolve, reject){

    try{

      var baseConfig = _this.__parseBaseConfig(config);

      var portalConfig = _this.__parsePortalConfig(baseConfig);

      if (existing){

        return existing._createElement({
            module: portalConfig.modules.portal,
            component: portalConfig.components.portal
          })
          .then(function () {
            resolve(existing)
          })
          .catch(reject);
      }

      Mesh.create(portalConfig, function (err, instance) {

        if (err) return reject(err);

        resolve(instance);
      });

    }catch(e){
      return reject(e);
    }
  });
};

ElasticFeedService.prototype.baseMesh = function(config){

  var _this = this;

  return new Promise(function(resolve, reject){

    try{

      var baseConfig = _this.__parseBaseConfig(config);

      Mesh.create(baseConfig, function (err, instance) {

        if (err) return reject(err);

        resolve(instance);
      });

    }catch(e){
      return reject(e);
    }
  });
};



module.exports = ElasticFeedService;