describe('happner-elastic-feed-sanity-tests', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var Service = require('..');

  var request = require('request');

  var fs = require('fs');

  var uuid = require('uuid');

  context('service', function () {

    it('starts up and stops an elastic emitter mesh', function (done) {

      this.timeout(10000);

      var service = new Service();

      var emitterConfig = {};

      var queueConfig = {
        queue: {
          stopTimeout:2000,
          jobTypes: {
            "subscriber": {concurrency: 10},
            "emitter": {concurrency: 10}
          }
        }
      };

      var workerConfig = {queue: queueConfig.queue};

      service
        .queue(queueConfig)
        .then(function () {
          return service.worker(workerConfig);
        })
        .then(function () {
          return service.emitter(emitterConfig);
        })
        .then(function () {
          return service.stop();
        })
        .then(function () {
          done();
        })
        .catch(done);
    });

    xit('starts up and stops an elastic a portal mesh', function (done) {

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


    it('starts up and stops an elastic a subscriber mesh', function (done) {

      this.timeout(5000);

      var service = new Service();

      var subscriberConfig = {};

      var queueConfig = {
        queue: {
          jobTypes: {
            "subscriber": {concurrency: 10},
            "emitter": {concurrency: 10}
          }
        }
      };

      var workerConfig = {queue: queueConfig.queue};

      service
        .queue(queueConfig)
        .then(function () {
          return service.worker(workerConfig);
        })
        .then(function () {
          return service.subscriber(subscriberConfig);
        })
        .then(function () {
          return service.stop();
        })
        .then(function () {
          setTimeout(done, 3000);
        })
        .catch(done);
    });

    xit('starts up and stops a combined mesh', function (done) {

      var service = new Service();

      var queueConfig = {
        queue: {
          jobTypes: {
            "subscriber": {concurrency: 10},
            "emitter": {concurrency: 10}
          }
        }
      };

      var subscriberConfig = {};
      var workerConfig = {queue: queueConfig.queue};
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
        queue: {
          jobTypes: {
            "subscriber": {concurrency: 10},
            "emitter": {concurrency: 10}
          }
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

              try {

                worker1Service.__mesh.event.worker.on('subscriber', function (job) {

                  queueService.__mesh.exchange.queue.metrics(function (e, metrics1) {

                    expect(metrics1.busy["subscriber"]).to.be(1);

                    expect(job.data).to.be('some data');

                    subscriberJob = job;

                    return resolve();
                  });

                }, function (e) {

                  if (e) return reject(e);

                  queueService.__mesh.exchange.queue.createJob({jobType: 'subscriber', data: 'some data', batchId: 0});
                });

              } catch (e) {
                return reject(e);
              }
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

                return new Promise(function (resolve, reject) {

                  queueService.__mesh.exchange.queue.metrics(function (e, metrics) {

                    try {
                      expect(metrics.attached["subscriber"]).to.be(0);
                      expect(metrics.attached["emitter"]).to.be(0);
                      resolve();
                    } catch (e) {
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

    it('tests starting the feed component in an independant mesh', function (done) {

      var config = {};

      if (!config.data) config.data = {};

      if (!config.data.port) config.data.port = 55000;

      if (!config.name)  config.name = 'happner-elastic-feed';

      var feedFactory = new Service();

      var hapnnerConfig = {
        name: config.name,
        happn: {
          port: config.data.port,
          secure: true
        },
        modules: {
          "feed": {
            instance: feedFactory.instantiateServiceInstance(feedFactory.Feed)
          }
        },
        components: {
          "feed": {
            startMethod: "initialize",
            stopMethod: "stop",
            accessLevel: "mesh"
          }
        }
      };

      var Mesh = require('happner-2');

      Mesh.create(hapnnerConfig, function (err, instance) {

        if (err) return done(err);

        var feedRandomName = uuid.v4();

        var feedData = {
          action: 'create',
          name: 'Test feed ' + feedRandomName,
          datapaths: [
            '/test/path/1/*',
            '/device/2/*',
            '/device/3/*'
          ]
        };

        instance.exchange.feed.upsert(feedData)
          .then(function (upserted) {
            //TODO://verify the upserted feed

            instance.stop({}, done);
          })
          .catch(done);
      });
    });
  });

  context('subscriber and emitter services', function () {

    it('tests the subscriber service', function (done) {

      this.timeout(15000);

      var queueService = new Service();

      var subscriberService = new Service();

      var emitterService = new Service();

      var feedRandomName = uuid.v4();

      var queueConfig = {
        queue: {
          jobTypes: {
            "emitter": {concurrency: 10}
          }
        }
      };

      var subscriberConfig = {};

      var subscriberWorkerConfig = {
        name: 'happner-emitter-worker',
        queue: {username: '_ADMIN', password: 'happn', port: 55000, jobTypes: ["emitter"]},
        data: {
          port: 55001
        }
      };

      var emitterWorkerConfig = {
        name: 'happner-emitter-worker',
        queue: {username: '_ADMIN', password: 'happn', port: 55000, jobTypes: ["emitter"]},
        data: {
          port: 55002
        }
      };


      var feedData = {
        action: 'create',
        name: 'subscriber test ' + feedRandomName,
        datapaths: [
          '/device/1/*',
          '/device/2/*',
          '/device/3/*'
        ],
        state: 2
      };

      var anotherFeedData = {
        action: 'create',
        name: 'subscriber test 2 ' + feedRandomName,
        datapaths: [
          '/device/11/*',
          '/device/12/*',
          '/device/13/*'
        ],
        state: 2
      };

      var pushedCount = 0;

      var failedAlready = false;

      queueService
        .queue(queueConfig)
        .then(function () {
          return subscriberService.worker(subscriberWorkerConfig);
        })
        .then(function () {
          return emitterService.worker(emitterWorkerConfig);
        })
        .then(function () {
          return subscriberService.subscriber(subscriberConfig);
        })
        .then(function () {

          return emitterService.__mesh.event.worker.on('emitter', function (job) {

            emitterService.__mesh.exchange.worker.getBatch(job.batchId)

              .then(function (batch) {

                expect(batch.data.meta.path).to.eql('/device/' + batch.data.data.test + '/' + batch.data.data.test);

                pushedCount++;

                if (pushedCount == 5) {

                  emitterService.stop()
                    .then(function () {
                      return subscriberService.stop();
                    })
                    .then(function () {
                      return queueService.stop();
                    })
                    .then(done)
                    .catch(done)
                }
              })

              .catch(function (e) {

                if (!failedAlready) {
                  failedAlready = true;
                  return done(e);
                }
              });
          });
        })
        .then(function () {
          return subscriberService.__mesh.exchange.feed.upsert(feedData);
        })
        .then(function () {
          return subscriberService.__mesh.exchange.feed.upsert(anotherFeedData);
        })
        .then(function () {

          return new Promise(function (resolve) {
            setTimeout(resolve, 2000);
          });
        })
        .then(function () {

          return subscriberService.__mesh.exchange.subscriber.metrics();
        })
        .then(function (metrics) {

          return new Promise(function (resolve) {

            expect(metrics.feeds.count).to.be(2);
            expect(metrics.paths.count).to.be(6);

            resolve();
          });
        })
        .then(function () {

          var subscriberMesh = subscriberService.__mesh._mesh;

          subscriberMesh.data.set('/device/1/1', {test: '1'});
          subscriberMesh.data.set('/device/2/2', {test: '2'});
          subscriberMesh.data.set('/device/3/3', {test: '3'});

          subscriberMesh.data.set('/device/11/11', {test: '11'});
          subscriberMesh.data.set('/device/12/12', {test: '12'});
          subscriberMesh.data.set('/device/13/13', {test: '13'});

          //go back up to the second step worker listens on emitter
        })
        .catch(done);
    });

    it('tests the emitter push of the data to the feed', function (done) {

      this.timeout(20000);

      var service = new Service();

      var feed = service.instantiateServiceInstance(require('../lib/components/emitter'));

      var setData = [];

      var mockFeedId = uuid.v4() + uuid.v4();

      var mockJob = {
        jobType: 'emitter',
        batchId: 1,
        data: {
          id: mockFeedId
        }
      };

      var mockBatch = {
        id: 1,
        data: {
          meta: {
            path: '/test/path'
          },
          data: {
            test: 'data'
          }
        }
      };

      var mockHappn = {
        emit: function (data) {

        },
        exchange: {

          worker: {

            getBatch: function (batchId, $happn) {

              return new Promise(function (resolve) {

                return resolve(mockBatch);
              });
            },

            jobComplete: function (job, message) {

              return new Promise(function (resolve) {

                return resolve(job);
              });
            }
          }
        },
        _mesh: {
          data: {
            set: function (path, data, options, callback) {

              setData.push({path: path, data: data, options: options});
              callback(null, {path: path, data: data, options: options});
            }
          }
        }
      };

      feed.on('handle-job-ok', function (results) {

        expect(results.path).to.be('/happner-feed-data/' + mockFeedId + '/emitter/test/path');

        expect(setData[0].data).to.eql({test: 'data'});

        done();
      });

      feed.on('handle-job-failed', function (failure) {

        done(new Error(failure.message));
      });

      feed.__handleEmitJob(mockJob, mockHappn);
    });

    it('tests the emitter service', function (done) {

      this.timeout(15000);

      var queueService = new Service();

      var subscriberService = new Service();

      var emitterService = new Service();

      var feedRandomName = uuid.v4();

      var queueConfig = {
        queue: {
          jobTypes: {
            "emitter": {concurrency: 10}
          }
        }
      };

      var subscriberConfig = {};

      var subscriberWorkerConfig = {
        name: 'happner-emitter-worker',
        queue: {username: '_ADMIN', password: 'happn', port: 55000, jobTypes: ["feed"]},
        data: {
          port: 55001
        }
      };

      var emitterWorkerConfig = {
        name: 'happner-emitter-worker',
        queue: {username: '_ADMIN', password: 'happn', port: 55000, jobTypes: ["emitter"]},
        data: {
          port: 55002
        }
      };


      var feedData = {
        action: 'create',
        name: 'subscriber test ' + feedRandomName,
        datapaths: [
          '/device/1/*',
          '/device/2/*',
          '/device/3/*'
        ],
        state: 2
      };

      var anotherFeedData = {
        action: 'create',
        name: 'subscriber test 2 ' + feedRandomName,
        datapaths: [
          '/device/11/*',
          '/device/12/*',
          '/device/13/*'
        ],
        state: 2
      };

      var feedId;

      var anotherFeedId;

      var completedJobCount = 0;

      var failedAlready = false;

      queueService
        .queue(queueConfig)
        .then(function () {
          return subscriberService.worker(subscriberWorkerConfig);
        })
        .then(function () {
          return emitterService.worker(emitterWorkerConfig);
        })
        .then(function () {
          return emitterService.emitter(emitterWorkerConfig);
        })
        .then(function () {
          return subscriberService.subscriber(subscriberConfig);
        })
        .then(function () {
          return new Promise(function (resolve) {

            emitterService.__mesh.event.emitter.on('handle-job-failed', function (error) {

              if (!failedAlready) {

                failedAlready = true;

                done(new Error(error.message));
              }
            });

            emitterService.__mesh.event.emitter.on('handle-job-ok', function (results) {

              completedJobCount++;

              if (completedJobCount == 6) {

                emitterService.__mesh._mesh.data.get('/happner-feed-data/' + feedId + '/emitter/*', function (e, results) {

                  if (e) return done(e);

                  expect(results.length).to.be(3);

                  expect(['1', '2', '3'].indexOf(results[0].test) > -1).to.be(true);

                  expect(['1', '2', '3'].indexOf(results[1].test) > -1).to.be(true);

                  expect(['1', '2', '3'].indexOf(results[2].test) > -1).to.be(true);

                  emitterService.__mesh._mesh.data.get('/happner-feed-data/' + anotherFeedId + '/emitter/*', function (e, results) {

                    if (e) return done(e);

                    expect(results.length).to.be(3);

                    expect(['11', '12', '13'].indexOf(results[0].test) > -1).to.be(true);

                    expect(['11', '12', '13'].indexOf(results[1].test) > -1).to.be(true);

                    expect(['11', '12', '13'].indexOf(results[2].test) > -1).to.be(true);

                    emitterService.stop()
                      .then(function () {
                        return subscriberService.stop();
                      })
                      .then(function () {
                        return queueService.stop();
                      })
                      .then(done)
                      .catch(done)
                  });
                });
              }

            }, function (e) {

              if (e) return done(e);

              resolve();
            });
          });
        })
        .then(function () {
          return subscriberService.__mesh.exchange.feed.upsert(feedData);
        })
        .then(function (feed) {
          feedId = feed.id;
          return subscriberService.__mesh.exchange.feed.upsert(anotherFeedData);
        })
        .then(function (anotherFeed) {
          anotherFeedId = anotherFeed.id;
          return new Promise(function (resolve) {
            setTimeout(resolve, 2000);
          });
        })
        .then(function () {
          return subscriberService.__mesh.exchange.subscriber.metrics();
        })
        .then(function (metrics) {

          return new Promise(function (resolve) {

            expect(metrics.feeds.count == 2).to.be(true);
            expect(metrics.paths.count == 6).to.be(true);

            resolve();
          });
        })
        .then(function () {

          var subscriberMesh = subscriberService.__mesh._mesh;

          subscriberMesh.data.set('/device/1/1', {test: '1'});
          subscriberMesh.data.set('/device/2/2', {test: '2'});
          subscriberMesh.data.set('/device/3/3', {test: '3'});

          subscriberMesh.data.set('/device/11/11', {test: '11'});
          subscriberMesh.data.set('/device/12/12', {test: '12'});
          subscriberMesh.data.set('/device/13/13', {test: '13'});

          //go back up to the second step worker listens on emitter
        })
        .catch(done);
    });
  });

  context('portal & proxy', function () {

  });

});