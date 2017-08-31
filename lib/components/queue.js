var kue = require('kue')
  , Promise = require('bluebird')
  , uuid = require('uuid')
  , Redis = require('ioredis')
  , async = require('async')
  , EventEmitter = require('events').EventEmitter
  , Utilities = require('../utilities')
  ;

function Queue(options) {

  if (!options) throw new Error('queue must be initialized with options argument');

  if (options.queue == null) throw new Error('missing options.queue argument');

  if (options.queue.jobTypes == null) throw new Error('missing options.queue.jobTypes argument');

  if (!options.queue.stopTimeout) options.queue.stopTimeout = 5000;

  this.__assignedJobs = {};

  this.__busyJobs = [];

  this.__workers = {};

  this.__options = options;

  EventEmitter.prototype._maxListeners = 1000;

  this.__events = new EventEmitter();

  this.utilities = new Utilities();
}

/* initialize, connect, listen, stop */

Queue.prototype.initialize = initialize;

Queue.prototype.listen = listen;

Queue.prototype.stop = stop;

Queue.prototype.__connect = __connect;

/* events */

Queue.prototype.emit = emit;

Queue.prototype.on = on;

Queue.prototype.off = off;

/* metrics */

Queue.prototype.__updateStateMetric = __updateStateMetric;

/* worker management */

Queue.prototype.attach = attach;

Queue.prototype.detach = detach;

Queue.prototype.findWorker = findWorker;

Queue.prototype.getLeastBusyWorker = getLeastBusyWorker;

Queue.prototype.__updateWorkerBusy = __updateWorkerBusy;

/* batches */

Queue.prototype.getBatch = getBatch;

Queue.prototype.createBatch = createBatch;

Queue.prototype.updateBatch = updateBatch;

Queue.prototype.__updateJobBatch = __updateJobBatch;

Queue.prototype.__validateJobBatch = __validateJobBatch;

Queue.prototype.__storeNewBatch = __storeNewBatch;

/* jobs */

Queue.prototype.pop = pop;

Queue.prototype.createJob = createJob;

Queue.prototype.kueState = kueState;

Queue.prototype.removeJobs = removeJobs;

Queue.prototype.updateJob = updateJob;

Queue.prototype.updateJobs = updateJobs;

Queue.prototype.searchJobs = searchJobs;

Queue.prototype.jobCountByState = jobCountByState;

Queue.prototype.updateBusyJob = updateBusyJob;

Queue.prototype.getBusyJob = getBusyJob;

Queue.prototype.unAssignJobs = unAssignJobs;

Queue.prototype.reAssignJobs = reAssignJobs;

Queue.prototype.__saveNewJob = __saveNewJob;

Queue.prototype.__serializeJob = __serializeJob;

Queue.prototype.__assignJob = __assignJob;

Queue.prototype.__cleanupJobDB = __cleanupJobDB;

Queue.prototype.__cleanupBatchDB = __cleanupBatchDB;

Queue.prototype.__removeBusyJob = __removeBusyJob;

/* enums */

Queue.prototype.JOB_STATE = {
  PENDING: 0,
  BUSY: 1,
  COMPLETED: 2,
  FAILED: 3,
  DELAYED: 4,
  INACTIVE: 5,
  ASSIGNED: 6,
  ACTIVE: 7
};

Queue.prototype.BATCH_STATE = {
  QUEUEING: -1,//batch is still being assembled
  PENDING: 0,
  BUSY: 1,
  COMPLETED: 2,
  FAILED: 3
};

function initialize($happn) {

  var _this = this;

  //[start:{"key":"initialize", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    if (_this.__options.queue.redis == null) _this.__options.queue.redis = {};

    if (!_this.__options.queue.concurrency) _this.__options.queue.concurrency = {};

    if (_this.__options.queue.kue == null) _this.__options.queue.kue = {};

    _this.__connect(function (e) {

      if (e) return reject(e);

      //[end:{"key":"initialize", "self":"_this"}:end]

      resolve();
    }, $happn);
  });
}

function listen(callback, $happn) {

  var _this = this;

  //[start:{"key":"listen", "self":"_this"}:start]

  Object.keys(_this.__options.queue.jobTypes).forEach(function (jobTypeKey) {

    var jobType = _this.__options.queue.jobTypes[jobTypeKey];

    if (jobType.concurrency == null)  jobType.concurrency = 100;

    _this.__queue
      .process(jobTypeKey, jobType.concurrency, function (job, ctx, done) {

        var jobDone = function () {
          _this.__updateJobBatch(job.data, this.jobDone, null, $happn);
        }.bind({job: job.data, jobDone: done});

        _this.__assignJob(job.data.jobType, job, ctx, jobDone, $happn);
      });
  });

  _this.__queue.on('job complete', function (id) {
    _this.__cleanupJobDB(id, null, $happn);
  });

  _this.__queue.on('failed', function (id, e) {
    _this.__cleanupJobDB(id, e, $happn);
  });

  //[end:{"key":"listen", "self":"_this"}:end]

  callback();
}

function stop($happn, callback) {

  var _this = this;

  //[start:{"key":"stop", "self":"_this"}:start]

  if (typeof $happn == 'function') {
    callback = $happn;
    $happn = null;
  }

  if (!_this.__queue) {
    //[end:{"key":"stop", "self":"_this"}:end]
    return callback();
  }

  async.eachSeries(Object.keys(_this.__options.queue.jobTypes), function (jobType, jobTypeCB) {

    _this.__queue.shutdown(_this.__options.queue.stopTimeout, jobType, jobTypeCB);

  }, function (e) {

    //[end:{"key":"stop", "self":"_this", "error":"e"}:end]
    callback(e);
  });
}

function __connect(callback, $happn) {

  var _this = this;

  //[start:{"key":"__connect", "self":"_this"}:start]

  if (Array.isArray(_this.__options.queue.redis)) {

    _this.__client = new Redis.Cluster(_this.__options.queue.redis);

    options.kue.redis = {
      createClientFactory: function () {
        return new Redis.Cluster(_this.__options.queue.redis);
      }
    };

  } else {

    _this.__client = new Redis(_this.__options.queue.redis);

    _this.__options.queue.kue.redis = {
      createClientFactory: function () {
        return new Redis(_this.__options.queue.redis);
      }
    };
  }

  _this.__queue = kue.createQueue(_this.__options.queue.kue);

  //[end:{"key":"__connect", "self":"_this"}:end]

  if (_this.__options.queue.deferListen) return callback();

  _this.listen(callback, $happn);
}


function emit(key, data, $happn) {

  var _this = this;

  if ($happn) {

    //[start:{"key":"emit", "self":"_this"}:start]

    $happn.emit(key, data, function (e) {

      //[end:{"key":"emit", "self":"_this"}:end]

      if (e) _this.__events.emit('emit-failure', [key, data]);
    });
  }

  _this.__events.emit(key, data);
}

function on(key, handler) {

  return this.__events.on(key, handler);
}

function off(key, handler) {

  return this.__events.removeListener(key, handler);
}


function __updateStateMetric(key, subkey, value, $happn) {

  var _this = this;

  //[start:{"key":"__updateStateMetric", "self":"_this"}:start]

  var found = null;

  Object.keys(this.JOB_STATE).every(function (stateKey) {

    if (_this.JOB_STATE[stateKey] == key)
      found = stateKey.toLowerCase();

    return !found;
  });

  if (!found) throw new Error('unknown job state');

  _this.__updateMetric(found, subkey, value, $happn);

  this.emit('metric-changed', {key: found, subkey: subkey, value: value}, $happn);

  //[end:{"key":"__updateStateMetric", "self":"_this"}:end]
}


/* worker management */

function attach(options, $happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (!options) return reject('missing worker options argument');

    if (options.jobType == null) return reject('missing worker options.jobType argument or invalid jobType');

    //[start:{"key":"attach", "self":"_this"}:start]

    var workerId = options.jobType + '_' + uuid.v4();

    if (!_this.__workers[options.jobType]) _this.__workers[options.jobType] = [];

    var worker = {id: workerId, busy: []};

    _this.__workers[options.jobType].push(worker);

    _this.__updateMetric('attached', options.jobType, 1, $happn);

    _this.reAssignJobs(options.jobType, null, $happn).then(function () {

      //[end:{"key":"attach", "self":"_this"}:end]

      resolve(workerId);

    }).catch(reject);
  });
}

function detach(options, $happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (!options || !options.workerId) return reject(new Error('detach needs at least options.id argument'));

    var jobType = options.workerId.split('_')[0];

    if (_this.__workers[jobType] == null || _this.__workers[jobType].length == 0) return resolve(null);

    //[start:{"key":"detach", "self":"_this"}:start]

    var found = null;

    var workerIndex = _this.__workers[jobType].length;

    async.eachSeries(_this.utilities.cloneArray(_this.__workers[jobType], true), function (worker, workerCB) {

      workerIndex--;

      if (!worker) return workerCB();

      if (worker.id != options.workerId) return workerCB();

      found = worker;

      //remove the worker
      _this.__workers[jobType].splice(workerIndex, 1);

      if (worker.busy > 0) {
        //push jobs back into pending list as they are resume-able
        if (options.reAssign) {

          return _this.reAssignJobs(jobType, worker.id, $happn)
            .then(function () {
              workerCB();
            })
            .catch(function (e) {
              workerCB(e);
            });
        }
      }

      workerCB();

    }, function (e) {

      //[end:{"key":"detach", "self":"_this"}:end]

      if (e) return reject(e);

      if (found) {
        _this.__updateMetric('attached', jobType, -1, $happn);
        _this.__updateMetric('detached', jobType, 1, $happn);
        return resolve(found.id);
      }

      resolve(null);
    });
  });
}

function findWorker(id) {

  var _this = this;

  //[start:{"key":"findWorker", "self":"_this"}:start]

  var jobType = id.split('_')[0];

  if (_this.__workers[jobType] == null) return null;

  var found = null;

  _this.__workers[jobType].every(function (worker) {
    if (worker.id == id) found = worker;
    return found == null;
  });

  //[end:{"key":"findWorker", "self":"_this"}:end]

  return found;
}

function __updateWorkerBusy(id, value, $happn) {

  //[start:{"key":"findWorker"}:start]

  var worker = this.findWorker(id);

  var jobType = id.split('_')[0];

  if (worker) {
    worker.busy += value;
  }

  //[end:{"key":"findWorker"}:end]
}

function getLeastBusyWorker(jobType) {

  var _this = this;

  //[start:{"key":"getLeastBusyWorker", "self":"_this"}:start]

  var leastBusyWorker = null;

  if (_this.__workers[jobType] == null || _this.__workers[jobType].length == 0) return null;

  _this.__workers[jobType].every(function (worker) {

    leastBusyWorker = worker;

    if (worker.busy == 0) return false;

    if (worker.busy < leastBusyWorker.busy) leastBusyWorker = worker;

    return true;
  });

  leastBusyWorker.busy++;

  //[end:{"key":"getLeastBusyWorker", "self":"_this"}:end]

  return leastBusyWorker.id;
}


function getBatch(id) {

  var _this = this;

  //[start:{"key":"getBatch", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    if (id == 0) return resolve(null);

    _this.__client.get(id, function (e, batch) {

      if (e) {
        //[end:{"key":"getBatch", "self":"_this"}:end]
        return reject(e);
      }

      if (!batch) {
        //[end:{"key":"getBatch", "self":"_this"}:end]
        return resolve(null);
      }

      var parsed = JSON.parse(batch);

      //[end:{"key":"getBatch", "self":"_this"}:end]
      resolve(parsed);

    });
  });
}

function createBatch(options) {

  var _this = this;

  //[start:{"key":"createBatch", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    if (!options) {

      return reject('missing batch options argument');
    }

    if (options.size == null) options.size = 0; //batch is for an undefined amount of jobs

    else options.state = _this.BATCH_STATE.QUEUEING;//batch still being assembled

    if (options.jobType == null) {

      //[end:{"key":"createBatch", "self":"_this"}:end]

      return reject('missing batch options.jobType argument or invalid type');
    }

    _this.__storeNewBatch(options)

      .then(function (stored) {
        //[end:{"key":"createBatch", "self":"_this"}:end]
        resolve(stored);
      })
      .catch(function (failed) {
        //[end:{"key":"createBatch", "self":"_this"}:end]
        reject(failed);
      });
  })
}

function updateBatch(id, update) {

  var _this = this;

  //[start:{"key":"updateBatch", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    return _this.getBatch(id).then(function (batch) {

      if (!batch) {

        //[end:{"key":"updateBatch", "self":"_this"}:end]
        return reject('no batch found');
      }

      if (update.data)
        update.data.forEach(function (propertyKey) {
          batch.data[propertyKey] = update.data[propertyKey]
        });

      if (update.state != null) batch.state = update.state;

      if (update.message != null) batch.message = update.message;

      if (update.completed != null) batch.completed += update.completed;

      if (batch.completed == batch.size) batch.state = _this.BATCH_STATE.COMPLETED;

      _this.__client.set(batch.id, JSON.stringify(batch), function (e) {

        //[end:{"key":"updateBatch", "self":"_this", "error":"e"}:end]

        if (e) return reject(e);

        resolve(batch);
      });
    });
  });
}

//updates the batch that one of its jobs is completed
function __updateJobBatch(jobData, batch, callback) {

  var _this = this;

  //[start:{"key":"__updateJobBatch", "self":"_this"}:start]

  try {

    var complete = function (batchData) {

      if (jobData.state == _this.JOB_STATE.PENDING) {

        batchData.count++;
        if (batchData.size == batchData.count) batchData.state = _this.BATCH_STATE.PENDING;//from QUEUED
      }

      if ([_this.JOB_STATE.COMPLETED, _this.JOB_STATE.FAILED].indexOf(jobData.state) > -1) batchData.processed++;

      if (!batchData.jobStates[jobData.state]) batchData.jobStates[jobData.state] = 0;

      batchData.jobStates[jobData.state]++;

      if (batchData.size > 0 && batchData.processed == batchData.size) batchData.state = _this.BATCH_STATE.COMPLETED;

      //update the changed batch
      _this.__client.set(batchData.id, JSON.stringify(batchData), function (e) {

        //[end:{"key":"__updateJobBatch", "self":"_this", "error":"e"}:end]

        //TODO: remove batch if it is completed?

        callback(e, batchData);
      });
    };

    if (typeof batch === 'function') {
      callback = batch;
      batch = null;
    }

    if (!jobData.batchId) {

      return callback(null, jobData);
    }

    if (!batch) _this.getBatch(jobData.batchId).then(complete).catch(function (e) {

      //[end:{"key":"__updateJobBatch", "self":"_this", "error":"e"}:end]
      callback(e);
    });

    else complete(batch);

  } catch (e) {

    //[end:{"key":"__updateJobBatch", "self":"_this", "error":"e"}:end]
    callback(e);
  }
}

//updates the batch that one of its jobs is completed
function __validateJobBatch(jobData, batch) {

  //[start:{"key":"__validateJobBatch"}:start]
  if (batch.size != 0 && batch.count == batch.size) {
    //[end:{"key":"__updateJobBatch", "self":"_this"}:end]
    throw new Error('batch size is limited to ' + batch.size + ' jobs.');
  }
  //[end:{"key":"__validateJobBatch"}:end]
}

function __storeNewBatch(options) {

  var _this = this;

  //[start:{"key":"__storeNewBatch", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    var batch = {data: options.data ? options.data : null, timestamp: Date.now()};

    var prefix = _this.__options.queue.kue.prefix ? _this.__options.queue.kue.prefix : '';

    batch.id = options.jobType + '_' + prefix + '_' + uuid.v4();

    batch.state = _this.BATCH_STATE.PENDING;

    batch.processed = 0;

    batch.size = options.size;

    batch.jobStates = {};

    batch.jobType = options.jobType;

    _this.__client.set(batch.id, JSON.stringify(batch), function (e) {

      //[end:{"key":"__storeNewBatch", "self":"_this", "error":"e"}:end]

      if (e) return reject(e);

      resolve(batch.id);
    });
  });
}

function pop(options) {

  var _this = this;

  //[start:{"key":"pop", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    if (!options.workerId) return reject('missing workerId argument');

    var jobType = options.workerId.split('_')[0];

    var found = null;

    if (_this.__assignedJobs[jobType] == null) return resolve(false);

    _this.__assignedJobs[jobType].every(function (job, jobIndex) {

      if (job.workerId == options.workerId) {

        found = job;

        found.kue.data.state = _this.JOB_STATE.BUSY;

        _this.__busyJobs.push(job);

        _this.__assignedJobs[jobType].splice(jobIndex, 1);
      }

      return found == null;
    });

    if (found) {

      _this.__updateStateMetric(_this.JOB_STATE.ASSIGNED, jobType, -1);

      _this.__updateStateMetric(_this.JOB_STATE.BUSY, jobType, 1);

      //[end:{"key":"pop", "self":"_this"}:end]

      return resolve(_this.__serializeJob(found));
    }

    else {

      //[end:{"key":"pop", "self":"_this"}:end]

      resolve(false);
    }
  });
}

function __saveNewJob(options, batch, resolve, reject, $happn) {

  try {

    var _this = this;

    //[start:{"key":"__saveNewJob", "self":"_this"}:start]

    var jobData = {
      batchId: options.batchId,
      data: options.data,
      jobType: options.jobType,
      queueId: options.jobType + '_' + uuid.v4(),
      state: _this.JOB_STATE.PENDING,
      progress: 0,
      step: ""
    };

    if (jobData.batchId) _this.__validateJobBatch(jobData, batch);

    var job = _this.__queue.create(options.jobType, jobData);

    if (options.attempts > 1) {

      job = job.attempts(options.attempts);
      if (options.backoff != null) job = job.backoff(options.backoff);//can be {type:'exponential/fixed', delay: 60*1000}
    }

    if (options.ttl > 0) job = job.ttl(options.ttl);

    job.save(function (e) {

      if (e) {
        //[end:{"key":"__saveNewJob", "self":"_this", "error":"e"}:end]
        return reject(e);
      }

      _this.__updateJobBatch(job.data, batch, function (e) {

        if (e) {
          //[end:{"key":"__saveNewJob", "self":"_this", "error":"e"}:end]
          return reject(e);
        }

        _this.__updateMetric('pending', options.jobType, 1);

        //[end:{"key":"__saveNewJob", "self":"_this"}:end]
        resolve(_this.__serializeJob(job));

      }, $happn);
    });

  } catch (e) {
    reject(e);
  }
}

function createJob(options, $happn) {

  var _this = this;

  //[start:{"key":"createJob", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    if (options.jobType == null) return reject(new Error('options.jobType argument missing'));

    var createJobResolve = function (created) {
      //[end:{"key":"createJob", "self":"_this"}:end]
      resolve(created);
    };

    var createJobReject = function (error) {
      //[end:{"key":"createJob", "self":"_this"}:end]
      reject(error);
    };

    if (options.batchId) {

      return _this.getBatch(options.batchId).then(function (batch) {

        _this.__saveNewJob(options, batch, createJobResolve, createJobReject, $happn);
      });
    }

    _this.__saveNewJob(options, null, createJobResolve, createJobReject, $happn);
  });
}

function kueState(state) {

  var kueState = 'failed';

  if (state == this.JOB_STATE.PENDING) kueState = 'active';

  if (state == this.JOB_STATE.BUSY) kueState = 'active';

  if (state == this.JOB_STATE.ACTIVE) kueState = 'active';

  if (state == this.JOB_STATE.ASSIGNED) kueState = 'active';

  if (state == this.JOB_STATE.DELAYED) kueState = 'delayed';

  if (state == this.JOB_STATE.COMPLETED) kueState = 'complete';

  if (state == this.JOB_STATE.INACTIVE) kueState = 'inactive';

  return kueState;
}

function removeJobs(options) {

  var _this = this;

  //[start:{"key":"removeJobs", "self":"_this"}:start]

  var removed = [];

  if (!options) options = {};

  if (options.state == null) options.state = _this.JOB_STATE.COMPLETED;

  return new Promise(function (resolve, reject) {

    _this.searchJobs(options)

      .then(function (jobs) {

        if (!jobs || jobs.length == 0) {
          //[end:{"key":"removeJobs", "self":"_this"}:end]
          return resolve([]);
        }

        async.eachSeries(jobs, function (job, jobCB) {

          try {

            job.remove(function (e) {

              if (e) return jobCB(e);

              removed.push(job.id);

              jobCB();
            });
          } catch (e) {
            jobCB(e);
          }
        }, function (e) {

          //[end:{"key":"removeJobs", "self":"_this", "error":"e"}:end]

          if (e) return reject(e);

          return resolve(removed);
        });
      })
      .catch(reject);
  });
}

function updateJob(job, updates) {

  var _this = this;

  //[start:{"key":"updateJob", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    if (updates.progress != null) job.data.progress = updates.progress;

    if (updates.state != null) job.data.state = updates.state;

    if (updates.step != null) job.data.step = updates.step;

    if (updates.log)  job.log('job: ' + '  ' + job.id + '  ' + Date.now().toString(), updates.log);

    if (updates.state == _this.JOB_STATE.COMPLETED) job.data.progress = 100;

    job.save(function (e) {

      //[end:{"key":"updateJob", "self":"_this", "error":"e"}:end]

      if (e) return reject(e);
      resolve(job.id);
    });
  });
};

function updateJobs(criteria, updates) {

  var _this = this;

  //[start:{"key":"updateJobs", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    var updated = [];

    _this.searchJobs(criteria)
      .then(function (jobs) {

        async.eachSeries(jobs, function (job, jobCB) {

          _this.updateJob(job, updates).then(function (jobId) {
            updated.push(jobId);
            jobCB();
          }).catch(jobCB);

        }, function (e) {

          //[end:{"key":"updateJobs", "self":"_this", "error":"e"}:end]

          if (e) return reject(e);

          resolve(updated);
        });
      })
      .catch(function (e) {

        //[end:{"key":"updateJobs", "self":"_this", "error":"e"}:end]

        reject(e);
      });
  });
}

function searchJobs(options) {

  var _this = this;

  //[start:{"key":"searchJobs", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    if (!options) options = {};

    if (options.state == null) options.state = _this.JOB_STATE.FAILED;

    if (options.direction == null) options.direction = 'asc';

    if (options.count == null) options.count = 0;

    var rangeState = _this.kueState(options.state);

    var completeSearch = function (type, count, state) {

      if (count > 0) count--; //weird way of limiting from zero based

      if (type) {
        kue.Job.rangeByType(type, state, 0, count, options.direction, function (e, jobs) {

          //[end:{"key":"searchJobs", "self":"_this", "error":"e"}:end]

          if (e) return reject(e);
          resolve(jobs);
        });
      }
      else {
        kue.Job.rangeByState(state, 0, count, options.direction, function (e, jobs) {

          //[end:{"key":"searchJobs", "self":"_this", "error":"e"}:end]

          if (e) return reject(e);
          resolve(jobs);
        });
      }
    };

    if (options.count == 0) return _this.jobCountByState(options).then(function (count) {

      if (count == 0) return resolve([]);

      completeSearch(options.jobType, count, rangeState);

    }).catch(function (e) {
      //[end:{"key":"searchJobs", "self":"_this", "error":"e"}:end]
      reject(e);
    });

    completeSearch(options.jobType, options.count, rangeState);
  });
}

function jobCountByState(options) {

  var _this = this;

  //[start:{"key":"jobCountByState", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    if (typeof options == 'function') {
      callback = options;
      options = {state: _this.JOB_STATE.FAILED};
    }

    if (options.state == null) {
      //[end:{"key":"jobCountByState", "self":"_this"}:end]
      return reject(new Error('missing argument job options.state'));
    }

    var jobCountCallback = function (e, count) {

      //[end:{"key":"jobCountByState", "self":"_this", "error":"e"}:end]

      if (e) return reject(e);
      return resolve(count);
    };

    try {

      if (options.state == _this.JOB_STATE.FAILED) {

        if (options.jobType) return _this.__queue.failedCount(options.jobType, jobCountCallback);
        else return _this.__queue.failedCount(jobCountCallback);
      }

      if (options.state == _this.JOB_STATE.COMPLETED) {

        if (options.jobType) return _this.__queue.completeCount(options.jobType, jobCountCallback);
        else return _this.__queue.completeCount(jobCountCallback);
      }

      if (options.state == _this.JOB_STATE.DELAYED) {

        if (options.jobType) return _this.__queue.delayedCount(options.jobType, jobCountCallback);
        else return _this.__queue.delayedCount(jobCountCallback);
      }

      if (options.state == _this.JOB_STATE.ACTIVE) {

        if (options.jobType) return _this.__queue.activeCount(options.jobType, jobCountCallback);
        else return _this.__queue.activeCount(jobCountCallback);
      }

      if (options.state == _this.JOB_STATE.INACTIVE) {

        if (options.jobType) return _this.__queue.inactiveCount(options.jobType, jobCountCallback);
        else return _this.__queue.inactiveCount(jobCountCallback);
      }

      //[end:{"key":"jobCountByState", "self":"_this"}:end]

      reject(new Error('unknown job options.state: ' + options.state + ' PENDING, ASSIGNED, BUSY are all just ACTIVE in kue'));

    } catch (e) {

      //[end:{"key":"jobCountByState", "self":"_this", "error":"e"}:end]

      reject(e);
    }
  });
}

function updateBusyJob(updated, $happn) {

  var _this = this;

  //[start:{"key":"updateBusyJob", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    try {

      var busyJob = _this.getBusyJob(updated.id);

      var timestamp = Date.now();

      if (!busyJob)
        throw new Error('job with id: ' + updated.id + ' is not busy or does not exist');

      if (updated.progress != null) busyJob.kue.data.progress = updated.progress;

      if (updated.step != null) busyJob.kue.data.step = updated.step;

      if (updated.log)  busyJob.kue.log('job: ' + '  ' + updated.id + '  ' + timestamp.toString(), updated.log);

      if (updated.state == _this.JOB_STATE.COMPLETED) {

        busyJob.kue.data.progress = 100;
        _this.__removeBusyJob(busyJob.kue.id, $happn);
        busyJob.done();
      }
      else if (updated.state == _this.JOB_STATE.FAILED) {

        _this.__removeBusyJob(busyJob.kue.id, $happn);
        busyJob.done(updated.error);
      }
      else {
        busyJob.kue.progress(updated.progress, 100, updated);
      }

      if (updated.state != null && busyJob.kue.data.state != updated.state) {

        _this.__updateStateMetric(busyJob.kue.data.state, busyJob.kue.data.jobType, -1, $happn);

        _this.__updateStateMetric(updated.state, busyJob.kue.data.jobType, 1, $happn);

        busyJob.kue.data.state = updated.state;
      }

      //[end:{"key":"updateBusyJob", "self":"_this"}:end]

      return resolve(_this.__serializeJob(busyJob));

    } catch (e) {
      //[end:{"key":"updateBusyJob", "self":"_this", "error":"e"}:end]
      reject(e);
    }
  });
}

function getBusyJob(id) {

  var _this = this;

  //[start:{"key":"getBusyJob", "self":"_this"}:start]

  var found = null;

  _this.__busyJobs.every(function (job) {

    if (job.kue.id == id) found = job;

    return !found;
  });

  //[end:{"key":"getBusyJob", "self":"_this"}:end]

  return found;
}


function unAssignJobs(jobArray, jobType, workerId, jobId, $happn) {

  var _this = this;

  //[start:{"key":"unAssignJobs", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    var unAssigned = [];

    if (jobArray == null || jobArray.length == 0) {

      //[end:{"key":"unAssignJobs", "self":"_this"}:end]
      return resolve([]);
    }

    var jobIndex = jobArray.length;

    async.eachSeries(_this.utilities.cloneArray(jobArray, true), function (job, jobCB) {

      try {

        jobIndex--;

        if (!job) return jobCB();

        if (workerId && job.workerId != workerId) return jobCB();

        if (jobId && job.kue.id != jobId) return jobCB();

        var completeUnassign = function (e) {

          if (e) return jobCB(e);

          jobArray.splice(jobIndex, 1);//take it out of the job array, its cool because we iterating over jobArray.reverse()

          unAssigned.push(job);

          jobCB();
        };

        if (job.kue.data.state != _this.JOB_STATE.PENDING) {

          _this.updateBusyJob({id: job.kue.id, state: _this.JOB_STATE.PENDING})
            .then(function () {
              completeUnassign();
            })
            .catch(completeUnassign);

        } else completeUnassign();

      } catch (e) {
        jobCB(e);
      }

    }, function (e) {

      //[end:{"key":"unAssignJobs", "self":"_this", "error":"e"}:end]

      if (e) return reject(e);
      resolve(unAssigned);
    });
  });
};

//if we have a bunch of jobs that have no __workers assigned to them or are assigned to a worker that has been de-registered,
// reconfigure them to point to new worker/s
function reAssignJobs(jobType, workerId, $happn) {

  var _this = this;

  //[start:{"key":"reAssignJobs", "self":"_this"}:start]

  var reAssigned = [];

  return new Promise(function (resolve, reject) {

    _this.unAssignJobs(_this.__assignedJobs[jobType], jobType, workerId, null, $happn)

      .then(function (unAssigned) {

        unAssigned.forEach(function (job) {
          _this.__assignJob(jobType, job.kue, job.ctx, job.done);
          reAssigned.push(job.kue.id);
        });

        return _this.unAssignJobs(_this.__busyJobs, jobType, workerId, null, $happn);
      })
      .then(function (unAssigned) {

        unAssigned.forEach(function (job) {
          _this.__assignJob(jobType, job.kue, job.ctx, job.done);
          reAssigned.push(job.kue.id);
        });

        //[end:{"key":"reAssignJobs", "self":"_this"}:end]
        return resolve(reAssigned);
      })
      .catch(function (e) {
        //[end:{"key":"reAssignJobs", "self":"_this", "error":"e"}:end]
        reject(e);
      });
  });
}

function __serializeJob(job) {

  var toSerialize = job["kue"] != null ? job["kue"] : job;

  //[start:{"key":"__serializeJob"}:start]

  var serialized = {
    id: toSerialize.id,
    workerId: toSerialize.data.workerId,
    state: toSerialize.data.state,
    step: toSerialize.data.step,
    progress: toSerialize.data.progress,
    batchId: toSerialize.data.batchId,
    jobType: toSerialize.data.jobType,
    data: toSerialize.data.data
  };

  //[end:{"key":"__serializeJob"}:end]

  return serialized;
};

//assigns the job to the least busy worker, so when the worker "pops" the job it gets the job
function __assignJob(jobType, kue, ctx, done) {

  //[start:{"key":"__assignJob"}:start]

  if (this.__assignedJobs[jobType] == null) this.__assignedJobs[jobType] = [];
  //load balance
  var assigned = {
    kue: kue,
    ctx: ctx,
    done: done,
    workerId: this.getLeastBusyWorker(jobType),
    state: this.JOB_STATE.ASSIGNED
  };

  this.__assignedJobs[jobType].push(assigned);

  this.__updateStateMetric(this.JOB_STATE.PENDING, jobType, -1);

  this.__updateStateMetric(this.JOB_STATE.ASSIGNED, jobType, 1);

  //[end:{"key":"__assignJob"}:end]
}

function __cleanupJobDB(id, jobErr, $happn) {

  var _this = this;

  //[start:{"key":"__cleanupJobDB", "self":"_this"}:start]

  kue.Job.get(id, function (err, job) {

    if (err) {
      _this.emit('cleanup-error', {jobId: id, error: err.toString()}, $happn);
      //[end:{"key":"__cleanupJobDB", "self":"_this"}:end]
    }
    else if (jobErr) {
      //failed jobs are not deleted, we simply emit a failed job event
      _this.emit('job-error', {jobId: id, error: jobErr.toString()}, $happn);
      //[end:{"key":"__cleanupJobDB", "self":"_this", "error":"jobErr"}:end]
    } else job.remove(function (removeErr) {

      if (removeErr) _this.emit('job-cleanup-remove-error', {jobId: id, error: removeErr.toString()}, $happn);

      else _this.emit('job-cleanup-remove-ok', {jobId: id}, $happn);

      //[end:{"key":"__cleanupJobDB", "self":"_this", "error":"removeErr"}:end]
    });
  });
}

function __cleanupBatchDB(id, jobErr, $happn) {

}

function __removeBusyJob(id, $happn) {

  var _this = this;

  //[start:{"key":"__removeBusyJob", "self":"_this"}:start]

  var found = null;

  _this.utilities.cloneArray(_this.__busyJobs).every(function (job, jobIndex) {

    if (job.kue.id == id) {
      found = job;
      _this.__busyJobs.splice(jobIndex, 1);
      _this.__updateWorkerBusy(job.workerId, -1, $happn);
    }

    return !found;
  });

  //[end:{"key":"__removeBusyJob", "self":"_this"}:end]

  return found;
}

module.exports = Queue;