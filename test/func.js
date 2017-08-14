describe('func', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var Service = require('..');

  var request = require('request');

  var Queue = require('../lib/queue');

  var fs = require('fs');

  var uuid = require('uuid');

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

          return queue.detach({workerId: workerId});
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
          return queue.getBatch(createdBatchId);
        })
        .then(function (batch) {
          expect(batch.data.test).to.be('batch');
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

          created3 = createdJob;

          var _this = this;

          return new Promise(function (resolve) {

            setTimeout(resolve.bind(_this), 2000);
          });
        })
        .then(function (createdJob) {

          created3 = createdJob;

          expect(queue.metrics().assigned["subscriber"]).to.be(3);

          return queue.pop({workerId: attached2})
        })
        .then(function (poppedJob) {

          popped1 = poppedJob;

          expect(popped1.data.test).to.be(15);

          expect(queue.metrics().assigned["subscriber"]).to.be(2);

          return queue.pop({workerId: attached3})
        })
        .then(function (poppedJob) {

          popped2 = poppedJob;
          expect(popped2.data.test).to.be(16);

          expect(queue.metrics().assigned["subscriber"]).to.be(1);

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

          return queue.updateBusyJob({jobType: "subscriber", id: popped1.id, state: queue.JOB_STATE.COMPLETED});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.COMPLETED);

          expect(queue.metrics().busy["subscriber"]).to.be(2);

          return queue.updateBusyJob({jobType: "subscriber", id: popped2.id, log: 'log this', progress: 70});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.BUSY);
          expect(updated.progress).to.be(70);
          expect(queue.metrics().busy["subscriber"]).to.be(2);

          return queue.updateBusyJob({jobType: "subscriber", id: popped3.id, state: queue.JOB_STATE.COMPLETED});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.COMPLETED);
          expect(updated.progress).to.be(100);
          expect(queue.metrics().busy["subscriber"]).to.be(1);

          return queue.updateBusyJob({jobType: "subscriber", id: popped2.id, state: queue.JOB_STATE.COMPLETED});
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

          queue.stop(done);
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

      var attached1 = null;

      var attached2 = null;

      var attached3 = null;

      var attached4 = null;

      var created1 = null;

      var created2 = null;

      var created3 = null;

      var created4 = null;

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

          created3 = createdJob;
          return queue.createJob({data: {test: 28}, jobType: "subscriber", batchId: createdBatchId});
        })
        .then(function (createdJob) {

          var _this = this;

          created4 = createdJob;

          return new Promise(function (resolve) {

            setTimeout(resolve.bind(_this), 2000);
          });
        })
        .then(function () {

          expect(queue.metrics().assigned["subscriber"]).to.be(4);

          return queue.pop({workerId: attached1})
        })
        .then(function (poppedJob) {

          popped1 = poppedJob;

          expect(popped1.data.test).to.be(25);

          expect(queue.metrics().assigned["subscriber"]).to.be(3);

          return queue.pop({workerId: attached2})
        })
        .then(function (poppedJob) {

          popped2 = poppedJob;

          expect(popped2.data.test).to.be(26);

          expect(queue.metrics().assigned["subscriber"]).to.be(2);

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

          return queue.detach({workerId: attached4, reAssign: true});
        })
        .then(function (detached) {

          expect(detached).to.be(attached4);

          expect(queue.__assignedJobs["subscriber"][0].kue.id).to.be(popped4.id);

          var reassignedWorker = queue.__assignedJobs["subscriber"][0].workerId;

          expect(reassignedWorker != attached4).to.be(true);

          expect(queue.metrics().busy["subscriber"]).to.be(3);

          expect(queue.metrics().assigned["subscriber"]).to.be(1);

          return queue.pop({workerId: reassignedWorker})

        })
        .then(function (popped) {

          expect(queue.metrics().assigned["subscriber"]).to.be(0);

          expect(queue.metrics().busy["subscriber"]).to.be(4);

          expect(popped.data.test).to.not.be(null);

          queue.stop(done);
        });
    });

    it('tests job data management functions', function (done) {

      this.timeout(10000);

      var testJobType = uuid.v4();

      var queueConfig = {
        kue: {prefix: 'test-3'},
        jobTypes: {}
      };

      queueConfig.jobTypes[testJobType] = {concurrency: 10};

      var queue = new Queue(queueConfig);

      var attached1 = null;

      var attached2 = null;

      var attached3 = null;

      var attached4 = null;

      var created1 = null;

      var created2 = null;

      var created3 = null;

      var created4 = null;

      var createdBatchId = null;

      queue.initialize()
        .then(function () {
          return queue.attach({test: 21, jobType: testJobType})
        })
        .then(function (workerId) {
          attached1 = workerId;
          return queue.attach({test: 22, jobType: testJobType});
        })
        .then(function (workerId) {
          attached2 = workerId;
          return queue.attach({test: 23, jobType: testJobType});
        })
        .then(function (workerId) {
          attached3 = workerId;
          return queue.attach({test: 24, jobType: testJobType});
        })
        .then(function (workerId) {
          attached4 = workerId;
          return queue.createBatch({data: {test: 'batch'}, jobType: testJobType, count: 4});
        })
        .then(function (batchId) {
          createdBatchId = batchId;
          return queue.createJob({data: {test: 25}, jobType: testJobType, batchId: createdBatchId});
        })
        .then(function (createdJob) {
          created1 = createdJob;
          return queue.createJob({data: {test: 26}, jobType: testJobType, batchId: createdBatchId});
        })
        .then(function (createdJob) {
          created2 = createdJob;
          return queue.createJob({data: {test: 27}, jobType: testJobType, batchId: createdBatchId});
        })
        .then(function (createdJob) {
          created3 = createdJob;
          return queue.createJob({data: {test: 28}, jobType: testJobType, batchId: createdBatchId});
        })
        .then(function (createdJob) {

          var _this = this;

          created4 = createdJob;

          return new Promise(function (resolve) {

            setTimeout(resolve.bind(_this), 2000);
          });
        })
        .then(function () {

          expect(queue.metrics().assigned[testJobType]).to.be(4);

          return queue.jobCountByState({jobType: testJobType, state:queue.JOB_STATE.ACTIVE});
        })
        .then(function (jobCount) {

          expect(jobCount).to.be(4);

          return queue.searchJobs({jobType: testJobType, state:queue.JOB_STATE.ACTIVE, count:2});
        })
        .then(function (jobs) {

          expect(jobs.length).to.be(2);

          return queue.searchJobs({jobType: testJobType, state:queue.JOB_STATE.ACTIVE});
        })
        .then(function (jobs) {

          expect(jobs.length).to.be(4);

          return queue.updateJobs({jobType: testJobType, state:queue.JOB_STATE.ACTIVE}, {progress:80});
        })
        .then(function (ids) {

          expect(ids.length).to.be(4);

          return queue.searchJobs({jobType: testJobType, state:queue.JOB_STATE.ACTIVE});
        })
        .then(function (jobs) {

          jobs.forEach(function(job){

            expect(job.data.progress).to.be(80);
          });

          return queue.removeJobs({jobType: testJobType, state:queue.JOB_STATE.ACTIVE});
        })
        .then(function (removed) {

          expect(removed.length).to.be(4);

          return queue.searchJobs({jobType: testJobType});
        })
        .then(function (jobs) {

          expect(jobs.length).to.be(0);

          return queue.stop(done);
        });
    });
  });

  context('service', function () {

    it('starts up and stops an elastic a subscriber mesh', function (done) {

      var service = new Service();
      var sourceConfig = {};

      service
        .subscriber(sourceConfig)
        .then(function () {
          return service.stop();
        })
        .then(done)
        .catch(done);
    });

    it('starts up and stops an elastic a emitter mesh', function (done) {

      var service = new Service();
      var emitterConfig = {};

      service
        .emitter(emitterConfig)
        .then(function () {
          return service.stop();
        })
        .then(done)
        .catch(done);
    });

    it('starts up and stops an elastic a portal mesh', function (done) {

      var service = new Service();
      var portalConfig = {};

      service
        .portal(portalConfig)
        .then(function () {
          return service.stop();
        })
        .then(done)
        .catch(done);
    });


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
          return service.stop();
        })
        .then(done)
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
      var workerConfig = {queue:queueConfig};
      var emitterConfig = {};
      var portalConfig = {};

      service
        .portal(portalConfig)
        .then(function () {
          return service.queue(queueConfig);
        })
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
          return service.stop();
        })
        .then(done)
        .catch(done);
    });

    it('attaches 2 workers via the mesh, gets emitted jobs', function (done) {

      var queueService = new Service();

      var worker1Service = new Service();

      var worker2Service = new Service();

      var subscriberJob;

      var emitterJob;

      var queueConfig = {
        jobTypes: {
          "subscriber": {concurrency: 10},
          "emitter": {concurrency: 10}
        }
      };

      var worker1Config = {
        name: 'happner-feed-worker1',
        queue: {username: '_ADMIN', password: 'happn', port: 55000, jobTypes: ["subscriber"]},
        data: {
          port: 55001
        }
      };

      var worker2Config = {
        name: 'happner-feed-worker2',
        queue: {jobTypes: ["emitter"]},
        data: {
          port: 55002
        }
      };

      queueService
        .queue(queueConfig)
        .then(function () {
          return worker1Service.worker(worker1Config);
        })
        .then(function () {
          return worker2Service.worker(worker2Config);
        })
        .then(function () {

          return new Promise(function (resolve, reject) {

            queueService.__mesh.exchange.queue.metrics(function (e, metrics) {

              if (e) return reject(e);

              expect(metrics.attached["subscriber"]).to.be(1);

              expect(metrics.attached["emitter"]).to.be(1);

              worker1Service.__mesh.event.worker.on('subscriber', function (job) {

                expect(metrics.busy["subscriber"]).to.be(1);
                expect(job.data).to.be('some data');

                subscriberJob = job;

                return resolve();
              });

              queueService.__mesh.exchange.queue.createJob({jobType: 'subscriber', data: 'some data', batchId: 0});

            });
          });
        })
        .then(function () {

          return new Promise(function (resolve, reject) {

            queueService.__mesh.exchange.queue.metrics(function (e, metrics) {

              if (e) return reject(e);

              worker2Service.__mesh.event.worker.on('emitter', function (job) {

                expect(metrics.busy["emitter"]).to.be(1);
                expect(job.data).to.be('some emitter data');

                emitterJob = job;

                return resolve();
              });

              queueService.__mesh.exchange.queue.createJob({jobType: 'emitter', data: 'some emitter data'});
            });
          });
        })
        .then(function () {

          return queueService.__mesh.exchange.queue.updateBusyJob({id: subscriberJob.id, state: 2});
        })
        .then(function () {

          return queueService.__mesh.exchange.queue.updateBusyJob({id: emitterJob.id, state: 2});
        })
        .then(function () {

          queueService.__mesh.exchange.queue.metrics(function (e, metrics) {

            expect(metrics.busy["subscriber"]).to.be(0);

            expect(metrics.busy["emitter"]).to.be(0);

            expect(metrics.attached["subscriber"]).to.be(1);

            expect(metrics.attached["emitter"]).to.be(1);

            worker1Service.stop()

              .then(function () {

                return worker2Service.stop();
              })
              .then(function () {

                return new Promise(function(resolve, reject){

                  queueService.__mesh.exchange.queue.metrics(function (e, metrics) {

                    try{
                      expect(metrics.attached["subscriber"]).to.be(0);
                      expect(metrics.attached["emitter"]).to.be(0);
                      resolve();
                    }catch(e){
                      reject(e);
                    }
                  });
                })
              })
              .then(function () {

                return queueService.stop();
              })
              .then(done)
              .catch(done);
          });
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

    it('creates a new feed', function (done) {
      return done(new Error('not implemented'));
    });

    it('updates a feed', function (done) {
      return done(new Error('not implemented'));
    });

    it('list all feeds', function (done) {
      return done(new Error('not implemented'));
    });

    it('list and filters feeds', function (done) {
      return done(new Error('not implemented'));
    });

  });

  context('portal', function () {

  });

  context('service', function () {

  });

});