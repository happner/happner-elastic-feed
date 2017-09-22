var Promise = require('bluebird')
  , Mesh = require('happner-2')
  , Utilities = require('./utilities')
  , async = require('async')
  , EventEmitter = require('events').EventEmitter
  ;

function ElasticFeedService(options) {

  this.components = [];

  this._instances = {};

  if (options == null) options = {};

  this.__requireComponents(options);

  Object.defineProperty(this, '__options', {
    enumerable: true,
    writable: true,
    value: options
  });
}

/* initiialize, instantiate, attach and stop */

ElasticFeedService.prototype.stop = stop;

ElasticFeedService.prototype.__initializeMesh = __initializeMesh;

/* service instantiation methods */

ElasticFeedService.prototype.queue = queue;

ElasticFeedService.prototype.emitter = emitter;

ElasticFeedService.prototype.subscriber = subscriber;

ElasticFeedService.prototype.portal = portal;

ElasticFeedService.prototype.proxy = proxy;

ElasticFeedService.prototype.dashboard = dashboard;

ElasticFeedService.prototype.worker = worker;

ElasticFeedService.prototype.feed = feed;

/* component management */

ElasticFeedService.prototype.attach = attach;

ElasticFeedService.prototype.instantiateServiceInstance = instantiateServiceInstance;

ElasticFeedService.prototype.__requireComponents = __requireComponents;

ElasticFeedService.prototype.__appendComponent = __appendComponent;

/* events */

ElasticFeedService.prototype.__attachEvents = __attachEvents;

/* analytics */

ElasticFeedService.prototype.__attachMetrics = __attachMetrics;

/* configuration parsers */

ElasticFeedService.prototype.__parseBaseConfig = __parseBaseConfig;

ElasticFeedService.prototype.__parseFeedConfig = __parseFeedConfig;

ElasticFeedService.prototype.__parseEmitterConfig = __parseEmitterConfig;

ElasticFeedService.prototype.__parseWorkerConfig = __parseWorkerConfig;

ElasticFeedService.prototype.__parseQueueConfig = __parseQueueConfig;

ElasticFeedService.prototype.__parsePortalConfig = __parsePortalConfig;

ElasticFeedService.prototype.__parseProxyConfig = __parseProxyConfig;

ElasticFeedService.prototype.__parseDashboardConfig = __parseDashboardConfig;

ElasticFeedService.prototype.__parseSubscriberConfig = __parseSubscriberConfig;


function __requireComponents(options) {

  if (options.methodDurationMetrics) {

    this.methodAnalyzer = require('happner-profane').create();

    this.Queue = this.methodAnalyzer.require('./components/queue', true);
    this.Emitter = this.methodAnalyzer.require('./components/emitter', true);
    this.Subscriber = this.methodAnalyzer.require('./components/subscriber', true);
    this.Feed = this.methodAnalyzer.require('./components/feed/component', true);
    this.Worker = this.methodAnalyzer.require('./components/worker', true);
    this.Proxy = this.methodAnalyzer.require('./components/proxy/component', true);
    this.Portal = this.methodAnalyzer.require('./components/portal/component', true);
    this.Service = this.methodAnalyzer.require('./components/service', true);
    this.Dashboard = this.methodAnalyzer.require('./components/dashboard/component', true);

  } else {

    this.Queue = require('./components/queue');
    this.Emitter = require('./components/emitter');
    this.Subscriber = require('./components/subscriber');
    this.Feed = require('./components/feed/component');
    this.Worker = require('./components/worker');
    this.Proxy = require('./components/proxy/component');
    this.Portal = require('./components/portal/component');
    this.Service = require('./components/service');
    this.Dashboard = require('./components/dashboard/component');
  }
}

function stop(opts) {

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
}

function __parseBaseConfig(config) {

  var _this = this;

  if (!config) config = {};

  if (!config.data) config.data = {};

  if (!config.data.port) config.data.port = 55000;

  if (!config.data.elastic_url) config.data.elastic_url = "http://localhost:9200";

  var SECURITY_DB_PROVIDER = process.env.SECURITY_DB_PROVIDER;

  if (SECURITY_DB_PROVIDER == null)
    SECURITY_DB_PROVIDER = 'happn-service-mongo-2';

  var SECURITY_DB_COLLECTION = process.env.SECURITY_DB_COLLECTION;

  if (SECURITY_DB_COLLECTION == null)
    SECURITY_DB_COLLECTION = 'happn';

  var SECURITY_DB_DATABASE = process.env.SECURITY_DB_DATABASE;

  if (SECURITY_DB_DATABASE == null)
    SECURITY_DB_DATABASE = 'happn';

  var SECURITY_DB_URL = process.env.SECURITY_DB_URL;

  if (SECURITY_DB_URL == null){
    console.warn('default db url used: mongodb://127.0.0.1:27017');
    SECURITY_DB_URL = 'mongodb://127.0.0.1:27017';
  }

  var CREDS_DATA_PASSWORD = process.env.CREDS_DATA_PASSWORD;

  if (CREDS_DATA_PASSWORD == null){
    console.warn('default adminPassword being used, hope you are testing');
    CREDS_DATA_PASSWORD = 'happn';
  }

  var SESSION_TOKEN_SECRET = process.env.SESSION_TOKEN_SECRET;

  if (SESSION_TOKEN_SECRET == null){
    console.warn('default session token secret is being used, hope you are testing');
    SESSION_TOKEN_SECRET = 'TestTokenSecret';
  }

  var securityProviderConfig = {
    name: 'happner-elastic-feed-security',
    provider:SECURITY_DB_PROVIDER,
    isDefault: true,
    settings: {
      collection: SECURITY_DB_COLLECTION,
      database: SECURITY_DB_DATABASE,
      url:SECURITY_DB_URL,
      sslValidate: false,
      acceptableLatencyMS: 5000
    }
  };

  var __happnConfig = {
    port: config.data.port,
    secure: true,
    services: {
      security: {
        config: {
          adminPassword:CREDS_DATA_PASSWORD,
          sessionTokenSecret:SESSION_TOKEN_SECRET
        }
      },
      data: {
        config: {
          datastores: [
            //legacy when feeds were pushing to elastic
            // {
            //   name: 'happner-elastic-feed',
            //   provider: 'happner-elastic-dataprovider',
            //   cache: this.__options.dataCache,
            //   settings: {
            //     host: config.data.elastic_url,
            //     dataroutes: [{
            //       pattern: "/happner-feed-data/{{index}}/{{type}}/*",
            //       dynamic: true
            //     }]
            //   },
            //   patterns: [
            //     '/happner-feed-data/*'
            //   ]
            // },
            securityProviderConfig
          ]
        }
      }
    }
  };

  if (!config.name)  config.name = 'happner-elastic-feed';

  var happnerConfig = {
    name: config.name,
    happn: __happnConfig,
    modules: {
      "service": {
        instance: this.instantiateServiceInstance(_this.Service, config.service)
      }
    },
    components: {
      "service": {
        startMethod: "initialize"
      }
    }
  };

  return happnerConfig;
}

function __parseEmitterConfig(config) {

  var emitterConfig = this.__parseBaseConfig(config);

  emitterConfig.components.emitter = {
    startMethod: "initialize",
    stopMethod: "stop",
    accessLevel: "mesh"
  };

  return emitterConfig;
}

function __parseFeedConfig(config) {

  var feedConfig = this.__parseBaseConfig(config);

  feedConfig.components.feed = {
    startMethod: "initialize",
    stopMethod: "stop",
    accessLevel: "mesh"
  };

  return feedConfig;
}

function __parseWorkerConfig(config) {

  var baseConfig = this.__parseBaseConfig(config);

  if (!config.worker) config.worker = {};

  if (config.queue == null) throw new Error('missing config.queue argument');

  if (config.queue.jobTypes == null) throw new Error('missing config.queue.jobTypes argument');

  if (config.queue.name == null) config.queue.name = 'happner-elastic-feed';

  if (config.queue.host == null) config.queue.host = '127.0.0.1';

  if (config.queue.port == null) config.queue.port = 55000;

  if (config.queue.secure == null) config.queue.secure = true;

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
}

function __parseQueueConfig(config) {

  var baseConfig = this.__parseBaseConfig(config);

  if (!config.queue) {

    if (config.jobTypes) config = {kue: config.kue, jobTypes: config.jobTypes};

    else config.jobTypes = {};

    config.queue = {jobTypes: config.jobTypes, kue: config.kue};
  }

  if (config.jobTypes)
    config.jobTypes.forEach(function(jobType){

      if (!config.queue.jobTypes[jobType]) config.queue.jobTypes[jobType] = {concurrency: 10};
    });

  if (!config.queue.kue) config.queue.kue = {};

  if (!config.queue.kue.prefix) config.queue.kue.prefix = config.name;

  baseConfig.components.queue = {
    startMethod: "initialize",
    stopMethod: "stop"
  };

  return baseConfig;
}

function __parsePortalConfig(config) {

  var baseConfig = this.__parseBaseConfig(config);

  baseConfig.components.portal = {
    web: {
      routes: {
        "dashboardListAuthorized": ["dashboardListAuthorized"],
        "portal": ["portalPage"]
      }
    },
    startMethod: "initialize",
    stopMethod: "stop"
  };

  return baseConfig;
}

function __parseProxyConfig(config) {

  var baseConfig = this.__parseBaseConfig(config);

  baseConfig.components.proxy = {
    startMethod: "initialize",
    stopMethod: "stop",
    accessLevel: "mesh"
  };

  return baseConfig;
}

function __parseDashboardConfig(config) {

  var baseConfig = this.__parseBaseConfig(config);

  baseConfig.components.dashboard = {
    startMethod: "initialize"
  };

  return baseConfig;
}


function __parseSubscriberConfig(config) {

  var baseConfig = this.__parseBaseConfig(config);

  var CREDS_SUBSCRIBER_PASSWORD = process.env.CREDS_SUBSCRIBER_PASSWORD ? process.env.CREDS_SUBSCRIBER_PASSWORD : CREDS_SUBSCRIBER_PASSWORD;

  if (!config.subscriber) config.subscriber = {port: 55000, password: CREDS_SUBSCRIBER_PASSWORD};

  baseConfig.components.subscriber = {
    startMethod: "initialize",
    accessLevel: "mesh"
  };

  return baseConfig;
}

function instantiateServiceInstance(instanceClass, config) {

  if (!instanceClass) throw new Error('null service class');

  var _this = this;

  if (!config) config = {};

  var instance = new instanceClass(config);

  _this.__attachEvents(instance);

  _this.__attachMetrics(instance);

  _this.components.push(instance);

  return instance;
}

function __appendComponent(config, callback) {

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

        return componentNameCB();
      })
      .catch(function (e) {

        return componentNameCB(e);
      });

  }, function (e) {

    return callback(e);
  });
}

function __initializeMesh(config, callback) {

  var _this = this;

  if (_this.__mesh == null) {

    return Mesh.create(config, function (err, instance) {

      if (err) return callback(err);

      _this.__mesh = instance;

      callback();
    });
  }

  _this.__appendComponent(config, callback);
}

function attach(serviceClass, config) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (!serviceClass) return reject(new Error('null service class'));

    if (!config) config = {};

    if (!serviceClass.name) return reject(new Error('bad service class, no name'));

    var serviceClassName = serviceClass.name;

    //TODO: rather have config parser enclosed in service class, so we can inject dependancies

    var serviceConfigParse = _this['__parse' + serviceClassName + 'Config'];

    if (!serviceConfigParse) serviceConfigParse = _this['__parseBaseConfig'];

    var serviceConfig = serviceConfigParse.bind(_this)(config);

    if (!serviceConfig.modules) serviceConfig.modules = {};

    var serviceInstance = _this.instantiateServiceInstance(serviceClass, config);

    serviceConfig.modules[serviceClassName.toLowerCase()] = {instance: serviceInstance};

    return _this.__initializeMesh(serviceConfig, function (e) {

      if (e) return reject(e);

      if (_this._instances[serviceClass.name] == null) _this._instances[serviceClass.name] = [];

      _this._instances[serviceClass.name].push({instance: serviceInstance, _class: serviceClass});

      resolve(_this);
    });
  });
}

function __attachMetrics(instance) {

  Object.defineProperty(instance, '__metrics', {
    enumerable: true,
    writable: true,
    value: {
      started: {},
      accumulated: {},
      duration: {},
      counters: {},
      averages: {}
    }
  });

  instance.__updateMetric = function (key, subkey, value, $happn) {

    if (!this.__metrics[key]) this.__metrics[key] = {};

    if (!this.__metrics[key][subkey]) this.__metrics[key][subkey] = 0;

    this.__metrics[key][subkey] += value;

    this.emit('metric-changed', {key: key, subkey: subkey, value: value}, $happn);

  }.bind(instance);

  instance.metrics = function () {

    var _instance = this;

    return new Promise(function (resolve) {

      resolve(_instance.__metrics);
    });

  }.bind(instance);
}


function __attachEvents(instance) {

  if (!instance.on) {

    instance.__events = new EventEmitter();

    instance.on = function (key, handler) {
      return this.__events.on(key, handler);
    }.bind(instance);

    instance.off = function (key, handler) {

      return this.__events.removeListener(key, handler);
    }.bind(instance);

    instance.emit = function (key, data, $happn, callback) {

      var _this = this;

      if (!callback) callback = function (e) {
        if (e) _this.__events.emit('emit-failure', [key, data]);
      };

      if ($happn) $happn.emit(key, data, callback);

      _this.__events.emit(key, data);

    }.bind(instance);
  }
}

function queue(config) {

  return this.attach(this.Queue, config);
}

function feed(config) {

  return this.attach(this.Feed, config);
}

function emitter(config) {

  return this.attach(this.Emitter, config);
}

function subscriber(config) {

  return this.attach(this.Subscriber, config);
}

function portal(config) {

  return this.attach(this.Portal, config);
}

function proxy(config) {

  return this.attach(this.Proxy, config);
}

function dashboard(config) {

  return this.attach(this.Dashboard, config);
}

function worker(config) {

  return this.attach(this.Worker, config);
}

module.exports = ElasticFeedService;