describe('func-wild-tree', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var testId = require('shortid').generate();

  var config = {
    test1: {}
  };

  var random = require('./fixtures/random');

  var WildTree = require('../lib/wild-tree');

  var VERBOSE = true;

  var testLog = function(message, object){
    if (VERBOSE){
      console.log(message);
      if (object) console.log(JSON.stringify(object, null,2));
    }
  };

  var SUBSCRIPTION_COUNT = 1000;

  var DUPLICATE_KEYS = 3;

  var CLIENT_COUNT = 10;

  it('adds non wildcard-subscriptions ', function (done) {

    this.timeout(300000);

    var subscriptions = random.randomPaths({duplicate:DUPLICATE_KEYS, count:SUBSCRIPTION_COUNT});

    var clients = random.string({count:CLIENT_COUNT});

    var subscriptionTree = new WildTree();

    var subscriptionResults = {};

    subscriptions.forEach(function(subscriptionPath){

      clients.forEach(function(sessionId){

        subscriptionTree.add(subscriptionPath, {key:sessionId, data:{test:"data"}});
      });
    });

    //testLog('subscriptionResults:::', subscriptionResults);

    //testLog('subscriptions:::', subscriptions);

    return done();
  });

  it('wildcard-subscriptions ', function (done) {

    this.timeout(300000);

    var subscriptions = random.randomPaths({duplicate:DUPLICATE_KEYS, count:SUBSCRIPTION_COUNT});

    var clients = random.string({count:CLIENT_COUNT});

    var subscriptionTree = new WildTree();

    var subscriptionResults = {};

    subscriptions.forEach(function(subscriptionPath){

      subscriptionPath = subscriptionPath.substring(0, subscriptionPath.length - 1) + '*';

      clients.forEach(function(sessionId){

        subscriptionTree.add(subscriptionPath, {key:sessionId, data:{test:"data"}});

        if (!subscriptionResults[sessionId]) subscriptionResults[sessionId] = {paths:{}};

        subscriptionResults[sessionId].paths[subscriptionPath] = true;
      });
    });

    subscriptions.forEach(function(subscriptionPath){

      subscriptionPath = subscriptionPath.substring(0, subscriptionPath.length - 1) + '*';

      subscriptionTree.search(subscriptionPath).forEach(function(recipients){

        expect(Object.keys(recipients).length).to.not.be(0);

        Object.keys(recipients).forEach(function(recipientKey){
          expect(subscriptionResults[recipientKey].paths[subscriptionPath]).to.be(true);
        });
      });
    });

    return done();
  });

  it('non wildcard-subscriptions ', function (done) {

    this.timeout(300000);

    var subscriptions = random.randomPaths({duplicate:DUPLICATE_KEYS, count:SUBSCRIPTION_COUNT});

    var clients = random.string({count:CLIENT_COUNT});

    var subscriptionTree = new WildTree();

    var subscriptionResults = {};

    subscriptions.forEach(function(subscriptionPath){

      clients.forEach(function(sessionId){

        subscriptionTree.add(subscriptionPath, {key:sessionId, data:{test:"data"}});

        if (!subscriptionResults[sessionId]) subscriptionResults[sessionId] = {paths:{}};

        subscriptionResults[sessionId].paths[subscriptionPath] = true;
      });
    });

    subscriptions.forEach(function(subscriptionPath){

      subscriptionTree.search(subscriptionPath).forEach(function(recipients){

        expect(Object.keys(recipients).length).to.not.be(0);

        Object.keys(recipients).forEach(function(recipientKey){
          expect(subscriptionResults[recipientKey].paths[subscriptionPath]).to.be(true);
        });
      });
    });

    // testLog('subscriptionResults:::', subscriptionResults);
    //
    // testLog('subscriptions:::', subscriptions);

    return done();
  });
});
