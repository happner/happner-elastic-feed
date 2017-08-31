var Promise = require('bluebird')
  , async = require('async')
  ;

function Worker(options) {

  if (!options || !options.queue) throw new Error('worker must be initialized with options.queue argument');

  if (options.queue.jobTypes == null) throw new Error('missing options.queue.jobTypes argument');

  if (!options.interval) options.interval = 1000;

  if (!options.mode) options.mode = 0; //whilst

  this.__options = options;

  this.__workers = {};
}

/* initialize and stop */

Worker.prototype.initialize = initialize;

Worker.prototype.stop = stop;

/* attach and detach */

Worker.prototype.__runIntervalMode = __runIntervalMode; //fetch jobs every N seconds

Worker.prototype.__runWhilstMode = __runWhilstMode; //fetch jobs continually as they are completed

Worker.prototype.__attach = __attach;

Worker.prototype.__detach = __detach;

/* job and batch management */

Worker.prototype.getBatch = getBatch;

Worker.prototype.createBatch = createBatch;

Worker.prototype.updateBatch = updateBatch;

Worker.prototype.createJob = createJob;

Worker.prototype.updateBusyJob = updateBusyJob;

/* job progress, failed, complete */

Worker.prototype.jobComplete = jobComplete;

Worker.prototype.jobFailed = jobFailed;

Worker.prototype.jobProgress = jobProgress;

Worker.prototype.jobStep = jobStep;

Worker.prototype.jobLog = jobLog;


function initialize($happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.__attach($happn, function (e) {
      if (e) return reject(e);
      resolve();
    });
  });
}

function stop($happn, callback) {

  this.__detach($happn, function (e) {

    if (e) console.warn('worker detach failed: ' + e.toString());

    callback(e);
  });
}

function __runIntervalMode($happn, workerId, jobType) {

  var _this = this;

  _this.__workers[workerId] = setInterval(function () {

    $happn.exchange[_this.__options.queue.name].queue.pop(this)

      .then(function (job) {

        if (!job) return;

        _this.emit(this.jobType, job, $happn);

      }.bind(this))

      .catch(function (e) {

        _this.emit(this.jobType + '-error', e.toString(), $happn);

      }.bind(this))

  }.bind({jobType: jobType, workerId: workerId}), _this.__options.interval);
  //binding on the setInterval so the correct workerId is used
}

function __runWhilstMode($happn, workerId, jobType) {

  var _this = this;

  _this.__stopped = false;

  _this.__workers[workerId] = true;

  async.whilst(
    function () {
      return !_this.__stopped;
    },
    function (callback) {

      $happn.exchange[_this.__options.queue.name].queue.pop({jobType: jobType, workerId: workerId})

        .then(function (job) {

          if (!job) return setTimeout(callback, 100);//pause a little

          _this.emit(jobType, job, $happn, callback);
        })

        .catch(function (e) {

          _this.emit(jobType + '-error', e.toString(), $happn, callback);
        })
    },
    function (e) {

      if (_this.__stoppedCB) return _this.__stoppedCB(e);

      else {

        _this.emit('worker-listen-error', {error: e}, $happn);
      }
    }
  );
}

function __attach($happn, callback) {

  var _this = this;

  async.eachSeries(_this.__options.queue.jobTypes,

    function (jobType, jobTypeCB) {

      try {

        $happn
          .exchange[_this.__options.queue.name].queue

          .attach({jobType: jobType})

          .then(function (workerId) {

            try {

              if (_this.__options.mode == 0) _this.__runWhilstMode($happn, workerId, jobType);

              else _this.__runIntervalMode($happn, workerId, jobType);

              jobTypeCB();

            } catch (e) {

              jobTypeCB(e);
            }
          })
          .catch(jobTypeCB);
      } catch (e) {
        jobTypeCB(e);
      }
    }, callback);
}

function __detach($happn, callback) {

  var _this = this;

  _this.__stopped = true;//caught by the worker so halts any popping

  async.eachSeries(Object.keys(_this.__workers),

    function (workerId, jobTypeCB) {

      $happn
        .exchange[_this.__options.queue.name].queue
        .detach({workerId: workerId})
        .then(function (workerId) {

          if (_this.__options.mode == 1) clearInterval(_this.__workers[workerId]);

          jobTypeCB();
        })
        .catch(jobTypeCB);

    }, callback);
}

function getBatch(id, $happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    $happn.exchange[_this.__options.queue.name].queue.getBatch(id)
      .then(function (batch) {
        resolve(batch);
      })
      .catch(reject);
  })

}

function createBatch(options, $happn) {

  return $happn.exchange[this.__options.queue.name].queue.createBatch(options);
}

function updateBatch(id, update, $happn) {

  return $happn.exchange[this.__options.queue.name].queue.updateBatch(id, update);
}

function createJob(options, $happn) {

  return $happn.exchange[this.__options.queue.name].queue.createJob(options);
}

function updateBusyJob(updated, $happn) {

  return $happn.exchange[this.__options.queue.name].queue.updateBusyJob(updated);
}

function jobComplete(job, message, $happn) {

  return this.updateBusyJob({id: job.id, state: 2, log: message}, $happn);
}

function jobFailed(job, error, $happn) {

  return this.updateBusyJob({id: job.id, state: 2, log: error.toString()}, $happn);
}

function jobProgress(job, progress, $happn) {

  return this.updateBusyJob({id: job.id, progress: progress, step: step}, $happn);
}

function jobStep(job, step, $happn) {

  return this.updateBusyJob({id: job.id, step: step}, $happn);
}

function jobLog(job, log, $happn) {

  return this.updateBusyJob({id: job.id, log: log}, $happn);
}

module.exports = Worker;