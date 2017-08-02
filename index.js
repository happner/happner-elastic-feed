var Promise = require('bluebird')
  , Mesh = require('happner-2')
  , Source = require('./lib/source')
  , Destination = require('./lib/destination')
  , Feed = require('./lib/feed')
  , Portal = require('./lib/portal/component')
  , Queue = require('./lib/queue')
  , Service = require('./lib/service')
  , Utilities = require('./lib/utilities')
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
    port:config.input.port,
    secure:true,
    services: {
      security:{
        adminPassword:CREDS_INPUT_PASSWORD
      },
      data: {
        config: {
          datastores: [
            {
              name: 'elastic-feed-in',
              provider: 'happner-elastic-dataprovider',
              settings: {
                host: config.input.url,
                indexes: config.input.indexes,
                dataroutes: config.input.dataroutes
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
      },
      "utilities": {
        instance: new Utilities(config.input.utilities)
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
      },
      "utilities": {}
    }
  };

  return config;
};

ElasticFeedService.prototype.__parseDestinationConfig = function(config){

  if (!config.output) config.output = {};

  if (!config.output.port) config.output.port = 55001;

  if (!config.input) config.input = {};

  if (!config.input.port) config.input.port = 55000;

  if (!config.output.elastic_url) config.output.elastic_url = "http://localhost:9200";

  if (!config.output.dataroutes) config.output.dataroutes = [
    {
      dynamic: true,//dynamic routes generate a new index/type according to the items in the path
      pattern: "/feed/{{index}}/{{type}}/{{metric}}/{{timestamp:date}}/{{value:integer}}"
    },
    {
      dynamic: true,//dynamic routes generate a new index/type according to the items in the path
      pattern: "/system/{{type}}",
      index: "happner-system"
    }
  ];

  if (!config.output.indexes) config.output.indexes = [
    {index: "happner-system"},
    {index: "happner-feed"}
  ];

  var CREDS_INPUT_PASSWORD = process.env.INPUT_PASSWORD?process.env.INPUT_PASSWORD:'happn';
  var CREDS_OUTPUT_PASSWORD = process.env.OUTPUT_PASSWORD?process.env.OUTPUT_PASSWORD:CREDS_INPUT_PASSWORD;

  var __happnConfigOutput = {
    port:config.output.port,
    secure:true,
    services: {
      security:{
        adminPassword:CREDS_OUTPUT_PASSWORD
      },
      data: {
        config: {
          datastores: [
            {
              name: 'elastic-feed-out',
              provider: 'happner-elastic-dataprovider',
              settings: {
                host: config.output.url,
                indexes: config.output.indexes,
                dataroutes: config.output.dataroutes
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
      },
      "utilities": {
        instance: new Utilities(config.output.utilities)
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
      },
      "utilities": {}
    },
    endpoints:{
      "happner-elastic-feed-in": {
        config: {
          port: config.input.port,
          username: '_ADMIN',
          password: CREDS_INPUT_PASSWORD
        }
      }
    }
  };

  return config;
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

      Mesh.create(sourceConfig, function (err, instance) {

        if (err) return reject(err);

        resolve(instance);
      });

    }catch(e){
      return reject(e);
    }
  });
};



module.exports = ElasticFeedService;