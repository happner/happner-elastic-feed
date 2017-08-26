
describe('happner-elastic-feed-perf-tests', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var Service = require('..');

  var async = require('async');

  var uuid = require('uuid');

  var N = 10;

  var T = 5000;

  it('does ' + N + ' or more jobs in ' + T + ' milliseconds', function(done){

    this.timeout(T + 5000);

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

    var feedId;

    var anotherFeedId;

    var setJobCount = 0;

    var completedJobCount = 0;

    var failedAlready = false;

    var completedAlready = false;

    var started, completed;

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

              console.log('failed: ' + error.message + ', processed so far: ' + completedJobCount + ', submitted so far: ' + setJobCount);

              done(new Error(error.message));
            }
          });

          emitterService.__mesh.event.emitter.on('handle-job-ok', function (results) {

            completedJobCount++;

            console.log('set:::', setJobCount);
            console.log('completed:::', completedJobCount);

            if (completedJobCount >= N) {

              if (completedAlready) return;

              completedAlready = true;

              completed = Date.now();

              var completedIn = completed - started;

              console.log('completed in ' + completedIn + ' milliseconds.');

              if (completedIn >= N + 3000) return done(new Error('not completed within the specified timeframe of ' + N + ' milliseconds'));

              return done();
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

        return new Promise(function (resolve) {
          setTimeout(resolve, 2000);
        });
      })
      .then(function () {

        var subscriberMesh = subscriberService.__mesh._mesh;

        started = Date.now();

        async.times(N, function(time, timeCB){

          var random = Math.floor(Math.random() * 100).toString();

          subscriberMesh.data.set('/device/1/' + random, {test: random}, function(e){

            if (e) return timeCB(e);

            setJobCount++;

            timeCB();

          }, function(e){
            if (e && !failedAlready) {
              failedAlready = true;
              done(e);
            }
          });
        });

        //go back up to the second step worker listens on emitter
      })
      .catch(done);

  })

});