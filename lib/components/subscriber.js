var Promise = require('bluebird');
var PareTree = require('wild-pare');
var async = require('async');

function Subscriber(options) {

  this.__options = options;
  this.__activeFeeds = new PareTree();
  this.__pareTree = new PareTree();
}

/* initialization, stop and connection to worker */

Subscriber.prototype.initialize = initialize;

Subscriber.prototype.__connectQueue = __connectQueue;

Subscriber.prototype.stop = stop;

/* feed integration */

Subscriber.prototype.__connectFeeds = __connectFeeds;

Subscriber.prototype.__updateFeed = __updateFeed;

/* onAll subscription batch and job creation and persistence */

Subscriber.prototype.__subscribe = __subscribe;

Subscriber.prototype.__createJobs = __createJobs;

Subscriber.prototype.__persistBatch = __persistBatch;

Subscriber.prototype.__persistBatches = __persistBatches;

function initialize($happn) {

  var _this = this;

  //[start:{"key":"initialize", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    _this
      .__connectQueue($happn)
      .then(function () {
        return _this.__connectFeeds($happn);
      })
      .then(function () {
        return _this.__subscribe($happn);
      })
      .then(function (result) {
        //[end:{"key":"initialize", "self":"_this"}:end]
        resolve(result);
      })
      .catch(function (e) {
        //[end:{"key":"initialize", "self":"_this", "error":"e"}:end]
        reject(e);
      });
  });
}

function __connectQueue($happn) {

  return new Promise(function (resolve, reject) {

    if (!$happn.exchange.worker) return reject(new Error('missing worker component'));

    resolve();
  });
}

function stop($happn, callback) {

  if (this.__allSubscription) $happn._mesh.data.off(this.__allSubscription, callback);
}

function __connectFeeds($happn) {

  var _this = this;

  //[start:{"key":"__connectFeeds","self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    if (!$happn.exchange.feed) {
      //[end:{"key":"__connectFeeds","self":"_this", "errorMessage":"missing feed component"}:end]
      return reject(new Error('missing feed component'));
    }

    //get all running feeds
    $happn.exchange.feed.list({criteria: {state: 2}}).then(function (existingFeeds) {

      async.eachSeries(existingFeeds, function (existingFeed, existingFeedCB) {

        _this.__updateFeed(existingFeed).then(function () {

          existingFeedCB();

        }).catch(existingFeedCB);

      }, function (e) {

        if (e) {
          //[end:{"key":"__connectFeeds","self":"_this", "error":"e"}:end]
          return reject(e);
        }

        $happn.event.feed.on('feed-created', _this.__updateFeed.bind(_this));

        $happn.event.feed.on('feed-updated', _this.__updateFeed.bind(_this));

        //[end:{"key":"__connectFeeds","self":"_this"}:end]

        resolve();
      })
    });
  });
}

function __updateFeed(feed) {

  var _this = this;

  //[start:{"key":"__updateFeed","self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    try {

      //remove all existing feed data subscriptions
      //{path: '/a/subscription/path', filter: {"data.value":{$lte:10}}}
      var removedPaths = _this.__pareTree.remove({path: '*', filter: {"key": feed.id}});

      _this.__updateMetric('paths', 'count', -removedPaths.length);

      //state is not RUNNING, so if we have removed, we can now quit
      if (feed.state != 2) return resolve();

      feed.datapaths.forEach(function (datapath) {

        _this.__pareTree.add(datapath, {key: feed.id, data: feed});

        _this.__updateMetric('paths', 'count', 1);
      });

      _this.__activeFeeds[feed.id] = feed;

      _this.__updateMetric('feeds', 'count', 1);

      //[end:{"key":"__updateFeed","self":"_this"}:end]

      resolve();

    } catch (e) {

      _this.emit('feed-update-failed', e.toString());

      //[end:{"key":"__updateFeed","self":"_this", "error":"e"}:end]

      reject(e);
    }
  });
}

function __subscribe($happn) {

  var _this = this;

  //[start:{"key":"__subscribe","self":"_this"}:start]

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

      //[end:{"key":"__subscribe","self":"_this", "error":"e"}:end]

      if (e) return reject(e);

      resolve();
    });
  });
}

function __createJobs(eventBatch, subscriptions) {

  var batches = {};

  //[start:{"key":"__createJobs"}:start]

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

  //[end:{"key":"__createJobs"}:end]

  return batches;
}

function __persistBatch(toPersist, $happn) {

  var _this = this;

  //[start:{"key":"__persistBatch","self":"_this"}:start]

  var persisted = {};

  return new Promise(function (resolve, reject) {

    $happn.exchange.worker.createBatch(toPersist.batch, function (e, created) {

      if (e) {

        _this.emit('batch-persist-failed', {batch: toPersist.batch, error: e.toString()});

        //[end:{"key":"__persistBatch","self":"_this", "error":"e"}:end]

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

        var persistBatchResolve = function (result) {
          //[end:{"key":"__persistBatch","self":"_this"}:end]
          resolve(result);
        };

        var persistBatchReject = function (error) {
          //[end:{"key":"__persistBatch","self":"_this", "error":"error"}:end]
          reject(error);
        };

        if (e) return $happn.exchange.worker.updateBatch(persisted.batch.id, {
          state: 3,
          message: 'batch job persist failed: ' + e.toString()
        }).then(persistBatchResolve).catch(persistBatchReject);

        $happn.exchange.worker.updateBatch(persisted.batch.id, {
          state: 0,
          message: 'subscriber emit batch ready'
        }).then(function (updated) {

          persistBatchResolve(updated);

        }).catch(persistBatchReject);
      });
    })
  });
}

function __persistBatches(batches, $happn) {

  var _this = this;

  var currentBatch;
  var persisted = {batches: []};

  //[start:{"key":"__persistBatches","self":"_this"}:start]

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
      _this.emit('batches-failed', persisted);

    } else _this.emit('batches-queued', persisted);

    //[end:{"key":"__persistBatches","self":"_this", "error":"e"}:end]
  });
}


module.exports = Subscriber;