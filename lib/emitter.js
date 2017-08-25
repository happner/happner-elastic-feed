var Promise = require('bluebird');
var async = require('async');

function Emitter() {

}

/* initialization, stop and connection to worker */
{

  Emitter.prototype.initialize = function ($happn) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      _this
        .__connectQueue($happn)
        .then(resolve)
        .catch(reject);
    });
  };

  Emitter.prototype.__connectQueue = function ($happn) {

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
  };

  Emitter.prototype.stop = function ($happn, callback) {

    callback();
  };
}

/* emit jobs */
{

  Emitter.prototype.__handleEmitJob = function (job, $happn) {

    var _this = this;

    try {

      _this.emit('handle-job', job, $happn);

      _this.__updateMetric('busy', job.jobType, 1, $happn);

      $happn.exchange.worker.getBatch(job.batchId)

        .then(function (batch) {

          var batchData = batch.data;

          var metaPath = batchData.meta.path;

          if (batchData.meta.path.indexOf('/') == -1) metaPath = '/' + metaPath;

          var outputPath = '/happner-feed-data/' + job.data.id + '/' + job.jobType + metaPath;

          $happn._mesh.data.set(outputPath, batchData.data, {merge: true}, function (e, result) {

            _this.__updateMetric('busy', job.jobType, -1, $happn);

            if (e) {

              _this.__updateMetric('failed', job.jobType, 1, $happn);
              return _this.emit('handle-job-failed', {job: job, message: e.toString(), path: outputPath}, $happn);
            }

            _this.__updateMetric('complete', job.jobType, 1, $happn);
            _this.emit('handle-job-ok', {job: job, result: result, path: outputPath}, $happn);
          });
        })

        .catch (function (e) {

          _this.__updateMetric('busy', job.jobType, -1, $happn);
          _this.__updateMetric('failed', job.jobType, 1, $happn);

          _this.emit('handle-job-failed', {job: job, message: e.toString()}, $happn);
        });

    } catch (e) {

      _this.__updateMetric('busy', job.jobType, -1, $happn);
      _this.__updateMetric('failed', job.jobType, 1, $happn);
      //dont pass happn here in case we have an exchange issue
      _this.emit('handle-job-failed', {job: job, message: e.toString()});
    }
  }
}

module.exports = Emitter;