var Promise = require('bluebird');
var EventEmitter = require('events').EventEmitter;
var PareTree = require('wild-pare');
var async = require('async');

function Subscriber() {

  this.__metrics = {};
  this.__events = new EventEmitter();
  this.__activeFeeds = new PareTree();
  this.__pareTree = new PareTree();
}

/* initialization, stop and connection to worker */
{

  Subscriber.prototype.initialize = function ($happn) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      _this
        .__connectQueue($happn)
        .then(function () {
          return _this.__connectFeeds($happn);
        })
        .then(function () {
          return _this.__subscribe($happn);
        })
        .then(resolve)
        .catch(reject);
    });
  };

  Subscriber.prototype.__connectQueue = function ($happn) {

    return new Promise(function (resolve, reject) {

      if (!$happn.exchange.worker) return reject(new Error('missing worker component'));

      resolve();
    });
  };

  Subscriber.prototype.stop = function ($happn, callback) {

    if (this.__allSubscription) $happn._mesh.data.off(this.__allSubscription, callback);
  };
}

/* analytics, logging */
{
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
}

/* events */
{
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
}

/* feed integration */
{
  Subscriber.prototype.__connectFeeds = function ($happn) {

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

          $happn.event.feed.on('feed-created', _this.__updateFeed.bind(_this));

          $happn.event.feed.on('feed-updated', _this.__updateFeed.bind(_this));

          resolve();
        })
      });
    });
  };

  Subscriber.prototype.__updateFeed = function (feed) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      try {

        //remove all existing feed data subscriptions
        //{path: '/a/subscription/path', filter: {"data.value":{$lte:10}}}
        var removedPaths = _this.__pareTree.remove({path:'*', filter:{"key": feed.id}});

        _this.__updateMetric('paths', 'count', -removedPaths.length);

        //state is not RUNNING, so if we have removed, we can now quit
        if (feed.state != 2) return resolve();

        feed.datapaths.forEach(function (datapath) {

          _this.__pareTree.add(datapath, {key: feed.id, data: feed});

          _this.__updateMetric('paths', 'count', 1);
        });

        _this.__activeFeeds[feed.id] = feed;

        _this.__updateMetric('feeds', 'count', 1);

        resolve();

      } catch (e) {

        _this.emit('feed-update-failed', e.toString());
        reject(e);
      }
    });
  };
}

/* onAll subscription batch and job creation and persistence */
{
  Subscriber.prototype.__subscribe = function ($happn) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      //subscribe to all events, then grab the path and check it against our
      //feed subscriptions

      _this.__allSubscription = $happn._mesh.data.on('*', function (data, meta) {

        var subscriptions = _this.__pareTree.search({path: meta.path});

        if (subscriptions.length == 0) return;

        var eventBatch = {data: data, meta: meta};

        var batches = _this.__createJobs(eventBatch, subscriptions);

        _this.__persistBatches(batches, $happn);

      }, function (e) {

        if (e) return reject(e);

        resolve();
      });
    });
  };

  Subscriber.prototype.__createJobs = function (eventBatch, subscriptions) {

    var batches = {};

    subscriptions.forEach(function (subscription) {

      if (!batches[subscription.data.id]) batches[subscription.data.id] = {
        batch: {
          data: eventBatch,
          size: 0,
          jobType: 'emitter'
        },
        jobs: []
      };

      batches[subscription.data.id].batch.size++;
      batches[subscription.data.id].jobs.push({data: subscription.data, jobType: 'emitter'});
    });

    return batches;
  };

  Subscriber.prototype.__persistBatch = function (toPersist, $happn) {

    var _this = this;

    var persisted = {};

    return new Promise(function (resolve, reject) {

      $happn.exchange.worker.createBatch(toPersist.batch, function (e, created) {

        if (e) {

          _this.emit('batch-persist-failed', {batch: toPersist.batch, error: e.toString()});

          return reject(e);
        }

        persisted.batch = toPersist.batch;

        persisted.batch.id = created;

        persisted.jobs = [];

        _this.emit('batch-persist-ok', persisted.batch);

        var currentJob;

        async.eachSeries(toPersist.jobs, function (job, jobCB) {

          job.batchId = persisted.batch.id;

          currentJob = job;

          $happn.exchange.worker.createJob(job, function (e, created) {

            if (e) {
              _this.emit('job-persist-failed', currentJob);
              return jobCB(e);
            }

            _this.emit('job-persist-ok', created);

            persisted.jobs.push(created);

            return jobCB();
          });

        }, function (e) {

          if (e) return $happn.exchange.worker.updateBatch(persisted.batch.id, {
            state: 3,
            message: 'batch job persist failed: ' + e.toString()
          }).then(resolve).catch(reject);

          $happn.exchange.worker.updateBatch(persisted.batch.id, {
            state: 0,
            message: 'subscriber emit batch ready'
          }).then(function(updated){

            resolve(updated);
          }).catch(reject);
        });
      })
    });
  };


  Subscriber.prototype.__persistBatches = function (batches, $happn) {

    var _this = this;
    var currentBatch;
    var persisted = {batches: []};

    async.eachSeries(Object.keys(batches), function (feedId, feedCB) {

      currentBatch = batches[feedId];

      _this.__persistBatch(currentBatch, $happn)
        .then(function (persistedBatch) {
          persisted.batches.push(persistedBatch);
          feedCB();
        })
        .catch(feedCB);

    }, function (e) {

      if (e) {
        persisted.error = e.toString();
        return _this.emit('batches-failed', persisted);
      }
      _this.emit('batches-queued', persisted);
    });
  };
}

module.exports = Subscriber;