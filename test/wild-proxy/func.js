describe('wild-proxy-functional-tests', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var testUtilities = require('../fixtures/utilities').create();

  it('test the config options', function (done) {

    var steps = [];

    var __handleRequest1 = function (proxyReq, req, res, $happn, rule) {
      steps.push(rule);
    };

    var __handleRequest2 = function (proxyReq, req, res, $happn, rule) {
      steps.push(rule);
    };

    var __handleRequest21 = function (proxyReq, req, res, $happn, rule) {
      steps.push(rule);
    };

    var __handleRequest22 = function (proxyReq, req, res, $happn, rule) {
      steps.push(rule);
    };

    var __handleRequest23 = function (proxyReq, req, res, $happn, rule) {
      steps.push(rule);
    };

    var wildProxyConfig = {

      listeners: [
        {
          name: 'listener-1',
          port: 55555,
          protocol: 'http',
          target: 'http://localhost:55554',
          rule: 'rules-1'
        },
        {
          name: 'listener-2',
          port: 65555,
          protocol: 'http',
          target: 'http://localhost:66664',
          rule: 'rules-2'
        }
      ],
      rules: [
        {
          name: 'rules-1',
          path: '*',
          handler: __handleRequest1.bind(__handleRequest1),
          terminate: true
        },
        {
          name: 'rules-2',
          steps: [
            {
              name: 'rules-20',
              path: '/auth?*',
              handler: __handleRequest2.bind(__handleRequest2),
              terminate: true
            },
            {
              name: 'rules-21',
              path: '*',
              handler: __handleRequest21.bind(__handleRequest21)
            },
            {
              name: 'rules-22',
              path: '/dashboards?*',
              handler: __handleRequest22.bind(__handleRequest22),
              terminate: true
            },
            {
              name: 'rules-23',
              path: '/app/kibana*',
              handler: __handleRequest23.bind(__handleRequest23),
              terminate: true
            },
            {
              name: 'rules-24',
              path: '*',
              bad: true
            }
          ]
        }
      ]
    };

    var wildProxy = require('../../lib/components/portal/wild-proxy').create(wildProxyConfig);

    done();
  });

  it('test the config options, gets the steps', function (done) {

    var steps = [];

    var __handleRequest1 = function (proxyReq, req, res, $happn, rule) {
      steps.push(rule);
    };

    var __handleRequest2 = function (proxyReq, req, res, $happn, rule) {
      steps.push(rule);
    };

    var __handleRequest21 = function (proxyReq, req, res, $happn, rule) {
      steps.push(rule);
    };

    var __handleRequest22 = function (proxyReq, req, res, $happn, rule) {
      steps.push(rule);
    };

    var __handleRequest23 = function (proxyReq, req, res, $happn, rule) {
      steps.push(rule);
    };

    var listener1 = {
      name: 'listener-1',
      port: 55555,
      protocol: 'http',
      target: 'http://localhost:55554',
      rule: 'rules-1'
    };

    var listener2 = {
      name: 'listener-2',
      port: 65555,
      protocol: 'http',
      target: 'http://localhost:65554',
      rule: 'rules-2'
    };

    var wildProxyConfig = {

      listeners: [listener1, listener2],
      rules: [
        {
          name: 'rules-1',
          path: '*',
          handler: __handleRequest1.bind(__handleRequest1),
          terminate: true
        },
        {
          name: 'rules-2',
          steps: [
            {
              name: 'rules-20',
              path: '/auth?*',
              handler: __handleRequest2.bind(__handleRequest2),
              terminate: true
            },
            {
              name: 'rules-21',
              path: '*',
              handler: __handleRequest21.bind(__handleRequest21)
            },
            {
              name: 'rules-22',
              path: '/dashboards?*',
              handler: __handleRequest22.bind(__handleRequest22),
              terminate: true
            },
            {
              name: 'rules-23',
              path: '/app/kibana*',
              handler: __handleRequest23.bind(__handleRequest23),
              terminate: true
            },
            {
              name: 'rules-24',
              path: '*',
              bad: true
            }
          ]
        }
      ]
    };

    var wildProxy = require('../../lib/components/portal/wild-proxy').create(wildProxyConfig);

    var stack = wildProxy.__listeners[0].__getRuleStack('/' + testUtilities.string());

    expect(stack.length).to.be(1);

    stack = wildProxy.__listeners[1].__getRuleStack('/auth?' + testUtilities.string());

    expect(stack.length).to.be(3);

    expect(stack[0].name).to.be('rules-20');

    expect(stack[1].name).to.be('rules-21');

    expect(stack[2].name).to.be('rules-24');

    stack = wildProxy.__listeners[1].__getRuleStack('/dashboards?happn_token=' + testUtilities.string());

    expect(stack.length).to.be(3);

    expect(stack[0].name).to.be('rules-21');

    expect(stack[1].name).to.be('rules-22');

    expect(stack[2].name).to.be('rules-24');

    stack = wildProxy.__listeners[1].__getRuleStack('/app/kibana/' + testUtilities.string());

    expect(stack.length).to.be(3);

    expect(stack[0].name).to.be('rules-21');

    expect(stack[1].name).to.be('rules-23');

    expect(stack[2].name).to.be('rules-24');

    stack = wildProxy.__listeners[1].__getRuleStack('/blah/' + testUtilities.string());

    expect(stack.length).to.be(2);

    expect(stack[0].name).to.be('rules-21');

    expect(stack[1].name).to.be('rules-24');

    done();
  });

  it('test the config options, does an end-to-end http proxy run, confirms the steps', function (done) {

    this.timeout(25000)

    var steps = {};

    var http = require('http');

    var server1 = http.createServer(function(req, res) {

      var message = 'echo: ' + req.url + ', steps: ' + steps[req.url].join(',');
      //console.log(message);
      res.end(message);
    });

    var server2 = http.createServer(function(req, res) {

      var message = 'echo: ' + req.url + ', steps: ' + steps[req.url].join(',');
      //console.log(message);
      res.end(message);
    });

    server1.listen(55554);

    server2.listen(44443);

    setTimeout(function(){

      var __handleRequest1 = function (proxyReq, req, res, $happn, rule) {

        return new Promise(function(resolve){
          if (!steps[req.url]) steps[req.url] = [];
          steps[req.url].push(rule.name);
          return resolve();
        })
      };

      var __handleRequest2 = function (proxyReq, req, res, $happn, rule) {

        return new Promise(function(resolve){
          if (!steps[req.url]) steps[req.url] = [];
          steps[req.url].push(rule.name);
          return resolve();
        })
      };

      var __handleRequest21 = function (proxyReq, req, res, $happn, rule) {

        return new Promise(function(resolve){
          if (!steps[req.url]) steps[req.url] = [];
          steps[req.url].push(rule.name);
          return resolve();
        })
      };

      var __handleRequest22 = function (proxyReq, req, res, $happn, rule) {

        return new Promise(function(resolve){
          if (!steps[req.url]) steps[req.url] = [];
          steps[req.url].push(rule.name);
          return resolve();
        })
      };

      var __handleRequest23 = function (proxyReq, req, res, $happn, rule) {

        return new Promise(function(resolve){
          if (!steps[req.url]) steps[req.url] = [];
          steps[req.url].push(rule.name);
          return resolve();
        })
      };

      var __handleBadRequest = function (proxyReq, req, res, $happn, rule) {

        return new Promise(function(resolve){

          if (!steps[req.url]) steps[req.url] = [];

          steps[req.url].push(rule.name);

          return resolve();
        })
      };

      var listener1 = {
        name: 'listener-1',
        port: 55555,
        protocol: 'http',
        target: 'http://localhost:55554',
        rule: 'rules-1'
      };

      var listener2 = {
        name: 'listener-2',
        port: 44444,
        protocol: 'http',
        target: 'http://localhost:44443',
        rule: 'rules-2'
      };

      var wildProxyConfig = {

        listeners: [listener1, listener2],
        rules: [
          {
            name: 'rules-1',
            path: '*',
            handler: __handleRequest1.bind(__handleRequest1),
            terminate: true
          },
          {
            name: 'rules-2',
            steps: [
              {
                name: 'rules-20',
                path: '/auth?*',
                handler: __handleRequest2.bind(__handleRequest2),
                terminate: true
              },
              {
                name: 'rules-21',
                path: '*auth*',
                handler: __handleRequest21.bind(__handleRequest21)
              },
              {
                name: 'rules-22',
                path: '/dashboards?*',
                handler: __handleRequest22.bind(__handleRequest22),
                terminate: true
              },
              {
                name: 'rules-23',
                path: '/app/kibana*',
                handler: __handleRequest23.bind(__handleRequest23),
                terminate: true
              },
              {
                name: 'rules-bad',
                path: '*',
                handler: __handleBadRequest.bind(__handleBadRequest)
              }
            ]
          }
        ]
      };

      var wildProxy = require('../../lib/components/portal/wild-proxy').create(wildProxyConfig);

      var randomString = testUtilities.string();

      wildProxy.listen()

        .then(function(){

          return testUtilities.doRequest('http', '127.0.0.1', 55555, '/' + randomString, null);
        })

        .then(function(response){

          expect(response.body.toString()).to.be('echo: /' + randomString + ', steps: rules-1');

          return testUtilities.doRequest('http', '127.0.0.1', 44444, '/auth?' + randomString, null);
        })

        .then(function(response){

          expect(response.body.toString()).to.be('echo: /auth?' + randomString + ', steps: rules-20');

          return testUtilities.doRequest('http', '127.0.0.1', 44444, '/dashboards?' + randomString, null);
        })

        .then(function(response){

          expect(response.body.toString()).to.be('echo: /dashboards?' + randomString + ', steps: rules-22');

          return testUtilities.doRequest('http', '127.0.0.1', 44444, '/app/kibana/' + randomString, null);
        })

        .then(function(response){

          expect(response.body.toString()).to.be('echo: /app/kibana/' + randomString + ', steps: rules-23');

          return testUtilities.doRequest('http', '127.0.0.1', 44444, '/bad/' + randomString, null);
        })

        .then(function(response){

          expect(response.body.toString()).to.be('echo: /bad/' + randomString + ', steps: rules-bad');

          done();
        })

        .catch(done);

    }, 2000);
  });

});