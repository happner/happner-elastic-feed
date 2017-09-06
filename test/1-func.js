describe('happner-elastic-feed-functional-tests', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var Service = require('..');

  var request = require('request');

  var Queue = require('../lib/components/queue');

  var fs = require('fs');

  var uuid = require('uuid');

  var TestUtilities = require('./fixtures/utilities');

  var testUtils = new TestUtilities();

  var Mesh = require('happner-2');

  context('utilities', function () {

    it('tests commandline options', function (done) {

      var utilities = require("../lib/utilities").create();

      var json = {};

      utilities.__splitOptions('proxy=proxy.port=55555,proxy.target=http://localhost:9200', json);

      expect(json.proxy).to.eql({proxy: {port: '55555', target: 'http://localhost:9200'}});

      done();
    });

    it('tests cloneArray emthod', function (done) {

      var utilities = require("../lib/utilities").create();

      var toClone = ["three", {"two": 2}, 1];

      var cloned = utilities.cloneArray(toClone);

      expect(cloned[0]).to.be("three");

      expect(cloned[1]["two"]).to.be(2);

      expect(cloned[2]).to.be(1);

      cloned.push("four");

      toClone[1]["two"] = 6;

      expect(toClone.length).to.be(3);

      expect(cloned[3]).to.be("four");

      expect(toClone[1]["two"]).to.be(6);

      done();
    });
  });

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
        name: 'happner-feed-queue',
        queue: {
          jobTypes: {
            "feed": {concurrency: 10}
          }
        }
      };

      var feedWorkerConfig = {
        name: 'happner-feed-worker1',
        queue: {username: '_ADMIN', password: 'happn', port: 55000, jobTypes: ["feed"], name: 'happner-feed-queue'},
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

          return feedService.feed(feedWorkerConfig);
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
          return feedService.stop();
        })
        .then(function () {
          return queueService.stop();
        })
        .then(done)
        .catch(done);
    });
  });

  context('portal & proxy', function () {

    it('starts the proxy service, log in with the _ADMIN account, get the happn_token, then call the authDashboards web method to get available dashboards.', function (done) {

      var proxyService = new Service();

      var proxyConfig = {
        proxy: {
          dashboardListAuthorizedHandler: function (req, res, next, $happn, $origin) {

            //console.log('auth-dashboards called:', req.url);

            res.end(JSON.stringify({dashboards: []}));
          },
          proxyHandler: function (proxyReq, req, res, options) {

            //console.log('proxy-request called:', req.url);
          }
        }
      };

      var events = {};

      var finish = function (e) {

        done(e);
      };

      var proxyMesh;

      var adminClient = new Mesh.MeshClient({secure: true});

      proxyService

        .proxy(proxyConfig)

        .then(function () {

          proxyMesh = proxyService.__mesh;

          return proxyMesh.event.proxy.on('dashboard-list-authorized-happening', function (data) {
            events['dashboard-list-authorized-happening'] = data;
          })
        })
        .then(function (e) {

          if (e) return finish(e);

          return proxyMesh.event.proxy.on('dashboard-list-authorized-happened', function (data) {
            events['dashboard-list-authorized-happened'] = data;
          })
        })
        .then(function (e) {

          if (e) return finish(e);

          return proxyMesh.event.proxy.on('dashboard-list-authorized-error', function (data) {
            events['dashboard-list-authorized-error'] = data;
          })
        })
        .then(function (e) {

          if (e) return finish(e);

          return adminClient.login({
            username: '_ADMIN',
            password: 'happn'
          });
        })
        .then(function () {

          return testUtils.doRequest('http', '127.0.0.1', 55000, '/proxy/dashboardListAuthorized', adminClient.token);
        })
        .then(function (response) {

          expect(response.error).to.be(null);

          var body = JSON.parse(response.body);

          expect(body.dashboards.length).to.be(0);

          proxyService.stop()
            .then(finish)
            .catch(function (e) {
              console.warn('failed stopping proxy service: ' + e.toString());
              finish(proxyError);
            });
        })
        .catch(finish);
    });

    it('starts the proxy service, we test pushing requests through it to elasticsearch, using default listen port 55555 target http://localhost:9200', function (done) {

      this.timeout(15000);

      var proxyService = new Service();

      var proxyConfig = {
        proxy: {}
      };

      var events = {};

      var finish = function (e) {

        if (e) return done(e);

        setTimeout(done, 2000);
      };

      var proxyMesh;

      proxyService

        .proxy(proxyConfig)

        .then(function () {

          proxyMesh = proxyService.__mesh;

          return proxyMesh.event.proxy.on('handle-request-happening', function (data) {
            events['handle-request-happening'] = data;
          })
        })
        .then(function (e) {

          if (e) return finish(e);

          return proxyMesh.event.proxy.on('handle-request-happened', function (data) {
            events['handle-request-happened'] = data;
          })
        })
        .then(function (e) {

          if (e) return finish(e);

          return proxyMesh.event.proxy.on('handle-request-error', function (data) {
            events['handle-request-error'] = data;
          })
        })
        .then(function (e) {

          if (e) return finish(e);

          return testUtils.doRequest('http', 'localhost', 55555, '/_cat/indices?v');
        })
        .then(function (response) {

          //console.log('body:', proxyError, response, body);

          expect(response.error).to.be(null);

          expect(response.body).to.not.be(null);

          proxyService.stop()

            .then(finish)

            .catch(function (e) {
              console.warn('failed stopping proxy service: ' + e.toString());
              finish(new Error(response.error));
            });
        })
        .catch(finish);
    });

    it.only('starts the proxy service, we test pushing through every method and ensure we get the correct events', function (done) {

      this.timeout(15000);

      var proxyService = new Service();

      var proxyConfig = {
        proxy: {}
      };

      var events = [];

      var finish = function (e) {

        if (e) return done(e);

        setTimeout(done, 2000);
      };

      var adminClient = new Mesh.MeshClient({secure: true});

      var proxyMesh;

      proxyService

        .proxy(proxyConfig)

        .then(function () {

          proxyMesh = proxyService.__mesh;

          return proxyMesh.event.proxy.on('handle-request-happened', function (data) {
            events.push({event:'handle-request-happened', data:data})
          });
        })
        .then(function (e) {

          if (e) return finish(e);

          return proxyMesh.event.proxy.on('kibana-authorize', function (data) {
            events.push({event:'kibana-authorize', data:data})
          });
        })
        .then(function (e) {

          if (e) return finish(e);

          return proxyMesh.event.proxy.on('kibana-available-dashboards', function (data) {
            events.push({event:'kibana-available-dashboards', data:data})
          })
        })
        .then(function (e) {

          if (e) return finish(e);

          return proxyMesh.event.proxy.on('kibana-request', function (data) {
            events.push({event:'kibana-request', data:data})
          })
        })
        .then(function () {

          return testUtils.doRequest('http', 'localhost', 55555, '/_cat/indices?v');
        })
        .then(function (response) {

          expect(response.error).to.be(null);

          expect(response.body).to.not.be(null);

          return adminClient.login({
            username: '_ADMIN',
            password: 'happn'
          });
        })
        .then(function () {

          return testUtils.doRequest('http', 'localhost', 4444, '/auth?happn_token=' + adminClient.token + '&redirect=' + encodeURIComponent('/test/path'));
        })
        .then(function (response) {

          expect(response.error).to.be(null);

          expect(response.body).to.not.be(null);

          return testUtils.doRequest('http', 'localhost', 4444, '/dashboards');
        })
        .then(function (response) {

          expect(response.error).to.be(null);

          expect(response.body).to.not.be(null);

          return testUtils.doRequest('http', 'localhost', 4444, '/app/kibana/dashboard');
        })
        .then(function (response) {

          expect(response.error).to.be(null);

          expect(response.body).to.not.be(null);

          return new Promise(function(resolve){
            setTimeout(resolve, 2000);
          })
        })
        .then(function () {

          //console.log('body:', proxyError, response, body);

          console.log('events:::',events);

          // expect(events['kibana-available-dashboards']).to.be();
          // expect(events['kibana-request']).to.be();
          // expect(events['kibana-authorize']).to.be();
          // expect(events['handle-request-happened']).to.be();

          proxyService.stop()

            .then(finish)

            .catch(function (e) {
              console.warn('failed stopping proxy service: ' + e.toString());
              finish(new Error(response.error));
            });
        })
        .catch(finish);
    });
  });
});