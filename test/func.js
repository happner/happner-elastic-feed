describe('func', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var Service = require('..');

  var globals = require('../lib/globals');

  var request = require('request');

  var fs = require('fs');

  context.only('queue', function(){

    it('tests the queue functions', function(done) {

      this.timeout(10000);

      var Queue = require('../lib/queue');

      var queue = new Queue();

      queue.___id = 'id-1';

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

      queue.initialize({kue:{prefix:'test-1'}})
        .then(function () {
          return queue.attach({test: 11, type: queue.JOB_TYPE.EMITTER})
        })
        .then(function (workerId) {

          attached1 = workerId;

          expect(workerId.split('_')[0]).to.be('1');
          expect(queue.metrics().attached[queue.JOB_TYPE.EMITTER]).to.be(1);

          return queue.detach({id:workerId});
        })
        .then(function (workerId) {

          expect(attached1).to.eql(workerId);

          return queue.attach({test: 12, type: queue.JOB_TYPE.SUBSCRIBER});
        })
        .then(function (workerId) {

          attached2 = workerId;
          return queue.attach({test: 13, type: queue.JOB_TYPE.SUBSCRIBER});
        })
        .then(function (workerId) {

          attached3 = workerId;
          return queue.attach({test: 14, type: queue.JOB_TYPE.SUBSCRIBER});
        })
        .then(function (workerId) {
          attached4 = workerId;
          return queue.createBatch({data: {test: 'batch'}, type: queue.JOB_TYPE.SUBSCRIBER, count: 3});
        })
        .then(function (batchId) {
          createdBatchId = batchId;
          return queue.createJob({data: {test: 15}, type: queue.JOB_TYPE.SUBSCRIBER, batchId: createdBatchId});
        })
        .then(function (createdJob) {

          created1 = createdJob;
          return queue.createJob({data: {test: 16}, type: queue.JOB_TYPE.SUBSCRIBER, batchId: createdBatchId});
        })
        .then(function (createdJob) {

          created2 = createdJob;
          return queue.createJob({data: {test: 17}, type: queue.JOB_TYPE.SUBSCRIBER, batchId: createdBatchId});
        })
        .then(function (createdJob) {

          var _this = this;

          return new Promise(function (resolve) {

            setTimeout(resolve.bind(_this), 2000);
          });
        })
        .then(function (createdJob) {

          created3 = createdJob;

          expect(queue.metrics().pending[queue.JOB_TYPE.SUBSCRIBER]).to.be(3);

          return queue.pop({workerId: attached2})
        })
        .then(function (poppedJob) {

          popped1 = poppedJob;

          expect(popped1.data.test).to.be(15);

          expect(queue.metrics().pending[queue.JOB_TYPE.SUBSCRIBER]).to.be(2);

          return queue.pop({workerId: attached3})
        })
        .then(function (poppedJob) {

          popped2 = poppedJob;
          expect(popped2.data.test).to.be(16);

          expect(queue.metrics().pending[queue.JOB_TYPE.SUBSCRIBER]).to.be(1);

          return queue.pop({workerId: attached4})
        })
        .then(function (poppedJob) {

          popped3 = poppedJob;

          expect(popped3.data.test).to.be(17);

          expect(queue.metrics().busy[queue.JOB_TYPE.SUBSCRIBER]).to.be(3);

          return queue.getBatch(popped3.batchId);
        })
        .then(function (batch) {

          expect(batch.data.test).to.be('batch');

          return queue.updateJob({type: queue.JOB_TYPE.SUBSCRIBER, id: popped1.id, state: queue.JOB_STATE.COMPLETED});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.COMPLETED);

          expect(queue.metrics().busy[queue.JOB_TYPE.SUBSCRIBER]).to.be(2);

          return queue.updateJob({type: queue.JOB_TYPE.SUBSCRIBER, id: popped2.id, log: 'log this', progress: 70});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.BUSY);
          expect(updated.progress).to.be(70);
          expect(queue.metrics().busy[queue.JOB_TYPE.SUBSCRIBER]).to.be(2);

          return queue.updateJob({type: queue.JOB_TYPE.SUBSCRIBER, id: popped3.id, state: queue.JOB_STATE.COMPLETED});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.COMPLETED);
          expect(updated.progress).to.be(100);
          expect(queue.metrics().busy[queue.JOB_TYPE.SUBSCRIBER]).to.be(1);

          return queue.updateJob({type: queue.JOB_TYPE.SUBSCRIBER, id: popped2.id, state: queue.JOB_STATE.COMPLETED});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.COMPLETED);
          expect(updated.progress).to.be(100);
          expect(queue.metrics().busy[queue.JOB_TYPE.SUBSCRIBER]).to.be(0);

          return queue.pop({workerId: attached3})
        })
        .then(function (popped) {

          expect(popped).to.be(false);
          return queue.pop({workerId: attached2})
        })
        .then(function (popped) {

          expect(popped).to.be(false);
          return queue.pop({workerId: attached1})
        })
        .then(function (popped) {

          expect(popped).to.be(false);

          queue.stop().then(done);
        });

    });

    it('tests dropping a worker and transferring jobs to a different one', function(done){

      this.timeout(10000);

      var Queue = require('../lib/queue');

      var queue = new Queue();

      queue.___id = 'id-2';

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

      var popped4 = null;

      var createdBatchId = null;

      queue.initialize({kue:{prefix:'test-2'}})
        .then(function () {
          return queue.attach({test: 21, type: queue.JOB_TYPE.SUBSCRIBER})
        })
        .then(function (workerId) {
          attached1 = workerId;
          return queue.attach({test: 22, type: queue.JOB_TYPE.SUBSCRIBER});
        })
        .then(function (workerId) {

          attached2 = workerId;
          return queue.attach({test: 23, type: queue.JOB_TYPE.SUBSCRIBER});
        })
        .then(function (workerId) {

          attached3 = workerId;
          return queue.attach({test: 24, type: queue.JOB_TYPE.SUBSCRIBER});
        })
        .then(function (workerId) {
          attached4 = workerId;
          return queue.createBatch({data: {test: 'batch'}, type: queue.JOB_TYPE.SUBSCRIBER, count: 4});
        })
        .then(function (batchId) {
          createdBatchId = batchId;
          return queue.createJob({data: {test: 25}, type: queue.JOB_TYPE.SUBSCRIBER, batchId: createdBatchId});
        })
        .then(function (createdJob) {

          created1 = createdJob;
          return queue.createJob({data: {test: 26}, type: queue.JOB_TYPE.SUBSCRIBER, batchId: createdBatchId});
        })
        .then(function (createdJob) {

          created2 = createdJob;
          return queue.createJob({data: {test: 27}, type: queue.JOB_TYPE.SUBSCRIBER, batchId: createdBatchId});
        })
        .then(function (createdJob) {

          created2 = createdJob;
          return queue.createJob({data: {test: 28}, type: queue.JOB_TYPE.SUBSCRIBER, batchId: createdBatchId});
        })
        .then(function (createdJob) {

          var _this = this;

          return new Promise(function (resolve) {

            setTimeout(resolve.bind(_this), 2000);
          });
        })
        .then(function (createdJob) {

          created3 = createdJob;

          expect(queue.metrics().pending[queue.JOB_TYPE.SUBSCRIBER]).to.be(4);

          return queue.pop({workerId: attached1})
        })
        .then(function (poppedJob) {

          popped1 = poppedJob;

          expect(popped1.data.test).to.be(25);

          expect(queue.metrics().pending[queue.JOB_TYPE.SUBSCRIBER]).to.be(3);

          return queue.pop({workerId: attached2})
        })
        .then(function (poppedJob) {

          popped2 = poppedJob;

          expect(popped2.data.test).to.be(26);

          expect(queue.metrics().pending[queue.JOB_TYPE.SUBSCRIBER]).to.be(2);

          return queue.pop({workerId: attached3})
        })
        .then(function (poppedJob) {

          popped3 = poppedJob;

          expect(popped3.data.test).to.be(27);

          expect(queue.metrics().busy[queue.JOB_TYPE.SUBSCRIBER]).to.be(3);

          return queue.pop({workerId: attached4})
        })
        .then(function (poppedJob) {

          popped4 = poppedJob;

          expect(popped4.data.test).to.be(28);

          expect(queue.metrics().busy[queue.JOB_TYPE.SUBSCRIBER]).to.be(4);

          return queue.detach({id: attached4, reAssign:true});
        })
        .then(function (detached) {

          expect(detached).to.be(attached4);

          expect(queue.assignedJobs[queue.JOB_TYPE.SUBSCRIBER][0].kue.id).to.be(popped4.id);

          var reassignedWorker = queue.assignedJobs[queue.JOB_TYPE.SUBSCRIBER][0].workerId;

          expect(reassignedWorker != attached4).to.be(true);

          return queue.pop({workerId: reassignedWorker})

        })
        .then(function (popped) {

          console.log('final-pop:::', popped);

          expect(popped.data.test).to.not.be(null);

          queue.stop().then(done);
        });
    });
  });

  context('service', function(){

    xit('starts up and stops an elastic a queue mesh', function(done){

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
      var emitterConfig = {};
      var portalConfig = {};

      service
        .portal(portalConfig)
        .then(function(){
          return service.worker(workerConfig);
        })
        .then(function(){
          return service.emitter(emitterConfig);
        })
        .then(function(){
          return service.subscriber(subscriberConfig);
        })
        .then(function(){
          return service.queue(queueConfig);
        })
        .then(function(){
          service.stop(done);
        })
        .catch(done);
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