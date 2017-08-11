var kue = require('kue')
  , Promise = require('bluebird')
  , uuid = require('uuid')
  , Redis = require('ioredis')
  ;

function Queue(options) {

  if (!options) throw new Error('queue must be initialized with options argument');

  if (options.jobTypes == null) throw new Error('missing options.jobTypes argument');

  if (!options.stopTimeout) options.stopTimeout = 10000;

  this.__assignedJobs = {};

  this.__busyJobs = [];

  this.__workers = {};

  this.__metrics = {};

  this.__options = options;
}

Queue.prototype.JOB_STATE = {
  PENDING: 0,
  BUSY: 1,
  COMPLETED: 2,
  FAILED: 3
};

Queue.prototype.BATCH_STATE = {
  PENDING: 0,
  BUSY: 1,
  COMPLETED: 2,
  FAILED: 3
};

/* constants end */

//TODO: add events

/* analytics */

Queue.prototype.metrics = function (callback) {

  if (!callback) return this.__metrics;
  return callback(null, this.__metrics);
};

Queue.prototype.__updateMetric = function (key, subkey, value) {

  if (!this.__metrics[key]) this.__metrics[key] = {};

  if (!this.__metrics[key][subkey]) this.__metrics[key][subkey] = 0;

  this.__metrics[key][subkey] += value;
};

/* analytics end */

/* worker management */

Queue.prototype.attach = function (options) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (!options) return reject('missing worker options argument');

    if (options.jobType == null) return reject('missing worker options.jobType argument or invalid jobType');

    var workerId = options.jobType + '_' + uuid.v4();

    if (!_this.__workers[options.jobType]) _this.__workers[options.jobType] = [];

    var worker = {id: workerId, busy: []};

    _this.__workers[options.jobType].push(worker);

    _this.reAssignJobs(options.jobType);

    _this.__updateMetric('attached', options.jobType, 1);

    resolve(workerId);
  });
};

Queue.prototype.detach = function (options) {

  var _this = this;

  return new Promise(function (resolve) {

    if (!options || !options.workerId) return reject(new Error('detach needs at least options.id argument'));

    var jobType = options.workerId.split('_')[0];

    var found = null;

    _this.__workers[jobType].every(function (worker, workerIndex) {

      if (worker.id == options.workerId) {

        found = worker;

        //remove the worker
        _this.__workers[jobType].splice(workerIndex, 1);

        if (worker.busy > 0) {
          //push jobs back into pending list as they are resume-able
          if (options.reAssign) _this.reAssignJobs(jobType, worker.id);
        }
      }

      return found == null;
    });

    if (found) {
      _this.__updateMetric('attached', jobType, -1);
      return resolve(found.id);
    }

    resolve(null);
  });
};

Queue.prototype.findWorker = function (id) {

  var _this = this;

  var jobType = id.split('_')[0];

  if (_this.__workers[jobType] == null) return null;

  var found = null;

  _this.__workers[jobType].every(function (worker) {
    if (worker.id == id) found = worker;
    return found == null;
  });

  return found;
};

Queue.prototype.__updateWorkerBusy = function (id, value) {

  var worker = this.findWorker(id);

  var jobType = id.split('_')[0];

  if (worker) {
    worker.busy += value;
    this.__updateMetric('busy', jobType, value);
  }
};

Queue.prototype.getLeastBusyWorker = function (jobType) {

  var _this = this;

  var leastBusyWorker = null;

  if (_this.__workers[jobType] == null || _this.__workers[jobType].length == 0) return null;

  _this.__workers[jobType].every(function (worker) {

    leastBusyWorker = worker;

    if (worker.busy == 0) return false;

    if (worker.busy < leastBusyWorker.busy) leastBusyWorker = worker;

    return true;
  });

  leastBusyWorker.busy++;

  return leastBusyWorker.id;
};

/* worker management end */

/* batch management */

Queue.prototype.getBatch = function (id) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.__client.get(id, function (e, batch) {

      if (e) return reject(e);

      if (!batch) return resolve(null);

      resolve(JSON.parse(batch));
    });
  });
};

Queue.prototype.createBatch = function (options) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (!options) return reject('missing batch options argument');

    if (options.size == null) options.size = 0; //batch is for an undefined amount of jobs

    if (options.jobType == null) return reject('missing batch options.jobType argument or invalid type');

    _this.__storeNewBatch(options)
      .then(resolve)
      .catch(reject);
  })
};

Queue.prototype.updateBatch = function (id, update) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    return _this.getBatch(id).then(function (batch) {

      if (!batch) return reject('no batch found');

      if (update.data)
        update.data.forEach(function (propertyKey) {
          batch.data[propertyKey] = update.data[propertyKey]
        });

      if (update.state != null) batch.state = update.state;

      if (update.completed != null) batch.completed += update.completed;

      if (batch.completed == batch.size) batch.state = _this.BATCH_STATE.COMPLETED;

      _this.__client.set(batch.id, JSON.stringify(batch), function (e) {

        if (e) return reject(e);

        resolve(batch);
      });
    });
  });
};

//updates the batch that one of its jobs is completed
Queue.prototype.__updateJobBatch = function (jobData, batch, callback) {

  var _this = this;

  //TODO: if job state is pending batch active incremented
  try {

    if (!jobData.batchId) return callback(null, jobData);

    var complete = function (batchData) {

      if (jobData.state == _this.JOB_STATE.PENDING) batchData.count++;

      if ([_this.JOB_STATE.COMPLETED, _this.JOB_STATE.FAILED].indexOf(jobData.state) > -1) batchData.processed++;

      if (!batchData.jobStates[jobData.state]) batchData.jobStates[jobData.state] = 0;

      batchData.jobStates[jobData.state]++;

      if (batchData.size > 0 && batchData.processed == batchData.size) batchData.state = _this.BATCH_STATE.COMPLETED;

      _this.__client.set(batchData.id, JSON.stringify(batchData), function (e) {
        callback(e, batchData);
      });
    };

    if (typeof batch === 'function') {

      //we need to fetch the batch first
      callback = batch;

      _this.getBatch(jobData.batchId).then(complete).catch(callback);

    } else complete(batch);

  } catch (e) {
    callback(e);
  }
};

//updates the batch that one of its jobs is completed
Queue.prototype.__validateJobBatch = function (jobData, batch) {
  //TODO: check we arent adding more jobs than there are meant to be
  if (batch.size != 0 && batch.count == batch.size) throw new Error('batch size is limited to ' + batch.size + ' jobs.');
};

Queue.prototype.__storeNewBatch = function (options) {

  var _this = this;

  return new Promise(function (resolve) {

    var batch = {data: options.data ? options.data : null, timestamp: Date.now()};

    var prefix = _this.__options.kue.prefix ? _this.__options.kue.prefix : '';

    batch.id = options.jobType + '_' + prefix + '_' + uuid.v4();

    batch.state = _this.BATCH_STATE.PENDING;

    batch.processed = 0;

    batch.size = options.size;

    batch.jobStates = {};

    batch.jobType = options.jobType;

    _this.__client.set(batch.id, JSON.stringify(batch));

    return resolve(batch.id);
  });
};

/* batch management end */

/* job pop, assign and manage */

Queue.prototype.pop = function (options) {

  var _this = this;

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
      _this.__updateMetric('pending', jobType, -1);
      _this.__updateMetric('busy', jobType, 1);
      return resolve(_this.__serializeJob(found));
    }

    else resolve(false);
  });
};

Queue.prototype.saveNewJob = function (options, batch, resolve, reject) {

  try {

    var _this = this;

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

    var job = _this.__queue.create(options.jobType, jobData).save(function (e) {

      if (e) return reject(e);

      _this.__updateMetric('pending', options.jobType, 1);

      if (!jobData.batchId) {

        _this.__updateJobBatch(job.data, batch, function (e) {

          if (e) return reject(e);

          resolve(_this.__serializeJob(job));
        });

      } else resolve(_this.__serializeJob(job));
    });

  } catch (e) {
    reject(e);
  }
};

Queue.prototype.createJob = function (options) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (options.jobType == null) return reject(new Error('options.jobType argument missing'));

    if (!options.batchId) {

      return _this.getBatch(options.batchId).then(function (batch) {

        _this.saveNewJob(options, batch, resolve, reject);
      });
    }

    _this.saveNewJob(options, null, resolve, reject);
  });
};

Queue.prototype.updateJob = function (updated) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    var busyJob = _this.getBusyJob(updated.id);

    var timestamp = Date.now();

    if (!busyJob) return reject(new Error('job with id: ' + updated.id + ' is not busy or does not exist'));

    if (updated.progress != null) busyJob.kue.data.progress = updated.progress;

    if (updated.state != null) busyJob.kue.data.state = updated.state;

    if (updated.step != null) busyJob.kue.data.step = updated.step;

    if (updated.log)  busyJob.kue.log('job: ' + '  ' + updated.id + '  ' + timestamp.toString(), updated.log);

    if (updated.state == _this.JOB_STATE.COMPLETED) {

      busyJob.kue.data.progress = 100;
      _this.__removeBusyJob(busyJob.kue.id);
      busyJob.done();
    }
    else if (updated.state == _this.JOB_STATE.FAILED) {

      _this.__removeBusyJob(busyJob.kue.id);
      busyJob.done(updated.error);
    }
    else {
      busyJob.kue.progress(updated.progress, 100, updated);
    }

    return resolve(_this.__serializeJob(busyJob));
  });
};

Queue.prototype.getBusyJob = function (id) {

  var _this = this;

  var found = null;

  _this.__busyJobs.every(function (job) {

    if (job.kue.id == id) found = job;

    return !found;
  });

  return found;
};

//if we have a bunch of jobs that have no __workers assigned to them or are assigned to a worker that has been de-registered,
// reconfigure them to point to new worker/s
Queue.prototype.reAssignJobs = function (jobType, workerId) {

  var _this = this;

  if (_this.__assignedJobs[jobType] != null) {
    _this.__assignedJobs[jobType].reverse().forEach(function (job, jobIndex) {

      if ((!workerId || !job.workerId || job.workerId == workerId)) {
        _this.__assignedJobs.splice(jobIndex, 1);//take it out and reassign to another worker
        _this.__assignJob(jobType, job.kue, job.ctx, job.done);
      }
    });
  }

  //also check busy jobs
  if (workerId) {

    _this.__busyJobs.reverse().forEach(function (job, jobIndex) {

      if (job.workerId == workerId) {

        _this.__busyJobs.splice(jobIndex, 1);//take it out of busy and reassign to another worker
        _this.__assignJob(jobType, job.kue, job.ctx, job.done);
      }
    });
  }
};

Queue.prototype.__serializeJob = function (job) {

  var toSerialize = job["kue"] != null ? job["kue"] : job;

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

  return serialized;
};

//assigns the job to the least busy worker, so when the worker "pops" the job it gets the job
Queue.prototype.__assignJob = function (jobType, kue, ctx, done) {

  if (this.__assignedJobs[jobType] == null) this.__assignedJobs[jobType] = [];
  //load balance
  var assigned = {
    kue: kue,
    ctx: ctx,
    done: done,
    workerId: this.getLeastBusyWorker(jobType),
    state: this.JOB_STATE.PENDING
  };

  this.__assignedJobs[jobType].push(assigned);
};

Queue.prototype.__cleanupJobDB = function (id, error) {

};

Queue.prototype.__removeBusyJob = function (id) {

  var _this = this;

  var found = null;

  _this.__busyJobs.reverse().every(function (job, jobIndex) {

    if (job.kue.id == id) {
      found = job;
      _this.__busyJobs.splice(jobIndex, 1);
      _this.__updateWorkerBusy(job.workerId, -1);
    }

    return !found;
  });

  return found;
};

/* job pop, assign and manage end */

/* start and stop */

Queue.prototype.initialize = function () {

  var _this = this;

  return new Promise(function (resolve, reject) {

    require('events').EventEmitter.prototype._maxListeners = 1000;

    if (_this.__options.redis == null) _this.__options.redis = {};

    if (!_this.__options.concurrency) _this.__options.concurrency = {};

    if (_this.__options.kue == null) _this.__options.kue = {};

    _this.__connect(function (e) {
      if (e) return reject(e);
      resolve();
    });
  });
};

Queue.prototype.listen = function (callback) {

  var _this = this;

  Object.keys(_this.__options.jobTypes).forEach(function (jobTypeKey) {

    var jobType = _this.__options.jobTypes[jobTypeKey];

    if (jobType.concurrency == null)  jobType.concurrency = 10;

    _this.__queue
      .process(jobTypeKey, jobType.concurrency, function (job, ctx, done) {

        var jobDone = function () {
          _this.__updateJobBatch(job.data, this.jobDone);
        }.bind({job: job.data, jobDone: done});

        _this.__assignJob(job.data.jobType, job, ctx, jobDone);
      });
  });

  _this.__queue.on('job complete', function (id) {
    _this.__cleanupJobDB(id);
  });

  _this.__queue.on('failed', function (id, e) {
    _this.__cleanupJobDB(id, e);
  });

  callback();
};

Queue.prototype.stop = function ($happn, callback) {

  var _this = this;

  if (!_this.__queue) return callback();

  async.eachSeries(Object.keys(_this.__options.jobTypes), function(jobType, jobTypeCB){

    _this.__queue.shutdown(_this.__options.stopTimeout, jobType, jobTypeCB);

  }, callback);
};

Queue.prototype.__connect = function (callback) {

  var _this = this;

  if (Array.isArray(_this.__options.redis)) {

    _this.__client = new Redis.Cluster(_this.__options.redis);

    options.kue.redis = {
      createClientFactory: function () {
        return new Redis.Cluster(_this.__options.redis);
      }
    };

  } else {

    _this.__client = new Redis(_this.__options.redis);

    _this.__options.kue.redis = {
      createClientFactory: function () {
        return new Redis(_this.__options.redis);
      }
    };
  }

  _this.__queue = kue.createQueue(_this.__options.kue);

  if (_this.__options.deferListen) return callback();

  _this.listen(callback);
};

/* start and stop end */

module.exports = Queue;