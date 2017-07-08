describe('sanity', function () {

  var expect = require('expect.js');

  var happner = require('happner-2');

  var happnerInstance;

  var path = require('path');

  var elasticFeed = require('..');//require('happner-elastic-feed');

  this.timeout(5000);

  var happnConfig = {
    secure:true,
    services: {
      data: {
        config: {
          datastores: [
            {
              name: 'elastic',
              provider: require('happner-elastic-dataprovider'),
              isDefault: true,
              settings: {
                host: "http://localhost:9200",
                indexes: [
                  {index: "_system"},
                  {index: "_feed"}
                ],
                dataroutes: [
                  {
                    dynamic: true,//dynamic routes generate a new index/type according to the items in the path
                    pattern: "/feed/{{index}}/{{type}}/{{metric}}/{{timestamp:date}}/{{value:integer}}"
                  },
                  {
                    dynamic: true,//dynamic routes generate a new index/type according to the items in the path
                    pattern: "/_system/{{type}}",
                    index: "_system"
                  }
                ]
              }
            }
          ]
        }
      }
    }
  };

  var config = {
    name: 'happner-elastic-feed',
    happn: happnConfig,
    modules: {
      "service": {
        path: elasticFeed.service
      },
      "portal": {
        path: elasticFeed.portal
      },
      "queue": {
        path: elasticFeed.queue
      },
      "feed": {
        path: elasticFeed.feed
      }
    },
    components:{
      "service":{
        startMethod: "initialize"
      },
      "portal": {
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
      }
    }
  };

  var remoteConfig = {
    name: 'happner-elastic-warehouse',
    port: 55001,
    secure:true,
    modules: {
      "logger": {
        path: require("./fixtures/logger")
      }
    }
  };

  before('should initialize the "remote" service', function (callback) {

    Mesh.create(remoteConfig, function (err, instance) {

      if (err) return callback(err);

      happnerInstance = instance;

      callback();
    });
  });

  before('should initialize the local service', function (callback) {

    Mesh.create(config, function (err, instance) {

      if (err) return callback(err);

      happnerInstance = instance;

      callback();
    });
  });

  after(function (done) {
    happnerInstance.stop(done);
  });


  var publisherclient;
  var listenerclient;

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  before('should initialize the clients', function (callback) {

    try {

      happnInstance.services.session.localClient(function (e, instance) {

        if (e) return callback(e);
        publisherclient = instance;

        happnInstance.services.session.localClient(function (e, instance) {

          if (e) return callback(e);
          listenerclient = instance;

          callback();
        });
      });

    } catch (e) {
      callback(e);
    }
  });

  it('should create a feed', function (callback) {

  });

  it('should create and list a feed', function (callback) {

  });

  it('should push some data into the warehouse and ensure the feed indexes contain the data', function (callback) {

  });

  it('access the portal feed view', function (callback) {

  });

  it('access the portal admin view', function (callback) {

  });

});
