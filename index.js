var Promise = require('bluebird')
  , happner = require('happner-2')
  , Source = require('./lib/source');
  , Destination = require('./lib/destination');
  , Feed = require('./lib/feed');
  , Portal = require('./lib/portal/component');
  , Queue = require('./lib/queue');
  , Service = require('./lib/service');
  ;

function ElasticFeedService(options){

}

ElasticFeedService.prototype.__parseSourceConfig = function(config){

  if (!config) config = {};

  if (!config.input) config.input = {};

  if (!config.input.port) config.input.port = 55000;

  if (!config.output) config.output = {};

  if (!config.output.port) config.output.port = 55001;

  if (!config.input.elastic_url) config.input.elastic_url = "http://localhost:9200";

  var CREDS_INPUT_PASSWORD = process.env.INPUT_PASSWORD?process.env.INPUT_PASSWORD:'happn';
  var CREDS_OUTPUT_PASSWORD = process.env.OUTPUT_PASSWORD?process.env.OUTPUT_PASSWORD:CREDS_INPUT_PASSWORD;

  var __happnConfigInput = {
    secure:true,
    services: {
      security:{
        adminPassword:CREDS_INPUT_PASSWORD
      },
      data: {
        config: {
          port:config.input.port,
          datastores: [
            {
              name: 'elastic-feed-in',
              provider: require('happner-elastic-dataprovider'),
              isDefault: true,
              settings: {
                host: config.input.url,
                indexes: config.happn.input.indexes,
                dataroutes: config.happn.input.dataroutes
              }
            }
          ]
        }
      }
    }
  };

  return {
    name: 'happner-elastic-feed-in',
    happn: __happnConfigInput,
    modules: {
      "service": {
        instance: new Service(config.input.service)
      },
      "source": {
        instance: new Source(config.input.source)
      },
      "queue": {
        instance: new Queue(config.input.queue)
      },
      "feed": {
        instance: new Feed(config.input.feed)
      }
    },
    components:{
      "service":{
        startMethod: "initialize"
      },
      "source": {
        startMethod: "initialize"
      },
      "queue":{
        startMethod: "initialize"
      },
      "feed":{
        startMethod: "initialize"
      }
    },
    endpoints:{
      destination: {
        config: {
          port: config.output.port,
          username: '_ADMIN',
          password: CREDS_OUTPUT_PASSWORD
        }
      }
    }
  };
};

ElasticFeedService.prototype.__parseDestinationConfig = function(config){

  var _this = this;

  if (!config.output) config.output = {};

  if (!config.output.port) config.output.port = 55001;

  if (!config.output.elastic_url) config.output.elastic_url = "http://localhost:9200";

  if (!config.output.dataroutes) config.output.dataroutes = [
    {
      dynamic: true,//dynamic routes generate a new index/type according to the items in the path
      pattern: "/feed/{{index}}/{{type}}/{{metric}}/{{timestamp:date}}/{{value:integer}}"
    },
    {
      dynamic: true,//dynamic routes generate a new index/type according to the items in the path
      pattern: "/_system/{{type}}",
      index: "_system"
    }
  ];

  if (!config.output.indexes) config.output.indexes = [
    {index: "_system"},
    {index: "_feed"}
  ];

  var CREDS_INPUT_PASSWORD = process.env.INPUT_PASSWORD?process.env.INPUT_PASSWORD:'happn';
  var CREDS_OUTPUT_PASSWORD = process.env.OUTPUT_PASSWORD?process.env.OUTPUT_PASSWORD:CREDS_INPUT_PASSWORD;

  var __happnConfigOutput = {
    secure:true,
    services: {
      security:{
        adminPassword:CREDS_OUTPUT_PASSWORD
      },
      data: {
        config: {
          port:config.output.port,
          datastores: [
            {
              name: 'elastic-feed-out',
              provider: require('happner-elastic-dataprovider'),
              isDefault: true,
              settings: {
                host: config.output.url,
                indexes: config.output.indexes,
                dataroutes: config.output.dataroutes
              }
            }
          ]
        }
      }
    }
  };

  return {
    name: 'happner-elastic-feed-out',
    happn: __happnConfigOutput,
    modules: {
      "service": {
        instance: new Service(config.output.service)
      },
      "portal": {
        instance: new Portal(config.portal)
      },
      "queue": {
        instance: new Queue(config.output.queue)
      },
      "feed": {
        instance: new Feed(config.output.feed)
      },
      "destination": {
        instance: new Destination(config.output.destination)
      }
    },
    components:{
      "service":{
        startMethod: "initialize"
      },
      "portal": {
        startMethod: "initialize",
        web: {
          routes: {
            "feed": "feed",
            "admin": "admin"
          }
        }
      },
      "queue":{
        startMethod: "initialize"
      },
      "feed":{
        startMethod: "initialize"
      },
      "destination":{
        startMethod: "initialize"
      }
    }
  };
};

ElasticFeedService.prototype.startSourceMesh = function(config){

  var _this = this;

  return new Promise(function(resolve, reject){

    try{

      var sourceConfig = _this.__parseSourceConfig(config);

      Mesh.create(_this.__happnerConfigOutput, function (err, instance) {

        if (err) return reject(err);

        _this.destinationMesh = instance;

        Mesh.create(_this.__happnerConfigInput, function (err, instance) {

          if (err) return reject(err);

          _this.sourceMesh = instance;

          callback();
        });
      });

    }catch(e){
      return reject(e);
    }
  });
};

ElasticFeedService.prototype.startDestinationMesh = function(config){

  var _this = this;

  return new Promise(function(resolve, reject){

    try{

      var destinationConfig = _this.__parseDestinationConfig(config);

      Mesh.create(destinationConfig, function (err, instance) {

        if (err) return reject(err);

        resolve(instance);
      });

    }catch(e){
      return reject(e);
    }
  });
};

ElasticFeedService.prototype.startSourceMesh = function(config){

  var _this = this;

  return new Promise(function(resolve, reject){

    try{

      var sourceConfig = _this.__parseSourceConfig(config);

      Mesh.create(destinationConfig, function (err, instance) {

        if (err) return reject(err);

        _this.destinationMesh = instance;

        Mesh.create(_this.__happnerConfigInput, function (err, instance) {

          if (err) return reject(err);

          _this.sourceMesh = instance;

          callback();
        });
      });

    }catch(e){
      return reject(e);
    }
  });
};



module.exports = ElasticFeedService;