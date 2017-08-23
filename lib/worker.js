var Promise = require('bluebird')
  , async = require('async')
  ;

function Worker(options) {

  if (!options || !options.queue) throw new Error('worker must be initialized with options.queue argument');

  if (options.queue.jobTypes == null) throw new Error('missing options.queue.jobTypes argument');

  if (!options.interval) options.interval = 1000;

  this.__options = options;

  this.__workerEvents = {};
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

      if (e) {
        console.warn('worker detach failed: ' + e.toString());
      }
      callback(e);
    });
  };
}

/* attach and detach */
{
  Worker.prototype.__attach = function ($happn, callback) {

    var _this = this;

    async.eachSeries(_this.__options.queue.jobTypes,

      function (jobType, jobTypeCB) {

        try {

          $happn
            .exchange[_this.__options.queue.name].queue
            .attach({jobType: jobType})
            .then(function (workerId) {

              _this.__workerEvents[workerId] = setInterval(function () {

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
            })
            .then(jobTypeCB)
            .catch(jobTypeCB);
        } catch (e) {
          jobTypeCB(e);
        }
      }, callback);
  };

  Worker.prototype.__detach = function ($happn, callback) {

    var _this = this;

    async.eachSeries(Object.keys(_this.__workerEvents),

      function (workerId, jobTypeCB) {

        $happn
          .exchange[_this.__options.queue.name].queue
          .detach({workerId: workerId})
          .then(function (workerId) {
            clearInterval(_this.__workerEvents[workerId]);
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
}


module.exports = Worker;