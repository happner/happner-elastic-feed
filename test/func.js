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

    it('starts up and stops an elastic a emitter mesh', function(done){

      var service = new Service();
      var emitterConfig = {};

      service
        .emitter(emitterConfig)
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
          return service.emitter(workerConfig);
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

  context.only('queue', function(){

    it('tests the queue functions', function(done){

      this.timeout(10000);

      var Queue = require('../lib/queue');

      var queue = new Queue();

      var attached1 = null;

      var attached2 = null;

      var attached3 = null;

      var attached4 = null;

      var created1 = null;

      var created2 = null;

      var created3 = null;

      var popped1 = null;

      var popped2 = null;

      var popped3 = null;

      var createdBatchId = null;

      queue.initialize()
        .then(function(){
          return  queue.attach({test:1, type:queue.JOB_TYPE.EMITTER})
        })
        .then(function(workerId){

          attached1 = workerId;

          expect(workerId.split('_')[0]).to.be('1');
          expect(queue.metrics().attached[queue.JOB_TYPE.EMITTER]).to.be(1);

          return queue.detach(workerId);
        })
        .then(function(workerId){

          expect(attached1).to.eql(workerId);

          return queue.attach({test:2, type:queue.JOB_TYPE.SUBSCRIBER});
        })
        .then(function(workerId){

          attached2 = workerId;
          return queue.attach({test:3, type:queue.JOB_TYPE.SUBSCRIBER});
        })
        .then(function(workerId){

          attached3 = workerId;
          return queue.attach({test:4, type:queue.JOB_TYPE.SUBSCRIBER});
        })
        .then(function(workerId){
          attached4 = workerId;
          return queue.createBatch({data:{test:'batch'}, type:queue.JOB_TYPE.SUBSCRIBER, count:3});
        })
        .then(function(batchId){
          createdBatchId = batchId;
          return queue.createJob({data:{test:5}, type:queue.JOB_TYPE.SUBSCRIBER, batchId:createdBatchId});
        })
        .then(function(createdJob){

          created1 = createdJob;
          return queue.createJob({data:{test:6}, type:queue.JOB_TYPE.SUBSCRIBER, batchId:createdBatchId});
        })
        .then(function(createdJob){

          created2 = createdJob;
          return queue.createJob({data:{test:7}, type:queue.JOB_TYPE.SUBSCRIBER, batchId:createdBatchId});
        })
        .then(function(createdJob){

          var _this = this;

          return new Promise(function(resolve){

            setTimeout(resolve.bind(_this), 2000);
          });
        })
        .then(function(createdJob){

          created3 = createdJob;

          expect(queue.metrics().pending[queue.JOB_TYPE.SUBSCRIBER]).to.be(3);

          return queue.pop({workerId:attached2})
        })
        .then(function(poppedJob){

          popped1 = poppedJob;

          expect(popped1.data.test).to.be(5);

          expect(queue.metrics().pending[queue.JOB_TYPE.SUBSCRIBER]).to.be(2);

          return queue.pop({workerId:attached3})
        })
        .then(function(poppedJob){

          popped2 = poppedJob;
          expect(popped2.data.test).to.be(6);

          expect(queue.metrics().pending[queue.JOB_TYPE.SUBSCRIBER]).to.be(1);

          return queue.pop({workerId:attached4})
        })
        .then(function(poppedJob){

          popped3 = poppedJob;

          expect(popped3.data.test).to.be(7);

          expect(queue.metrics().busy[queue.JOB_TYPE.SUBSCRIBER]).to.be(3);

          return queue.getBatch(popped3.batchId);
        })
        .then(function(batch){

          expect(batch.data.test).to.be('batch');
          done();
        });
    });

    xit('attaches 2 emitter listeners via the mesh', function(done){

      var queueService = new Service();

      var emitter1Service = new Service();

      var emitter2Service = new Service();

      var queueConfig = {
        name:"happner-elastic-queue",
        happn:{
          port:55000,
          adminPassword: 'happn'
        }
      };

      var emitter1Config = {queue:{username:'_ADMIN', password:'happn', port:55000}, port:55001};

      var emitter2Config = {queue:{username:'_ADMIN', password:'happn', port:55000}, port:55002};

      service
        .queue(queueConfig)
        .then(function(){

          return emitter1Service.emitter(emitter1Config);
        })
        .then(function(){

          return emitter2Service.emitter(emitter2Config)
        })
        .then(function(){

          return emitter1Service.components.worker.attachQueue();
        })
        .then(function(){
          var metrics = queueService.components.queue.metrics();

          expect(metrics.attached[queueService.components.JOB_TYPE.EMITTER]).to.be(1);
        })
        .then(function(){

          return emitter1Service.components.worker.detachQueue();
        })
        .then(function(){
          var metrics = queueService.components.queue.metrics();

          expect(metrics.attached[queueService.components.JOB_TYPE.EMITTER]).to.be(0);
        })
        .catch(done);
    });

    xit('registers an subscriber listener', function(done){

    });

    xit('creates a batch with 2 jobs', function(done){

    });

    xit('round robins a worker from the queue, ensures we are cycling through available workers', function(done){

    });

    xit('stops the queue, restarts the queue, ensures persistence', function(done){

    });
  });

  context('feeds', function(){

  });

  context('portal', function(){

  });

  context('service', function(){

  });

});