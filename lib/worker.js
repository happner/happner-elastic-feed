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
{

  Worker.prototype.initialize = function ($happn) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      _this.__attach($happn, function (e) {
        if (e) return reject(e);
        resolve();
      });
    });
  };

  Worker.prototype.stop = function ($happn, callback) {

    this.__detach($happn, function (e) {

      if (e) console.warn('worker detach failed: ' + e.toString());

      callback(e);
    });
  };
}

/* attach and detach */
{

  Worker.prototype.__runIntervalMode = function ($happn, workerId, jobType) {

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
  };

  Worker.prototype.__runWhilstMode = function ($happn, workerId, jobType) {

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
  };

  Worker.prototype.__attach = function ($happn, callback) {

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
  };

  Worker.prototype.__detach = function ($happn, callback) {

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
  };
}

/* job and batch management */
{
  Worker.prototype.getBatch = function (id, $happn) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      $happn.exchange[_this.__options.queue.name].queue.getBatch(id)
        .then(function (batch) {
          resolve(batch);
        })
        .catch(reject);
    })

  };

  Worker.prototype.createBatch = function (options, $happn) {

    return $happn.exchange[this.__options.queue.name].queue.createBatch(options);
  };

  Worker.prototype.updateBatch = function (id, update, $happn) {

    return $happn.exchange[this.__options.queue.name].queue.updateBatch(id, update);
  };

  Worker.prototype.createJob = function (options, $happn) {

    return $happn.exchange[this.__options.queue.name].queue.createJob(options);
  };

  Worker.prototype.updateBusyJob = function (updated, $happn) {

    return $happn.exchange[this.__options.queue.name].queue.updateBusyJob(updated);
  };

  /* convenience methods for job updates */

  Worker.prototype.jobComplete = function(job, message, $happn){

    return this.updateBusyJob({id:job.id, state:2, log:message}, $happn);
  };

  Worker.prototype.jobFailed = function(job, error, $happn){

    return this.updateBusyJob({id:job.id, state:2, log:error.toString()}, $happn);
  };

  Worker.prototype.jobProgress = function(job, progress, $happn){

    return this.updateBusyJob({id:job.id, progress:progress, step:step}, $happn);
  };

  Worker.prototype.jobStep = function(job, step, $happn){

    return this.updateBusyJob({id:job.id, step:step}, $happn);
  };

  Worker.prototype.jobLog = function(job, log, $happn){

    return this.updateBusyJob({id:job.id, log:log}, $happn);
  };
}


module.exports = Worker;