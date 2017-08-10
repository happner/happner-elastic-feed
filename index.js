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

function ElasticFeedService(options) {

  this.components = {};
}

ElasticFeedService.prototype.__parseBaseConfig = function (config) {

  if (!config) config = {};

  if (!config.data) config.data = {};

  if (!config.data.port) config.data.port = 55000;

  if (!config.data.elastic_url) config.data.elastic_url = "http://localhost:9200";

  if (!config.data.dataroutes) config.data.dataroutes = [
    {
      pattern: "/happner-feed-system/{{type}}",
      index: "happner-feed-system"
    }
  ];

  if (!config.data.indexes) config.data.indexes = [
    {index: "happner-feed-system"}
  ];

  var CREDS_DATA_PASSWORD = process.env.CREDS_DATA_PASSWORD ? process.env.OUTPUT_PASSWORD : CREDS_DATA_PASSWORD;

  var __happnConfig = {
    port: config.data.port,
    secure: true,
    services: {
      security: {
        adminPassword: CREDS_DATA_PASSWORD
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
      }
    },
    components: {
      "service": {
        startMethod: "initialize"
      },
      "feed": {
        startMethod: "initialize"
      },
      "utilities": {}
    }
  };

  return config;
};

ElasticFeedService.prototype.__parseEmitterConfig = function (config) {

  config = this.__parseBaseConfig(config);

  if (!config.data) config.data = {};

  config.modules.emitter = {instance: new Emitter(config.emitter)};

  config.components.emitter = {
    startMethod: "initialize"
  };

  return config;
};

ElasticFeedService.prototype.__parseWorkerConfig = function (config) {

  config = this.__parseBaseConfig(config);

  if (!config.worker) config.worker = {};

  if (!config.worker.jobTypes) throw new Error('worker.jobTypes argument missing');

  if (config.queue == null) throw new Error('missing config.queue argument');

  if (config.queue.jobTypes == null) throw new Error('missing config.queue.jobTypes argument');

  if (config.queue.name == null) config.queue.name = 'happner-elastic-queue';

  if (config.queue.username == null) config.queue.username = '_ADMIN';

  if (config.queue.password == null) config.queue.password = 'happn';

  if (config.queue.port == null) config.queue.port = 55000;

  if (config.queue.secure == null) config.queue.secure = true;

  config.worker.queueMeshName = config.queue.name;

  config.modules.worker = {instance: new Worker(config.worker)};

  config.components.worker = {
    startMethod: "initialize",
    accessLevel: 'mesh'
  };

  if (!config.endpoints) config.endpoints = [];

  config.endpoints[config.queue.name] = {config: config.queue};

  return config;
};

ElasticFeedService.prototype.__parseQueueConfig = function (config) {

  config = this.__parseBaseConfig(config);

  if (!config.queue) {

    if (config.jobTypes) config = {kue: config.kue, jobTypes: config.jobTypes};

    else config.jobTypes = {};

    config.queue = {jobTypes: config.jobTypes, kue: config.kue};
  }

  if (!config.queue.jobTypes["subscriber"]) config.queue.jobTypes["subscriber"] = {concurrency: 10};

  if (!config.queue.jobTypes["emitter"]) config.queue.jobTypes["emitter"] = {concurrency: 10};

  if (!config.queue.kue) config.queue.kue = {};

  if (!config.queue.kue.prefix) config.queue.kue.prefix = config.name;

  config.modules.queue = {instance: new Queue(config.queue)};

  config.components.queue = {
    startMethod: "initialize"
  };

  return config;
};

ElasticFeedService.prototype.__parsePortalConfig = function (config) {

  config = this.__parseBaseConfig(config);

  config.modules.portal = {instance: new Portal(config.portal)};

  config.components.portal = {
    startMethod: "initialize"
  };

  return config;
};


ElasticFeedService.prototype.__parseSubscriberConfig = function (config) {

  config = this.__parseBaseConfig(config);

  var CREDS_SUBSCRIBER_PASSWORD = process.env.CREDS_SUBSCRIBER_PASSWORD ? process.env.CREDS_SUBSCRIBER_PASSWORD : CREDS_SUBSCRIBER_PASSWORD;

  if (!config.subscriber) {
    config.subscriber = {port: 55000, password: CREDS_SUBSCRIBER_PASSWORD};
  }

  config.modules.subscriber = {instance: new Subscriber(config.subscriber)};

  config.components.subscriber = {
    startMethod: "initialize"
  };

  return config;
};

ElasticFeedService.prototype.__appendComponent = function (config, callback) {

  var _this = this;

  async.eachSeries(Object.keys(config.components), function (componentName, componentNameCB) {

    if (_this.__mesh._mesh.elements[componentName] != null) return componentNameCB();

    _this.__mesh._createElement({
        module: {
          name: componentName,
          config: {
            instance: config.modules[componentName].instance
          }
        },
        component: {
          name: componentName,
          config: config.components[componentName]
        }
      })
      .then(function () {

        _this.components[componentName] = config.modules[componentName].instance;
        return componentNameCB();
      })
      .catch(componentNameCB);

  }, callback);
};

ElasticFeedService.prototype.__initializeMesh = function (config, callback) {

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
  QUEUE: 0,
  PORTAL: 1,
  WORKER: 2,
  SUBSCRIBER: 3,
  EMITTER: 4
};

ElasticFeedService.prototype.__activateService = function (type, config, callback) {

  try {

    var typeConfig;

    if (type == this.SERVICE_TYPE.QUEUE) typeConfig = this.__parseQueueConfig(config);

    if (type == this.SERVICE_TYPE.PORTAL) typeConfig = this.__parsePortalConfig(config);

    if (type == this.SERVICE_TYPE.WORKER) typeConfig = this.__parseWorkerConfig(config);

    if (type == this.SERVICE_TYPE.SUBSCRIBER) typeConfig = this.__parseSubscriberConfig(config);

    if (type == this.SERVICE_TYPE.EMITTER) typeConfig = this.__parseEmitterConfig(config);

    return this.__initializeMesh(typeConfig, callback);

  } catch (e) {

    callback(e);
  }
};

ElasticFeedService.prototype.queue = function (config) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.__activateService(_this.SERVICE_TYPE.QUEUE, config, function (e) {
      if (e) return reject(e);
      resolve(_this);
    });
  });
};

ElasticFeedService.prototype.emitter = function (config) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.__activateService(_this.SERVICE_TYPE.EMITTER, config, function (e) {
      if (e) return reject(e);
      resolve(_this);
    });
  });
};

ElasticFeedService.prototype.subscriber = function (config) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.__activateService(_this.SERVICE_TYPE.SUBSCRIBER, config, function (e) {
      if (e) return reject(e);
      resolve(_this);
    });
  });
};

ElasticFeedService.prototype.portal = function (config) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.__activateService(_this.SERVICE_TYPE.PORTAL, config, function (e) {
      if (e) return reject(e);
      resolve(_this);
    });
  });
};

ElasticFeedService.prototype.worker = function (config) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.__activateService(_this.SERVICE_TYPE.WORKER, config, function (e) {
      if (e) return reject(e);
      resolve(_this);
    });
  });
};

ElasticFeedService.prototype.stop = function (opts, callback) {

  if (typeof opts == 'function') {
    callback = opts;
    opts = {};
  }

  if (!opts) opts = {};

  return this.__mesh.stop(opts, callback);
};


module.exports = ElasticFeedService;