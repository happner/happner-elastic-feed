describe('func', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var Service = require('..');

  var globals = require('../lib/globals');

  var request = require('request');

  var fs = require('fs');

  context('service', function(){

    it('starts up and stops an elastic a queue mesh', function(done){

      var service = new Service();
      var queueConfig = {};

      service
        .queue(queueConfig)
        .then(function(){
          service.stop(done);
        })
        .catch(done);
    });


    it('starts up and stops an elastic a subscriber mesh', function(done){

      var service = new Service();
      var sourceConfig = {};

      service
        .subscriber(sourceConfig)
        .then(function(){
          service.stop(done);
        })
        .catch(done);
    });

    it('starts up and stops an elastic a worker mesh', function(done){

      var service = new Service();
      var workerConfig = {};

      service
        .worker(workerConfig)
        .then(function(){
          service.stop(done);
        })
        .catch(done);
    });

    it('starts up and stops an elastic a portal mesh', function(done){

      var service = new Service();
      var portalConfig = {};

      service
        .portal(portalConfig)
        .then(function(){
          service.stop(done);
        })
        .catch(done);
    });

    it('starts up and stops a combined mesh', function(done){

      var service = new Service();

      var queueConfig = {};
      var subscriberConfig = {};
      var workerConfig = {};
      var portalConfig = {};

      service
        .queue(queueConfig)
        .then(function(){
          return service.portal(portalConfig);
        })
        .then(function(){
          return service.worker(workerConfig);
        })
        .then(function(){
          return service.subscriber(subscriberConfig);
        })
        .then(function(){
          service.stop(done);
        })
        .catch(done);
    });
  });

  context('queue', function(){

  });

  context('feeds', function(){

  });

  context('portal', function(){

  });

  context('service', function(){

  });

});