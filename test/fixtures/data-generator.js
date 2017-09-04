var TestUtilities = require('./utilities');

var SystemUtilities = require('../../lib/utilities');

var testUtilities = new TestUtilities();

var systemUtilities = new SystemUtilities();

var async = require('async');

var labels = [
  'label0',
  'label1',
  'label2',
  'label3'
];

var paths = [
  'test',
  'everyone',
  'noone',
  'admin'
];

function DataGenerator(options) {
  this.__options = options;
}

DataGenerator.create = function(options){
  return new DataGenerator(options);
};

DataGenerator.prototype.generate = generate;

module.exports = DataGenerator;

function generate (opts, callback) {

  if (typeof opts == 'function') {
    callback = opts;
    opts = {};
  }

  var happn = require('happn-3').service;

  var happnConfig = {
    port: 55000,
    secure: true,
    services: {
      data: {
        config: {
          datastores: [
            {
              name: 'happner-elastic-feed',
              provider: 'happner-elastic-dataprovider',
              isDefault:true,
              settings: {
                host: 'http://localhost:9200',
                dataroutes: [{
                  pattern: "/happner-feed-data/{{index}}/{{type}}/*",
                  dynamic: true
                }]
              },
              patterns: [
                '/happner-feed-data/*'
              ]
            }
          ]
        }
      }
    }
  };

  if (!opts.rows) opts.rows = 10;

  if (!opts.index) opts.index = 'testdata';

  if (!opts.type) opts.type = 'testdatatype';

  if (!opts.username) opts.username = '_ADMIN';

  if (!opts.password) opts.password = 'happn';

  var generatedPaths = [];

  happn.create(happnConfig)

    .then(function(instance){

      return instance.services.session.localClient({username:opts.username, password:opts.password});
    })

    .then (function(client){

      return new Promise(function(resolve, reject){

        async.timesSeries(opts.rows, function(rowNumber, rowCB){

          var timestamp = Date.now();

          var label = labels[testUtilities.integer(1, 3)];

          var path = paths[testUtilities.integer(1, 3)];

          var value = testUtilities.integer(1, 1000000);

          var dataPath = '/happner-feed-data/' + opts.index + '/' + opts.type + '/' + path + '/' + timestamp.toString();

          var obj = {
            value:value,
            label:label,
            timestamp:timestamp
          }

          client.set(dataPath, obj, function(e){

            setTimeout(function(){
              console.log('created row:::' + dataPath, JSON.stringify(obj, null, 2));
              generatedPaths.push(dataPath);
              rowCB(e);
            }, 100);

          })

        }, function(e){
          if (e) return reject(e);
          resolve();
        });
      });
    })
    .then (function(){
      callback(null, generatedPaths);
    })
    .catch(function(e){
      callback(e, generatedPaths);
    });
}

//see if we are calling this file as a commandline
var services = systemUtilities.readConfigArgv({"exitOnFail": true});

if (!services.generator) return;

generate(services.generator, function(e, paths){

  if (e) return 'generation of paths failed: ' + e.toString();

  if (e) return 'generation of paths succeeded: ' + paths.length;
});





