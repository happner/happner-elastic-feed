var Promise = require('bluebird')
  , Mesh = require('happner-2')
  , Emitter = require('./lib/emitter')
  , Subscriber = require('./lib/subscriber')
  , Feed = require('./lib/feed/component')
  , Worker = require('./lib/worker')
  , Portal = require('./lib/portal/component')
  , Proxy = require('./lib/portal/proxy')
  , Dashboard = require('./lib/dashboard/component')
  , Queue = require('./lib/queue')
  , Service = require('./lib/service')
  , Utilities = require('./lib/utilities')
  , async = require('async')
  , EventEmitter = require('events').EventEmitter
  ;

ElasticFeedService.prototype.SERVICE_TYPE = {
  QUEUE: 0,
  PORTAL: 1,
  WORKER: 2,
  SUBSCRIBER: 3,
  EMITTER: 4,
  PROXY:5,
  DASHBOARD:6
};


function ElasticFeedService(options) {

  this.components = {};
}

ElasticFeedService.prototype.stop = function (opts, callback) {

  var _this = this;

  if (typeof opts == 'function') {
    opts = {};
  }

  if (!opts) opts = {};

  return new Promise(function (resolve, reject) {

    return _this.__mesh.stop(opts, function (e) {

      if (e) return reject(e);

      resolve();
    });
  });
};

ElasticFeedService.prototype.__instantiateServiceInstance = function(config, instanceClass){

  var instance = new instanceClass(config);

  if (!instance.on){

    instance.__events = new EventEmitter();

    instance.on = function(key, handler){
      return this.__events.on(key, handler);
    }.bind(instance);

    instance.off = function (key, handler) {

      return this.__events.removeListener(key, handler);
    }.bind(instance);

    instance.emit = function (key, data, $happn) {

      var _this = this;

      if ($happn) $happn.emit(key, data, function (e) {
        if (e) _this.__events.emit('emit-failure', [key, data]);
      });

      _this.__events.emit(key, data);

    }.bind(instance);
  }

  instance.__metrics = {};

  instance.__updateMetric = function (key, subkey, value, $happn) {

    if (!this.__metrics[key]) this.__metrics[key] = {};

    if (!this.__metrics[key][subkey]) this.__metrics[key][subkey] = 0;

    this.__metrics[key][subkey] += value;

    this.emit('metric-changed', {key: key, subkey: subkey, value: value}, $happn);

  }.bind(instance);

  instance.metrics = function () {

    var _this = this;

    return new Promise(function (resolve) {

      resolve(_this.__metrics);
    });

  }.bind(instance);

  return instance;
};

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

  if (!config.feed) config.feed = {};

  if (!config.feed.output_secret){

    if (CREDS_DATA_PASSWORD) config.feed.output_secret = process.env.CREDS_OUTPUT_SECRET ? process.env.CREDS_OUTPUT_SECRET : CREDS_DATA_PASSWORD;

      config.feed.output_secret = 'happner';

    if (process.env.CREDS_OUTPUT_SECRET == CREDS_DATA_PASSWORD) console.warn('feed output secret is the same as the admin password, not optimal...');

    if (config.feed.output_secret == 'happner') console.warn('feed output secret is happner, hope you are testing...');
  }

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

  if (!config.name)  config.name = 'happner-elastic-feed';

  var hapnnerConfig = {
    name: config.name,
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
        startMethod: "initialize",
        stopMethod: "stop",
        accessLevel: "mesh"
      },
      "utilities": {}
    }
  };

  return hapnnerConfig;
};

ElasticFeedService.prototype.__parseEmitterConfig = function (config) {

  config = this.__parseBaseConfig(config);

  if (!config.data) config.data = {};

  config.modules.emitter = {instance: this.__instantiateServiceInstance(config, Emitter)};

  config.components.emitter = {
    startMethod: "initialize"
  };

  return config;
};

ElasticFeedService.prototype.__parseWorkerConfig = function (config) {

  var baseConfig = this.__parseBaseConfig(config);

  if (!config.worker) config.worker = {};

  if (config.queue == null) throw new Error('missing config.queue argument');

  if (config.queue.jobTypes == null) throw new Error('missing config.queue.jobTypes argument');

  if (config.queue.name == null) config.queue.name = 'happner-elastic-feed';

  if (config.queue.host == null) config.queue.host = '127.0.0.1';

  if (config.queue.port == null) config.queue.port = 55000;

  if (config.queue.secure == null) config.queue.secure = true;

  config.worker.queueMeshName = config.queue.name;

  baseConfig.modules.worker = {instance: this.__instantiateServiceInstance(config, Worker)};

  baseConfig.components.worker = {
    startMethod: "initialize",
    stopMethod: "stop",
    accessLevel: "mesh"
  };

  if (!baseConfig.endpoints) baseConfig.endpoints = {};

  baseConfig.endpoints[config.queue.name] = {
    config: {
      host: config.queue.host,
      port: config.queue.port
    }
  };

  if (config.queue.secure) {

    if (config.queue.username == null) config.queue.username = '_ADMIN';

    if (config.queue.password == null) config.queue.password = 'happn';

    baseConfig.endpoints[config.queue.name].config.username = config.queue.username;
    baseConfig.endpoints[config.queue.name].config.password = config.queue.password;
  }

  return baseConfig;
};

ElasticFeedService.prototype.__parseQueueConfig = function (config) {

  var baseConfig = this.__parseBaseConfig(config);

  if (!config.queue) {

    if (config.jobTypes) config = {kue: config.kue, jobTypes: config.jobTypes};

    else config.jobTypes = {};

    config.queue = {jobTypes: config.jobTypes, kue: config.kue};
  }

  if (!config.queue.jobTypes["subscriber"]) config.queue.jobTypes["subscriber"] = {concurrency: 10};

  if (!config.queue.jobTypes["emitter"]) config.queue.jobTypes["emitter"] = {concurrency: 10};

  if (!config.queue.kue) config.queue.kue = {};

  if (!config.queue.kue.prefix) config.queue.kue.prefix = config.name;

  baseConfig.modules.queue = {instance: this.__instantiateServiceInstance(config, Queue)};

  baseConfig.components.queue = {
    startMethod: "initialize",
    stopMethod: "stop"
  };

  return baseConfig;
};

ElasticFeedService.prototype.__parsePortalConfig = function (config) {

  var baseConfig = this.__parseBaseConfig(config);

  baseConfig.modules.portal = {instance: this.__instantiateServiceInstance(config, Portal)};

  baseConfig.components.portal = {
    startMethod: "initialize"
  };

  return baseConfig;
};

ElasticFeedService.prototype.__parseProxyConfig = function (config) {

  var baseConfig = this.__parseBaseConfig(config);

  baseConfig.modules.proxy = {instance: this.__instantiateServiceInstance(config, Proxy)};

  baseConfig.components.proxy = {
    startMethod: "initialize"
  };

  return baseConfig;
};

ElasticFeedService.prototype.__parseDashboardConfig = function (config) {

  var baseConfig = this.__parseBaseConfig(config);

  baseConfig.modules.dashboard = {instance: this.__instantiateServiceInstance(config, Dashboard)};

  baseConfig.components.dashboard = {
    startMethod: "initialize"
  };

  return baseConfig;
};


ElasticFeedService.prototype.__parseSubscriberConfig = function (config) {

  var baseConfig = this.__parseBaseConfig(config);

  var CREDS_SUBSCRIBER_PASSWORD = process.env.CREDS_SUBSCRIBER_PASSWORD ? process.env.CREDS_SUBSCRIBER_PASSWORD : CREDS_SUBSCRIBER_PASSWORD;

  if (!config.subscriber) config.subscriber = {port: 55000, password: CREDS_SUBSCRIBER_PASSWORD};

  baseConfig.modules.subscriber = {instance: this.__instantiateServiceInstance(config, Subscriber)};

  baseConfig.components.subscriber = {
    startMethod: "initialize",
    accessLevel: "mesh"
  };

  return baseConfig;
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
      .catch(function(e){

        return componentNameCB(e);
      });

  }, function(e){

    return callback(e);
  });
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

ElasticFeedService.prototype.__activateService = function (type, config, callback) {

  try {

    var typeConfig;

    if (type == this.SERVICE_TYPE.QUEUE) typeConfig = this.__parseQueueConfig(config);

    if (type == this.SERVICE_TYPE.PORTAL) typeConfig = this.__parsePortalConfig(config);

    if (type == this.SERVICE_TYPE.WORKER) typeConfig = this.__parseWorkerConfig(config);

    if (type == this.SERVICE_TYPE.SUBSCRIBER) typeConfig = this.__parseSubscriberConfig(config);

    if (type == this.SERVICE_TYPE.EMITTER) typeConfig = this.__parseEmitterConfig(config);

    if (type == this.SERVICE_TYPE.PROXY) typeConfig = this.__parseProxyConfig(config);

    if (type == this.SERVICE_TYPE.DASHBOARD) typeConfig = this.__parseDashboardConfig(config);

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

ElasticFeedService.prototype.proxy = function (config) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.__activateService(_this.SERVICE_TYPE.PROXY, config, function (e) {
      if (e) return reject(e);
      resolve(_this);
    });
  });
};


ElasticFeedService.prototype.dashboard = function (config) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.__activateService(_this.SERVICE_TYPE.DASHBOARD, config, function (e) {
      if (e) return reject(e);
      resolve(_this);
    });
  });
};


ElasticFeedService.prototype.worker = function (config) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (!config.name) config.name = 'happner-feed-worker';

    _this.__activateService(_this.SERVICE_TYPE.WORKER, config, function (e) {
      if (e) return reject(e);
      resolve(_this);
    });
  });
};


module.exports = ElasticFeedService;