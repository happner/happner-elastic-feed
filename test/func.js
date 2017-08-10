describe('func', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var Service = require('..');

  var request = require('request');

  var Queue = require('../lib/queue');

  var fs = require('fs');

  context('queue', function () {

    it('tests the queue functions', function (done) {

      this.timeout(10000);

      var queue = new Queue({
        kue: {prefix: 'test-1'},
        jobTypes: {
          "subscriber": {concurrency: 10},
          "emitter": {concurrency: 10}
        }
      });

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

      queue.initialize()
        .then(function () {
          return queue.attach({test: 11, jobType: "emitter"})
        })
        .then(function (workerId) {

          attached1 = workerId;

          expect(workerId.split('_')[0]).to.be('emitter');
          expect(queue.metrics().attached["emitter"]).to.be(1);

          return queue.detach({id: workerId});
        })
        .then(function (workerId) {

          expect(attached1).to.eql(workerId);

          return queue.attach({test: 12, jobType: "subscriber"});
        })
        .then(function (workerId) {

          attached2 = workerId;
          return queue.attach({test: 13, jobType: "subscriber"});
        })
        .then(function (workerId) {

          attached3 = workerId;
          return queue.attach({test: 14, jobType: "subscriber"});
        })
        .then(function (workerId) {
          attached4 = workerId;
          return queue.createBatch({data: {test: 'batch'}, jobType: "subscriber", count: 3});
        })
        .then(function (batchId) {
          createdBatchId = batchId;
          return queue.createJob({data: {test: 15}, jobType: "subscriber", batchId: createdBatchId});
        })
        .then(function (createdJob) {

          created1 = createdJob;
          return queue.createJob({data: {test: 16}, jobType: "subscriber", batchId: createdBatchId});
        })
        .then(function (createdJob) {

          created2 = createdJob;
          return queue.createJob({data: {test: 17}, jobType: "subscriber", batchId: createdBatchId});
        })
        .then(function (createdJob) {

          var _this = this;

          return new Promise(function (resolve) {

            setTimeout(resolve.bind(_this), 2000);
          });
        })
        .then(function (createdJob) {

          created3 = createdJob;

          expect(queue.metrics().pending["subscriber"]).to.be(3);

          return queue.pop({workerId: attached2})
        })
        .then(function (poppedJob) {

          popped1 = poppedJob;

          expect(popped1.data.test).to.be(15);

          expect(queue.metrics().pending["subscriber"]).to.be(2);

          return queue.pop({workerId: attached3})
        })
        .then(function (poppedJob) {

          popped2 = poppedJob;
          expect(popped2.data.test).to.be(16);

          expect(queue.metrics().pending["subscriber"]).to.be(1);

          return queue.pop({workerId: attached4})
        })
        .then(function (poppedJob) {

          popped3 = poppedJob;

          expect(popped3.data.test).to.be(17);

          expect(queue.metrics().busy["subscriber"]).to.be(3);

          return queue.getBatch(popped3.batchId);
        })
        .then(function (batch) {

          expect(batch.data.test).to.be('batch');

          return queue.updateJob({jobType: "subscriber", id: popped1.id, state: queue.JOB_STATE.COMPLETED});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.COMPLETED);

          expect(queue.metrics().busy["subscriber"]).to.be(2);

          return queue.updateJob({jobType: "subscriber", id: popped2.id, log: 'log this', progress: 70});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.BUSY);
          expect(updated.progress).to.be(70);
          expect(queue.metrics().busy["subscriber"]).to.be(2);

          return queue.updateJob({jobType: "subscriber", id: popped3.id, state: queue.JOB_STATE.COMPLETED});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.COMPLETED);
          expect(updated.progress).to.be(100);
          expect(queue.metrics().busy["subscriber"]).to.be(1);

          return queue.updateJob({jobType: "subscriber", id: popped2.id, state: queue.JOB_STATE.COMPLETED});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.COMPLETED);
          expect(updated.progress).to.be(100);
          expect(queue.metrics().busy["subscriber"]).to.be(0);

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

    it('tests dropping a worker and transferring jobs to a different one', function (done) {

      this.timeout(10000);

      var queue = new Queue({
        kue: {prefix: 'test-2'},
        jobTypes: {
          "subscriber": {concurrency: 10},
          "emitter": {concurrency: 10}
        }
      });

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

      queue.initialize()
        .then(function () {
          return queue.attach({test: 21, jobType: "subscriber"})
        })
        .then(function (workerId) {
          attached1 = workerId;
          return queue.attach({test: 22, jobType: "subscriber"});
        })
        .then(function (workerId) {

          attached2 = workerId;
          return queue.attach({test: 23, jobType: "subscriber"});
        })
        .then(function (workerId) {

          attached3 = workerId;
          return queue.attach({test: 24, jobType: "subscriber"});
        })
        .then(function (workerId) {
          attached4 = workerId;
          return queue.createBatch({data: {test: 'batch'}, jobType: "subscriber", count: 4});
        })
        .then(function (batchId) {
          createdBatchId = batchId;
          return queue.createJob({data: {test: 25}, jobType: "subscriber", batchId: createdBatchId});
        })
        .then(function (createdJob) {

          created1 = createdJob;
          return queue.createJob({data: {test: 26}, jobType: "subscriber", batchId: createdBatchId});
        })
        .then(function (createdJob) {

          created2 = createdJob;
          return queue.createJob({data: {test: 27}, jobType: "subscriber", batchId: createdBatchId});
        })
        .then(function (createdJob) {

          created2 = createdJob;
          return queue.createJob({data: {test: 28}, jobType: "subscriber", batchId: createdBatchId});
        })
        .then(function (createdJob) {

          var _this = this;

          return new Promise(function (resolve) {

            setTimeout(resolve.bind(_this), 2000);
          });
        })
        .then(function (createdJob) {

          created3 = createdJob;

          expect(queue.metrics().pending["subscriber"]).to.be(4);

          return queue.pop({workerId: attached1})
        })
        .then(function (poppedJob) {

          popped1 = poppedJob;

          expect(popped1.data.test).to.be(25);

          expect(queue.metrics().pending["subscriber"]).to.be(3);

          return queue.pop({workerId: attached2})
        })
        .then(function (poppedJob) {

          popped2 = poppedJob;

          expect(popped2.data.test).to.be(26);

          expect(queue.metrics().pending["subscriber"]).to.be(2);

          return queue.pop({workerId: attached3})
        })
        .then(function (poppedJob) {

          popped3 = poppedJob;

          expect(popped3.data.test).to.be(27);

          expect(queue.metrics().busy["subscriber"]).to.be(3);

          return queue.pop({workerId: attached4})
        })
        .then(function (poppedJob) {

          popped4 = poppedJob;

          expect(popped4.data.test).to.be(28);

          expect(queue.metrics().busy["subscriber"]).to.be(4);

          return queue.detach({id: attached4, reAssign: true});
        })
        .then(function (detached) {

          expect(detached).to.be(attached4);

          expect(queue.__assignedJobs["subscriber"][0].kue.id).to.be(popped4.id);

          var reassignedWorker = queue.__assignedJobs["subscriber"][0].workerId;

          expect(reassignedWorker != attached4).to.be(true);

          return queue.pop({workerId: reassignedWorker})

        })
        .then(function (popped) {

          expect(popped.data.test).to.not.be(null);

          queue.stop().then(done);
        });
    });
  });

  context('service', function () {

    xit('starts up and stops an elastic a queue mesh', function (done) {

      var service = new Service();

      var queueConfig = {
        jobTypes: {
          "subscriber": {concurrency: 10},
          "emitter": {concurrency: 10}
        }
      };

      service
        .queue(queueConfig)
        .then(function () {
          service.stop(done);
        })
        .catch(done);
    });


    it('starts up and stops an elastic a subscriber mesh', function (done) {

      var service = new Service();
      var sourceConfig = {};

      service
        .subscriber(sourceConfig)
        .then(function () {
          service.stop(done);
        })
        .catch(done);
    });

    it('starts up and stops an elastic a emitter mesh', function (done) {

      var service = new Service();
      var emitterConfig = {};

      service
        .emitter(emitterConfig)
        .then(function () {
          service.stop(done);
        })
        .catch(done);
    });

    it('starts up and stops an elastic a portal mesh', function (done) {

      var service = new Service();
      var portalConfig = {};

      service
        .portal(portalConfig)
        .then(function () {
          service.stop(done);
        })
        .catch(done);
    });

    it('starts up and stops a combined mesh', function (done) {

      var service = new Service();

      var queueConfig = {
        jobTypes: {
          "subscriber": {concurrency: 10},
          "emitter": {concurrency: 10}
        }
      };

      var subscriberConfig = {};
      var workerConfig = {};
      var emitterConfig = {};
      var portalConfig = {};

      service
        .portal(portalConfig)
        .then(function () {
          return service.worker(workerConfig);
        })
        .then(function () {
          return service.emitter(emitterConfig);
        })
        .then(function () {
          return service.subscriber(subscriberConfig);
        })
        .then(function () {
          return service.queue(queueConfig);
        })
        .then(function () {
          service.stop(done);
        })
        .catch(done);
    });

    it.only('attaches 2 workers via the mesh, gets an emitted job', function (done) {

      var queueService = new Service();

      var worker1Service = new Service();

      var worker2Service = new Service();

      var queueConfig = {
        jobTypes: {
          "subscriber": {concurrency: 10},
          "emitter": {concurrency: 10}
        }
      };

      var worker1Config = {queue: {username: '_ADMIN', password: 'happn', port: 55000, jobTypes:["subscriber"]}, port: 55001};

      var worker2Config = {queue: {jobTypes:["emitter"]}, port: 55002};

      queueService
        .queue(queueConfig)
        .then(function () {

          return worker1Service.worker(worker1Config);
        })
        .then(function () {

          return worker2Service.worker(worker2Config);
        })
        .then(function () {

          var metrics = queueService.components.queue.metrics();

          expect(metrics.attached["subscriber"]).to.be(1);

          expect(metrics.attached["emitter"]).to.be(1);

          return new Promise(function(resolve){

            worker1Service.event.worker.on('subscriber', function(job){

              expect(job.data).to.be('some data');

              return resolve();
            });

            queueService.exchange.queue.createJob({jobType:'subscriber', data:'some data'});
          });

        })
        .then(function () {

          return new Promise(function(resolve){

            worker2Service.event.worker.on('emitter', function(job){

              expect(job.data).to.be('some emitter data');

              return resolve();
            });

            queueService.exchange.queue.createJob({jobType:'subscriber', data:'some emitter data'});
          });
        })
        .then(function () {

          worker1Service.stop()
            .then(function(){
              return worker2Service.stop();
            })
            .then(function(){
              return queueService.stop();
            })
            .then(done)
            .catch(done);
        })
        .catch(done);
    });

    xit('registers an subscriber listener', function (done) {

    });

    xit('creates a batch with 2 jobs', function (done) {

    });

    xit('round robins a worker from the queue, ensures we are cycling through available workers', function (done) {

    });

    xit('stops the queue, restarts the queue, ensures persistence', function (done) {

    });
  });

  context('feeds', function () {

  });

  context('portal', function () {

  });

  context('service', function () {

  });

});