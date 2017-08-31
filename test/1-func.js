describe('happner-elastic-feed-functional-tests', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var Service = require('..');

  var request = require('request');

  var Queue = require('../lib/components/queue');

  var fs = require('fs');

  var uuid = require('uuid');

  context('queue', function () {

    it('tests the queue functions', function (done) {

      this.timeout(10000);

      var service = new Service();

      var queue = service.instantiateServiceInstance(Queue, {
        queue: {
          kue: {prefix: 'test-1'},
          jobTypes: {
            "subscriber": {concurrency: 10},
            "emitter": {concurrency: 10}
          }
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

          expect(queue.__metrics.attached["emitter"]).to.be(1);

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

          expect(queue.__metrics.assigned["subscriber"]).to.be(3);

          return queue.pop({workerId: attached2})
        })
        .then(function (poppedJob) {

          popped1 = poppedJob;

          expect(popped1.data.test).to.be(15);

          expect(queue.__metrics.assigned["subscriber"]).to.be(2);

          return queue.pop({workerId: attached3})
        })
        .then(function (poppedJob) {

          popped2 = poppedJob;
          expect(popped2.data.test).to.be(16);

          expect(queue.__metrics.assigned["subscriber"]).to.be(1);

          return queue.pop({workerId: attached4})
        })
        .then(function (poppedJob) {

          popped3 = poppedJob;

          expect(popped3.data.test).to.be(17);

          expect(queue.__metrics.busy["subscriber"]).to.be(3);

          return queue.getBatch(popped3.batchId);
        })
        .then(function (batch) {

          expect(batch.data.test).to.be('batch');

          return queue.updateBusyJob({jobType: "subscriber", id: popped1.id, state: queue.JOB_STATE.COMPLETED});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.COMPLETED);

          expect(queue.__metrics.busy["subscriber"]).to.be(2);

          return queue.updateBusyJob({jobType: "subscriber", id: popped2.id, log: 'log this', progress: 70});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.BUSY);
          expect(updated.progress).to.be(70);
          expect(queue.__metrics.busy["subscriber"]).to.be(2);

          return queue.updateBusyJob({jobType: "subscriber", id: popped3.id, state: queue.JOB_STATE.COMPLETED});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.COMPLETED);
          expect(updated.progress).to.be(100);
          expect(queue.__metrics.busy["subscriber"]).to.be(1);

          return queue.updateBusyJob({jobType: "subscriber", id: popped2.id, state: queue.JOB_STATE.COMPLETED});
        })
        .then(function (updated) {

          expect(updated.state).to.be(queue.JOB_STATE.COMPLETED);
          expect(updated.progress).to.be(100);
          expect(queue.__metrics.busy["subscriber"]).to.be(0);

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

      this.timeout(15000);

      var service = new Service();

      var queue = service.instantiateServiceInstance(Queue, {
        queue: {
          kue: {prefix: 'test-1'},
          jobTypes: {
            "subscriber": {concurrency: 10},
            "emitter": {concurrency: 10}
          }
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

          expect(queue.__metrics.assigned["subscriber"]).to.be(4);

          return queue.pop({workerId: attached1})
        })
        .then(function (poppedJob) {

          popped1 = poppedJob;

          expect(popped1.data.test).to.be(25);

          expect(queue.__metrics.assigned["subscriber"]).to.be(3);

          return queue.pop({workerId: attached2})
        })
        .then(function (poppedJob) {

          popped2 = poppedJob;

          expect(popped2.data.test).to.be(26);

          expect(queue.__metrics.assigned["subscriber"]).to.be(2);

          return queue.pop({workerId: attached3})
        })
        .then(function (poppedJob) {

          popped3 = poppedJob;

          expect(popped3.data.test).to.be(27);

          expect(queue.__metrics.busy["subscriber"]).to.be(3);

          return queue.pop({workerId: attached4})
        })
        .then(function (poppedJob) {

          popped4 = poppedJob;

          expect(popped4.data.test).to.be(28);

          expect(queue.__metrics.busy["subscriber"]).to.be(4);

          return queue.detach({workerId: attached4, reAssign: true});
        })
        .then(function (detached) {

          expect(detached).to.be(attached4);

          expect(queue.__assignedJobs["subscriber"][0].kue.id).to.be(popped4.id);

          var reassignedWorker = queue.__assignedJobs["subscriber"][0].workerId;

          expect(reassignedWorker != attached4).to.be(true);

          expect(queue.__metrics.busy["subscriber"]).to.be(3);

          expect(queue.__metrics.assigned["subscriber"]).to.be(1);

          return queue.pop({workerId: reassignedWorker})

        })
        .then(function (popped) {

          expect(queue.__metrics.assigned["subscriber"]).to.be(0);

          expect(queue.__metrics.busy["subscriber"]).to.be(4);

          expect(popped.data.test).to.not.be(null);

          queue.stop(done);
        });
    });

    it('tests job data management functions', function (done) {

      this.timeout(10000);

      var testJobType = uuid.v4();

      var queueConfig = {
        queue: {
          kue: {prefix: 'test-3'},
          jobTypes: {}
        }
      };

      queueConfig.queue.jobTypes[testJobType] = {concurrency: 10};

      var service = new Service();

      var queue = service.instantiateServiceInstance(Queue, queueConfig);

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

          expect(queue.__metrics.assigned[testJobType]).to.be(4);

          return queue.jobCountByState({jobType: testJobType, state: queue.JOB_STATE.ACTIVE});
        })
        .then(function (jobCount) {

          expect(jobCount).to.be(4);

          return queue.searchJobs({jobType: testJobType, state: queue.JOB_STATE.ACTIVE, count: 2});
        })
        .then(function (jobs) {

          expect(jobs.length).to.be(2);

          return queue.searchJobs({jobType: testJobType, state: queue.JOB_STATE.ACTIVE});
        })
        .then(function (jobs) {

          expect(jobs.length).to.be(4);

          return queue.updateJobs({jobType: testJobType, state: queue.JOB_STATE.ACTIVE}, {progress: 80});
        })
        .then(function (ids) {

          expect(ids.length).to.be(4);

          return queue.searchJobs({jobType: testJobType, state: queue.JOB_STATE.ACTIVE});
        })
        .then(function (jobs) {

          jobs.forEach(function (job) {

            expect(job.data.progress).to.be(80);
          });

          return queue.removeJobs({jobType: testJobType, state: queue.JOB_STATE.ACTIVE});
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

  context('feeds and dashboards', function () {

    it('creates, updates and lists a feed', function (done) {

      this.timeout(15000);

      var queueService = new Service();

      var feedService = new Service();

      var feedRandomName = uuid.v4();

      var queueConfig = {
        queue: {
          jobTypes: {
            "feed": {concurrency: 10}
          }
        }
      };

      var feedWorkerConfig = {
        name: 'happner-feed-worker1',
        queue: {username: '_ADMIN', password: 'happn', port: 55000, jobTypes: ["feed"]},
        data: {
          port: 55001
        }
      };

      var feedData = {
        action: 'create',
        name: 'Test feed ' + feedRandomName,
        datapaths: [
          '/test/path/1/*',
          '/device/2/*',
          '/device/3/*'
        ]
      };

      var anotherFeedData = {
        action: 'create',
        name: 'Test feed 2 ' + feedRandomName,
        datapaths: [
          '/test/path/21/*',
          '/device/22/*',
          '/device/23/*'
        ]
      };

      var error = null;

      queueService
        .queue(queueConfig)
        .then(function () {
          return feedService.worker(feedWorkerConfig);
        })
        .then(function () {

          return new Promise(function (resolve, reject) {

            feedService.__mesh.event.worker.on('feed', function (job) {

              feedService.__mesh.exchange.feed.upsert(job.data)
                .then(resolve)
                .catch(reject);
            });

            queueService.__mesh.exchange.queue.createJob({jobType: 'feed', data: feedData, batchId: 0});
          });
        })
        .then(function (created) {

          return new Promise(function (resolve, reject) {

            expect(created.version).to.be(1);

            created.datapaths.push('/device/4/*');

            feedService.__mesh.event.feed.on('feed-updated', function (feed) {

              if (feed.version != 2) return reject(new Error('feed version was not updated'));

              return resolve(feed);
            });

            feedService.__mesh.exchange.feed.upsert(created);
          });
        })
        .then(function () {
          return feedService.__mesh.exchange.feed.upsert(anotherFeedData);
        })
        .then(function (created) {
          expect(created.version).to.be(1);

          return feedService.__mesh.exchange.feed.list();
        })
        .then(function (feeds) {
          return new Promise(function (resolve, reject) {

            if (feeds.length != 2) return reject(new Error('feeds length expected to be 2'));

            feeds.every(function (feed) {

              try {

                expect(['Test feed ' + feedRandomName, 'Test feed 2 ' + feedRandomName].indexOf(feed.name) > -1).to.be(true);

                if (feed.name == 'Test feed ' + feedRandomName) {

                  expect(feed.datapaths.length).to.be(4);

                  expect(feed.version).to.be(2);

                } else {

                  expect(feed.name).to.be('Test feed 2 ' + feedRandomName);

                  expect(feed.version).to.be(1);
                }

                return true;

              } catch (e) {
                error = e;
                return false;
              }
            });

            if (error) return reject(error);

            resolve();
          });
        })
        .then(function () {
          return queueService.stop();
        })
        .then(function () {
          return feedService.stop();
        })
        .then(done)
        .catch(done);
    });
  });

  context('portal & proxy', function () {

    it('starts the proxy service, we test pushing requests through it to elasticsearch, using default listen port 55555 target http://localhost:9200', function(done){

      var proxyService = new Service();

      var proxyConfig = {};

      var http = require('http');

      proxyService

        .proxy(proxyConfig)

        .then(function () {

          http.get({
            host: 'localhost',
            port: 55555,
            path: '/_cat/indices?v'
          }, function(res) {

            var body = '';

            res.on('data', function(chunk) {
              body += chunk;
            });

            res.on('end', function() {

              console.log('successfully queried :::', body);

              proxyService.stop()
                .then(function(){
                  done();
                })
                .catch(done)
            });

          }).on('error', function(e) {
            done(e);
          });
        })
        .catch(function(e){
          done(e);
        })

    });
  });
});