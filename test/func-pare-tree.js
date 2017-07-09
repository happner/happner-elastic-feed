describe('func-wild-tree', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var shortid = require('shortid');

  var testId = require('shortid').generate();

  var config = {
    test1: {}
  };

  var random = require('./fixtures/random');

  var PareTree = require('../lib/pare-tree');

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

  it.only('sense checks subscriptions and their attendant queries', function (done) {

    this.timeout(300000);

    var subscriptionTree = new PareTree();

    var allKey = shortid.generate();

    var leftKey = shortid.generate();

    var rightKey = shortid.generate();

    var complexLeftKey = shortid.generate();

    var complexRightKey = shortid.generate();

    var multipleRightKey = shortid.generate();

    var multipleLeftKey = shortid.generate();

    var preciseKey = shortid.generate();

    var doubleSubscribePreciseKey = shortid.generate();

    var doubleSubscribeRightKey = shortid.generate();

    var doubleSubscribeLeftKey = shortid.generate();

    var searchResults = [];

    subscriptionTree.add('***', {key:allKey, data:{test:1}});

    subscriptionTree.add('*/test/left', {key:leftKey, data:{test:2}});

    subscriptionTree.add('test/right/*', {key:rightKey, data:{test:3}});

    subscriptionTree.add('short/*/test/complex', {key:complexLeftKey, data:{test:4}});

    subscriptionTree.add('/test/complex/*/short', {key:complexRightKey, data:{test:5}});

    subscriptionTree.add('test/right/*/short/*/short', {key:multipleRightKey, data:{test:6}});

    subscriptionTree.add('short/*test/right/*/short', {key:multipleLeftKey, data:{test:7}});

    subscriptionTree.add('/precise/test', {key:preciseKey, data:{test:8}});

    subscriptionTree.add('/precise/double', {key:doubleSubscribePreciseKey, data:{test:9}});

    subscriptionTree.add('/precise/double', {key:doubleSubscribePreciseKey, data:{test:10}});

    subscriptionTree.add('double/right/*', {key:doubleSubscribeRightKey, data:{test:11}});

    subscriptionTree.add('double/right/*', {key:doubleSubscribeRightKey, data:{test:12}});

    subscriptionTree.add('*/double/left', {key:doubleSubscribeLeftKey, data:{test:13}});

    subscriptionTree.add('*/double/left', {key:doubleSubscribeLeftKey, data:{test:14}});

    searchResults.push({path:'a/test/left',results:subscriptionTree.search('a/test/left')});

    searchResults.push({path:'test/right/a',results:subscriptionTree.search('test/right/a')});

    searchResults.push({path:'short/and/test/complex',results:subscriptionTree.search('short/and/test/complex')});

    searchResults.push({path:'/test/complex/and/short',results:subscriptionTree.search('/test/complex/and/short')});

    searchResults.push({path:'test/right/and/short/and/short',results:subscriptionTree.search('test/right/and/short/and/short')});

    searchResults.push({path:'short/andtest/right/and/short',results:subscriptionTree.search('short/andtest/right/and/short')});

    searchResults.push({path:'/precise/test',results:subscriptionTree.search('/precise/test')});

    searchResults.push({path:'/precise/double',results:subscriptionTree.search('/precise/double')});

    searchResults.push({path:'double/right/and',results:subscriptionTree.search('double/right/and')});

    searchResults.push({path:'/precise/double',results:subscriptionTree.search('/precise/double')});

    searchResults.push({path:'and/double/left',results:subscriptionTree.search('and/double/left')});

    console.log(JSON.stringify(searchResults, null, 2));

    return done();
  });

  it('adds and verifies random non wildcard-subscriptions ', function (done) {

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

    return done();
  });

  it('adds and verifies random wildcard-subscriptions ', function (done) {

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

  it('adds and verifies random non wildcard-subscriptions ', function (done) {

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
