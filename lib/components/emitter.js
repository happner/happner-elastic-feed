var Promise = require('bluebird');
var async = require('async');

function Emitter() {
}

/* initialization and stop */

Emitter.prototype.initialize = initialize;

Emitter.prototype.stop = stop;

/* connection to worker and job event handler */

Emitter.prototype.__connectWorker = __connectWorker;

Emitter.prototype.__handleEmitJob = __handleEmitJob;

/* job management */

Emitter.prototype.__jobBusy = __jobBusy;

Emitter.prototype.__jobCompleted = __jobCompleted;

Emitter.prototype.__jobFailed = __jobFailed;

function initialize($happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this
      .__connectWorker($happn)
      .then(resolve)
      .catch(reject);
  });
}

function stop($happn, callback) {

  callback();
}

function __connectWorker($happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (!$happn.exchange.worker) return reject(new Error('missing worker component'));

    $happn.event.worker.on('emitter', function (job) {

      _this.__handleEmitJob(job, $happn);

    }, function (e) {

      if (e) return reject(e);

      resolve(_this);
    });
  });
}

function __handleEmitJob(job, $happn) {

  var _this = this;

  try {

    _this.__jobBusy(job, $happn);

    $happn.exchange.worker.getBatch(job.batchId)

      .then(function (batch) {

        try {

          var batchData = batch.data;

          var metaPath = batchData.meta.path;

          if (batchData.meta.path.indexOf('/') == -1) metaPath = '/' + metaPath;

          var outputPath = '/happner-feed-data/' + job.data.id + '/' + job.jobType + metaPath;

          $happn._mesh.data.set(outputPath, batchData.data, {merge: true}, function (e, result) {

            if (e) return _this.__jobFailed(job, e, outputPath, $happn);

            _this.__jobCompleted(job, outputPath, result, $happn);
          });

        } catch (e) {

          _this.__jobFailed(job, e, null, $happn);
        }
      })

      .catch(function (e) {

        _this.__jobFailed(job, e, null, $happn);
      });

  } catch (e) {

    _this.__jobFailed(job, e, null, $happn);
  }
}

function __jobBusy(job, $happn) {

  var _this = this;

  try {

    _this.__updateMetric('busy', job.jobType, 1, $happn);

    _this.emit('handle-job', job, $happn);

  } catch (e) {

    _this.__jobFailed(job, e, null, $happn);
  }
}

function __jobCompleted(job, outputPath, result, $happn) {

  var _this = this;

  try {

    $happn.exchange.worker.jobComplete(job, 'data emitted successfully')

      .then(function () {

        _this.__updateMetric('busy', job.jobType, -1, $happn);

        _this.__updateMetric('complete', job.jobType, 1, $happn);

        _this.emit('handle-job-ok', {job: job, result: result, path: outputPath}, $happn);
      })

      .catch(function (e) {

        _this.__updateMetric('busy', job.jobType, 1, $happn);//otherwise gets deprecated twice

        _this.__jobFailed(job, e, outputPath, $happn);
      });

  } catch (e) {
    //TODO all modules need to use the 'service' component to handle fatal errors
    _this.__jobFailed(job, e, outputPath, $happn);
  }
}

function __jobFailed(job, e, outputPath, $happn) {

  var _this = this;

  try {

    $happn.exchange.worker.jobFailed(job, e)

      .then(function () {

        _this.__updateMetric('busy', job.jobType, -1, $happn);

        _this.__updateMetric('failed', job.jobType, 1, $happn);

        _this.emit('handle-job-failed', {job: job, message: e.toString(), path: outputPath}, $happn);
      })

      .catch(function (e) {
        //TODO all modules need to use the 'service' component to handle fatal errors
        return _this.emit('FATAL:unable-to-emit-error', e);
      });

  } catch (e) {
    //TODO all modules need to use the 'service' component to handle fatal errors
    return this.emit('FATAL:unable-to-emit-error', e);
  }
}


module.exports = Emitter;