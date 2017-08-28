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

function ElasticFeedService(options) {

  this.components = {};

  this._instances = {};

  if (options == null) options = {};

  Object.defineProperty(this, '__options', {
    enumerable: true,
    writable: true,
    value: options
  });
}

ElasticFeedService.prototype.SERVICE_TYPE = {
  QUEUE: 0,
  PORTAL: 1,
  WORKER: 2,
  SUBSCRIBER: 3,
  EMITTER: 4,
  PROXY: 5,
  DASHBOARD: 6
};

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

/* configuration parsers */
{
  ElasticFeedService.prototype.__parseBaseConfig = function (config) {

    if (!config) config = {};

    if (!config.data) config.data = {};

    if (!config.data.port) config.data.port = 55000;

    if (!config.data.elastic_url) config.data.elastic_url = "http://localhost:9200";

    var CREDS_DATA_PASSWORD = process.env.CREDS_DATA_PASSWORD ? process.env.OUTPUT_PASSWORD : CREDS_DATA_PASSWORD;

    if (!config.feed) config.feed = {};

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
                cache:this.__options.dataCache,
                settings: {
                  host: config.data.url,
                  dataroutes: [{
                    pattern: "/happner-feed-data/{{index}}/{{type}}/*",
                    dynamic: true
                  }]
                },
                patterns: [
                  '/happner-feed-data/*'
                ]
              },
              {
                name: 'happner-elastic-feed-config',
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
          instance: this.__instantiateServiceInstance(Service, config.service)
        },
        "feed": {
          instance: this.__instantiateServiceInstance(Feed, config.feed)
        },
        "utilities": {
          instance: this.__instantiateServiceInstance(Utilities, config.utilities)
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

    var emitterConfig = this.__parseBaseConfig(config);

    emitterConfig.components.emitter = {
      startMethod: "initialize",
      stopMethod: "stop",
      accessLevel: "mesh"
    };

    return emitterConfig;
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

    baseConfig.components.queue = {
      startMethod: "initialize",
      stopMethod: "stop"
    };

    return baseConfig;
  };

  ElasticFeedService.prototype.__parsePortalConfig = function (config) {

    var baseConfig = this.__parseBaseConfig(config);

    baseConfig.components.portal = {
      startMethod: "initialize"
    };

    return baseConfig;
  };

  ElasticFeedService.prototype.__parseProxyConfig = function (config) {

    var baseConfig = this.__parseBaseConfig(config);

    baseConfig.components.proxy = {
      startMethod: "initialize"
    };

    return baseConfig;
  };

  ElasticFeedService.prototype.__parseDashboardConfig = function (config) {

    var baseConfig = this.__parseBaseConfig(config);

    baseConfig.components.dashboard = {
      startMethod: "initialize"
    };

    return baseConfig;
  };


  ElasticFeedService.prototype.__parseSubscriberConfig = function (config) {

    var baseConfig = this.__parseBaseConfig(config);

    var CREDS_SUBSCRIBER_PASSWORD = process.env.CREDS_SUBSCRIBER_PASSWORD ? process.env.CREDS_SUBSCRIBER_PASSWORD : CREDS_SUBSCRIBER_PASSWORD;

    if (!config.subscriber) config.subscriber = {port: 55000, password: CREDS_SUBSCRIBER_PASSWORD};

    baseConfig.components.subscriber = {
      startMethod: "initialize",
      accessLevel: "mesh"
    };

    return baseConfig;
  };
}

/* service instantiation and attach */
{
  ElasticFeedService.prototype.__instantiateServiceInstance = function (instanceClass, config) {

    if (!instanceClass) throw new Error('null service class');

    var _this = this;

    if (!config) config = {};

    var instance = new instanceClass(config);

    _this.__attachEvents(instance);

    _this.__attachMetrics(instance);

    return instance;
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
        .catch(function (e) {

          return componentNameCB(e);
        });

    }, function (e) {

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

  ElasticFeedService.prototype.attach = function (serviceClass, config) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      if (!serviceClass) return reject(new Error('null service class'));

      if (!config) config = {};

      if (!serviceClass.name) return reject(new Error('bad service class, no name'));

      var serviceClassName = serviceClass.name;

      var serviceClassType = _this.SERVICE_TYPE[serviceClassName.toUpperCase()];

      if (serviceClassType == null) return reject(new Error('unknown service class type: SERVICE_TYPE.' + serviceClassName.toUpperCase()));

      var serviceConfigParse = _this['__parse' + serviceClassName + 'Config'];

      if (!serviceConfigParse) serviceConfigParse = _this['__parseBaseConfig'];

      var serviceConfig = serviceConfigParse.bind(_this)(config);

      if (!serviceConfig.modules) serviceConfig.modules = {};

      var serviceInstance = _this.__instantiateServiceInstance(serviceClass, config);

      serviceConfig.modules[serviceClassName.toLowerCase()] = {instance: serviceInstance};

      return _this.__initializeMesh(serviceConfig, function (e) {

        if (e) return reject(e);

        if (_this._instances[serviceClass.name] == null) _this._instances[serviceClass.name] = [];

        _this._instances[serviceClass.name].push({instance:serviceInstance, _class:serviceClass});

        resolve(_this);
      });
    });
  };
}

/* analytics */
{
  ElasticFeedService.prototype.__attachMetrics = function (instance) {

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

    instance.__averageTimeStart = function (key) {

      this.__metrics.started[key] = Date.now();

    }.bind(instance);

    instance.__averageTimeEnd = function (key) {

      if (!this.__metrics.counters[key]) this.__metrics.counters[key] = 0;

      if (!this.__metrics.accumulated[key]) this.__metrics.accumulated[key] = 0;

      this.__metrics.counters[key]++;

      this.__metrics.accumulated[key] += Date.now() - this.__metrics.started[key];

      this.__metrics.averages[key] = this.__metrics.accumulated[key] / this.__metrics.counters[key];

    }.bind(instance);
  };

  ElasticFeedService.prototype.getMetrics = function (options) {

    if (!options) options = {};

    var _this = this;

    var metricInstances = {};

    Object.keys(_this._instances).forEach(function (serviceName) {

      if (!options.serviceName || options.serviceName == serviceName) {

        _this._instances[serviceName].forEach(function (service, serviceInstanceIndex) {

          if (typeof service.instance.metrics == 'function') metricInstances[serviceName + '_' + serviceInstanceIndex] = service.instance;
        });
      }
    });

    var metrics = {};

    return new Promise(function(resolve, reject){

      async.eachSeries(Object.keys(metricInstances), function(metricInstanceKey, metricInstanceKeyCB){

        var metricInstance = metricInstances[metricInstanceKey];

        metricInstance.metrics()
          .then(function(metricsValues){
            metrics[metricInstanceKey] = metricsValues;
            metricInstanceKeyCB();
          }).catch(metricInstanceKeyCB)

      }, function(e){

        if (e) return reject(e);
        resolve(metrics);
      });
    });
  };

  ElasticFeedService.prototype.__activateServiceMetrics = function (serviceInstance, serviceName, serviceClass) {

    var _this = this;

    Object.keys(serviceClass.prototype).forEach(function (servicePropertyName) {

      var serviceProperty = serviceInstance[servicePropertyName];

      if (typeof serviceProperty == 'function') {

        var methodString = serviceProperty.toString();

        var analyzeDirectiveStart = methodString.indexOf(':analyzable:');

        if (analyzeDirectiveStart > -1) {

          var analyzeDirectiveEnd = methodString.indexOf(':analyzable-end:');

          var metricsDirective = JSON.parse(methodString.substring(analyzeDirectiveStart + 12, analyzeDirectiveEnd));

          var wrapperBinding = {
            instance: serviceInstance,
            serviceName: serviceName,
            methodName: servicePropertyName,
            method: serviceProperty,
            directive: metricsDirective
          };

          var wrappedMethod;

          if (metricsDirective.promise) {

            console.log('wrapping promise:::');

            //promise method needs to be wrapped
            wrappedMethod = function () {

              console.log('in wrapped promise:::');

              var _self = this;

              var methodArguments = arguments;

              _self.instance.__averageTimeStart(_self.methodName);

              return new Promise(function (resolve, reject) {

                _self.method.apply(_self.instance, methodArguments)

                  .then(function () {

                    _self.instance.__averageTimeEnd(_self.methodName);

                    resolve.apply(_self.instance, arguments);
                  })
                  .catch(reject);
              });

            }.bind(wrapperBinding)

          } else if (metricsDirective.callback) {

            console.log('wrapping callback:::');

            //async callback needs to be wrapped

            wrappedMethod = function () {

              console.log('in wrapped callback:::');

              var _self = this;

              var methodArguments = arguments;

              _self.instance.__averageTimeStart(_self.methodName);

              if (!_self.directive.callbackIndex) _self.directive.callbackIndex = methodArguments.length - 1; //try last arg

              var callback = methodArguments[_self.directive.callbackIndex];

              if (callback == null || typeof callback != 'function') throw new Error('unable to find wrapped callback, or bad callback type for method ' + _self.methodName + ' in service ' + _self.serviceName);

              var wrappedCallback = function(e){

                if (e) return this.callback(e);

                this._self.instance.__averageTimeEnd(this._self.methodName);

                this.callback(arguments);

              }.bind({callback:callback, _self:_self});

              methodArguments[_self.directive.callbackIndex] = wrappedCallback;

              _self.method.apply(_self.instance, methodArguments);

            }.bind(wrapperBinding)

          } else if (metricsDirective.emit != null) {

            //we expect an emitted event to verify how long things took

            wrappedMethod = function () {

              var _self = this;

              var methodArguments = arguments;

              _self.instance.__averageTimeStart(_self.methodName);

              _self.eventHandler = function(data){

                _self.instance.__averageTimeEnd(_self.methodName);

                //disconnect event
                _self.instance.off(wrapperBinding.directive.emit, _self.eventHandler);
              };

              _self.instance.on(wrapperBinding.directive.emit, _self.eventHandler);

              _self.method.apply(_self.instance, methodArguments);

            }.bind(wrapperBinding)

          } else {

            console.log('wrapping synchronous:::');

            //synchronous

            wrappedMethod = function () {

              console.log('in wrapped sync:::');

              var _self = this;

              _self.instance.__averageTimeStart(_self.methodName);

              _self.method.apply(_self.instance, arguments);

              _self.instance.__averageTimeEnd(_self.methodName);

            }.bind(wrapperBinding);
          }

          serviceInstance[servicePropertyName] = wrappedMethod;
        }
      }
    });
  };

  ElasticFeedService.prototype.activateMetrics = function (options) {

    if (!options) options = {};

    var _this = this;

    console.log('activate:::', _this._instances);

    Object.keys(_this._instances).forEach(function (serviceName) {

      if (!options.serviceName || options.serviceName == serviceName){

        _this._instances[serviceName].forEach(function (serviceInstance) {

          console.log('__activateServiceMetrics:::', serviceName);

          _this.__activateServiceMetrics(serviceInstance.instance, serviceName, serviceInstance._class);
        });
      }
    });
  };
}

/* events */
{
  ElasticFeedService.prototype.__attachEvents = function (instance) {

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
}

/* convenience service instantiation methods */
{
  ElasticFeedService.prototype.queue = function (config) {

    return this.attach(Queue, config);
  };

  ElasticFeedService.prototype.emitter = function (config) {

    return this.attach(Emitter, config);
  };

  ElasticFeedService.prototype.subscriber = function (config) {

    return this.attach(Subscriber, config);
  };

  ElasticFeedService.prototype.portal = function (config) {

    return this.attach(Portal, config);
  };

  ElasticFeedService.prototype.proxy = function (config) {

    return this.attach(Proxy, config);
  };

  ElasticFeedService.prototype.dashboard = function (config) {

    return this.attach(Dashboard, config);
  };


  ElasticFeedService.prototype.worker = function (config) {

    return this.attach(Worker, config);
  };
}


module.exports = ElasticFeedService;