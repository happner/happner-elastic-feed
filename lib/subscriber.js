var Promise = require('bluebird');
var EventEmitter = require('events').EventEmitter;
var PareTree = require('wild-pare');
var async = require('async');

/* initialization, stop and metrics */

function Subscriber() {

  this.__metrics = {};
  this.__events = new EventEmitter();
  this.__activeFeeds = new PareTree();
  this.__pareTree = new PareTree();
}

Subscriber.prototype.initialize = function (options, $happn) {

  var _this = this;

  return this
    .__connectQueue(options, $happn)
    .__connectFeeds(options, $happn)
    .then(function () {
      return _this.__subscribe(options, $happn);
    });
};

Subscriber.prototype.stop = function ($happn, callback) {

  if (this.__allSubscription) $happn._mesh.data.off(this.__allSubscription, callback);
};

Subscriber.prototype.__updateMetric = function (key, subkey, value, $happn) {

  if (!this.__metrics[key]) this.__metrics[key] = {};

  if (!this.__metrics[key][subkey]) this.__metrics[key][subkey] = 0;

  this.__metrics[key][subkey] += value;

  this.emit('metric-changed', {key: key, subkey: subkey, value: value}, $happn);
};

Subscriber.prototype.metrics = function () {

  var _this = this;

  return new Promise(function (resolve) {

    resolve(_this.__metrics);
  });
};

/* initialization, stop and metrics end */

/* events */

Subscriber.prototype.emit = function (key, data, $happn) {

  var _this = this;

  if ($happn) $happn.emit(key, data, function (e) {
    if (e) _this.__events.emit('emit-failure', [key, data]);
  });

  _this.__events.emit(key, data);
};

Subscriber.prototype.on = function (key, handler) {

  return this.__events.on(key, handler);
};

Subscriber.prototype.off = function (key, handler) {

  return this.__events.removeListener(key, handler);
};

/* events end*/

/* feed integration */

Subscriber.prototype.__updateFeed = function (feed) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    try {

      //remove all existing feed data subscriptions
      _this.__pareTree.remove({path: '*', filter: {"key": feed.id}});

      //state is not RUNNING, so if we have removed, we can now quit
      if (feed.state != 2) return resolve();

      feed.datapaths.forEach(function (datapath) {

        _this.__pareTree.add({path: datapath, key: feed.id});
      });

      _this.__activeFeeds[feed.id] = feed;

    } catch (e) {
      _this.__emit('feed-update-failed', e.toString());
      reject(e);
    }
  });
};

Subscriber.prototype.__createJobs = function (eventBatch, subscriptions) {

  var batches = {};

  subscriptions.forEach(function (subscription) {

    if (!batches[subscription.data.feedId]) batches[subscription.data.feedId] = {
      batch: {
        data: eventBatch,
        size: 0,
        jobType: 'emitter'
      },
      jobs: []
    };

    batches[subscription.data.feedId].batch.size++;
    batches[subscription.data.feedId].jobs.push({data: subscription, jobType: 'emitter'});
  });

  return batches;
};

Subscriber.prototype.__subscribe = function (options, $happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {
    //subscribe to all events, then grab the path and check it against our
    //feed subscriptions
    _this.__allSubscription = $happn._mesh.data.on('*', function (data, meta) {

      var subscriptions = _this.__pareTree.search(meta.path);

      if (subscriptions.length == 0) return;

      var eventBatch = {data: data, meta: meta};

      var batches = _this.__createJobs(eventBatch, subscriptions);

      var currentBatch, currentJob;

      async.eachSeries(Object.keys(batches), function (feedId, feedCB) {

        currentBatch = batches[feedId];

        $happn.exchange.queue.createBatch(currentBatch.batch)

          .then(function (batch) {

            return new Promise(function(resolveJob, rejectJob){

              async.eachSeries(currentBatch.jobs, function (job, jobCB) {

                job.batchId = batch.id;

                currentJob = job;

                $happn.exchange.queue.createJob(job)
                  .then(function(){
                    jobCB();
                  })
                  .catch(jobCB);

              }, function (e) {

                if (e) {
                  _this.emit('job-failed', currentJob);
                  return rejectJob (e);
                }

                _this.emit('job-queued', currentJob);
                return resolveJob (currentJob);
              });
            });
          })
          .then(feedCB)
          .catch(feedCB);

      }, function (e) {

        if (e) return _this.emit('batch-failed', currentBatch.batch);
        _this.emit('batch-queued', currentBatch.batch);
      });

    }, function (e) {

      if (e) return reject(e);

      resolve();
    });
  });
};

Subscriber.prototype.__connectFeeds = function (options, $happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (!$happn.exchange.feed) return reject(new Error('missing feed component'));

    //get all running feeds
    $happn.exchange.feed.list({criteria: {state: 2}}).then(function (existingFeeds) {

      async.eachSeries(existingFeeds, function (existingFeed, existingFeedCB) {

        _this.__updateFeed(existingFeed).then(function () {

          existingFeedCB();

        }).catch(existingFeedCB);

      }, function (e) {

        if (e) return reject(e);

        $happn.exchange.feed.on('feed-created', _this.__updateFeed.bind(_this));

        $happn.exchange.feed.on('feed-updated', _this.__updateFeed.bind(_this));
      })
    });
  });
};

Subscriber.prototype.__connectQueue = function (options, $happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (!$happn.exchange.queue) return reject(new Error('missing queue component'));

    //if (!$happn.event.worker) return reject(new Error('missing worker component'));

    resolve();
  });
};


/* feed integration end */

module.exports = Subscriber;