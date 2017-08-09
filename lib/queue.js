var kue = require('kue')
  , Promise = require('bluebird')
  , uuid = require('uuid')
  , Redis = require('ioredis')
;

function Queue(){

  Object.defineProperty(this, 'assignedJobs', {value:{}});

  Object.defineProperty(this, 'busyJobs', {value:[]});

  Object.defineProperty(this, 'workers', {value:{}});

  Object.defineProperty(this, '__metrics', {value:{}});
}

Queue.prototype.JOB_TYPE = {
  SUBSCRIBER:0,
  EMITTER:1,
  SYSTEM:2
};

Queue.prototype.JOB_STATE = {
  PENDING:0,
  BUSY:1,
  COMPLETED:2,
  FAILED:3
};

Queue.prototype.BATCH_STATE = {
  PENDING:0,
  BUSY:1,
  COMPLETED:2,
  FAILED:3
};

Queue.prototype.metrics = function(){

  return this.__metrics;
};

Queue.prototype.updateMetric = function(key, subkey, value){

  if (!this.__metrics[key]) this.__metrics[key] = {};

  if (!this.__metrics[key][subkey]) this.__metrics[key][subkey] = 0;

  this.__metrics[key][subkey] += value;
};

Queue.prototype.attach = function(options){

  var _this = this;

  return new Promise(function(resolve, reject){

    if (!options) return reject('missing worker options argument');

    if (options.type == null || options.type < 0 || options.type > 2) return reject('missing worker options.type argument or invalid type');

    var workerId = options.type + '_' + uuid.v4();

    if (!_this.workers[options.type]) _this.workers[options.type] = [];

    var worker = {id:workerId, busy:[]};

    _this.workers[options.type].push(worker);

    _this.reAssignJobs(options.type);

    _this.updateMetric('attached', options.type, 1);

    resolve(workerId);
  });
};

Queue.prototype.detach = function(options){

  var _this = this;

  return new Promise(function(resolve){

    if (!options || !options.id) return reject(new Error('detach needs at least options.id argument'));

    var type = parseInt(options.id.split('_')[0]);

    var found = null;

    _this.workers[type].every(function(worker, workerIndex){

      if (worker.id == options.id){

        found = worker;

        //remove the worker
        _this.workers[type].splice(workerIndex, 1);

        if (worker.busy > 0) {
          //push jobs back into pending list as they are resume-able
          if (options.reAssign) _this.reAssignJobs(type, worker.id);
        }
      }

      return found == null;
    });

    if (found)  {
      _this.updateMetric('attached', type, -1);
      return resolve(found.id);
    }

    resolve(null);
  });
};

Queue.prototype.serializeJob = function(job){

  var toSerialize = job["kue"] != null?job["kue"]:job;

  var serialized = {
    id:toSerialize.id,
    workerId:toSerialize.data.workerId,
    state:toSerialize.data.state,
    step:toSerialize.data.step,
    progress:toSerialize.data.progress,
    batchId:toSerialize.data.batchId,
    type:toSerialize.data.type,
    data:toSerialize.data.data
  };

  return serialized;
};

Queue.prototype.findWorker = function(id){

  var _this = this;

  var type = parseInt(id.split('_')[0]);

  if (_this.workers[type] == null) return null;

  var found = null;

  _this.workers[type].every(function(worker, workerIndex){
    if (worker.id == id) found = worker;
    return found == null;
  });

  return found;
};

Queue.prototype.updateWorkerBusy = function(id, value){

  var worker = this.findWorker(id);

  var type = parseInt(id.split('_')[0]);

  if (worker) {
    worker.busy += value;
    this.updateMetric('busy', type, value);
  }
};

Queue.prototype.pop = function(options){

  var _this = this;

  return new Promise(function(resolve, reject){

    if (!options.workerId) return reject('missing workerId argument');

    var type = parseInt(options.workerId.split('_')[0]);

    var found = null;

    if (_this.assignedJobs[type] == null) return resolve(false);

    _this.assignedJobs[type].every(function(job, jobIndex){

      if (job.workerId == options.workerId) {

        found = job;

        found.kue.data.state = _this.JOB_STATE.BUSY;

        _this.busyJobs.push(job);

        _this.assignedJobs[type].splice(jobIndex, 1);
      }
      return found == null;
    });

    if (found) {
      _this.updateMetric('pending', type, -1);
      _this.updateMetric('busy', type, 1);
      return resolve(_this.serializeJob(found));
    }

    else resolve(false);
  });
};

Queue.prototype.createBatch = function(options){

  var _this = this;

  return new Promise(function(resolve, reject){

    if (!options) return reject('missing batch options argument');

    if (!options.count) return reject('batch must have a job count');

    if (options.type == null || options.type < 0 || options.type > 2) return reject('missing batch options.type argument or invalid type');

    _this.storeBatch(options)
      .then(resolve)
      .catch(reject);
  })
};

Queue.prototype.storeBatch = function(options){

  var _this = this;

  return new Promise(function(resolve){

    var batch = {data:options.data?options.data:null, timestamp:Date.now()};

    var prefix = _this.options.kue.prefix?_this.options.kue.prefix:'';

    batch.id = options.type + '_' + prefix + '_' + uuid.v4();

    batch.state = _this.BATCH_STATE.PENDING;

    _this.__client.set(batch.id, JSON.stringify(batch));

    return resolve(batch.id);
  });
};

Queue.prototype.getBatch = function(id){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.__client.get(id, function(e, batch){

      if (e) return reject(e);

      if (!batch) return resolve(null);

      resolve(JSON.parse(batch));
    });
  });
};

Queue.prototype.updateBatch = function(id, update){

  var _this = this;

  return new Promise(function(resolve, reject){

    return _this.getBatch(id).then(function(batch){

      if (!batch) return reject('no batch found');

      if (update.data)
        update.data.forEach(function(propertyKey){
          batch.data[propertyKey] = update.data[propertyKey]
        });

      if (update.state != null) batch.state = update.state;

      if (update.completed != null) batch.completed += update.completed;

      if (batch.completed == batch.count) batch.state = _this.BATCH_STATE.COMPLETED;

      _this.__client.set(batch.id, JSON.stringify(batch), function(e){

        if (e) return reject(e);

        resolve(batch);
      });
    });
  });
};

Queue.prototype.createJob = function(options){

  var _this = this;

  return new Promise(function(resolve, reject){

    if (!options.batchId) return reject(new Error('batchId argument missing'));

    if (options.type == null) return reject(new Error('job type argument missing'));

    var jobId = options.type + '_' + uuid.v4();

    var job = _this.__queue.create(options.type, {
      batchId: options.batchId,
      data: options.data,
      type: options.type,
      queueId: jobId,
      state: _this.JOB_STATE.PENDING,
      progress:0,
      step:""
    }).save( function(e){
      if (e) return reject(e);
      _this.updateMetric('pending', options.type, 1);
      resolve(_this.serializeJob(job));
    });
  });
};

Queue.prototype.getBusyJob = function(id){

  var _this = this;

  var found = null;

  _this.busyJobs.every(function(job){

    if (job.kue.id == id) found = job;

    return !found;
  });

  return found;
};

Queue.prototype.updateJob = function(updated){

  var _this = this;

  return new Promise(function(resolve, reject){

    var busyJob = _this.getBusyJob(updated.id);

    var timestamp = Date.now();

    if (!busyJob) return reject(new Error('job with id: ' +  updated.id + ' is not busy or does not exist'));

    if (updated.progress != null) busyJob.kue.data.progress = updated.progress;

    if (updated.state != null) busyJob.kue.data.state = updated.state;

    if (updated.step != null) busyJob.kue.data.step = updated.step;

    if (updated.log)  busyJob.kue.log('job: ' + '  ' + updated.id + '  ' + timestamp.toString(), updated.log);

    if (updated.state == _this.JOB_STATE.COMPLETED){

      busyJob.kue.data.progress = 100;
      _this.removeBusyJob(busyJob.kue.id);
      busyJob.done();
    }
    else if (updated.state == _this.JOB_STATE.FAILED){

      _this.removeBusyJob(busyJob.kue.id);
      busyJob.done(updated.error);
    }
    else {
      busyJob.kue.progress(updated.progress, 100, updated);
    }

    return resolve(_this.serializeJob(busyJob));
  });
};

//if we have a bunch of jobs that have no workers assigned to them or are assigned to a worker that has been de-registered,
// reconfigure them to point to new worker/s
Queue.prototype.reAssignJobs = function(jobType, workerId){

  var _this = this;

  if (_this.assignedJobs[jobType] != null)
  {
    _this.assignedJobs[jobType].reverse().forEach(function(job, jobIndex){

      if ((!workerId || !job.workerId || job.workerId == workerId)){
        _this.assignedJobs.splice(jobIndex,1);//take it out and reassign to another worker
        _this.assignJob(jobType, job.kue, job.ctx, job.done);
      }
    });
  }

  //also check busy jobs
  if (workerId){

    _this.busyJobs.reverse().forEach(function(job, jobIndex){

      if (job.workerId == workerId){

        _this.busyJobs.splice(jobIndex, 1);//take it out of busy and reassign to another worker
        _this.assignJob(jobType, job.kue, job.ctx, job.done);
      }
    });
  }
};

Queue.prototype.getLeastBusyWorker = function(jobType){

  var _this = this;

  var leastBusyWorker = null;

  if (_this.workers[jobType] == null || _this.workers[jobType].length == 0) return null;

  _this.workers[jobType].every(function(worker){

    leastBusyWorker = worker;

    if (worker.busy == 0) return false;

    if (worker.busy < leastBusyWorker.busy) leastBusyWorker = worker;

    return true;
  });

  leastBusyWorker.busy++;

  return leastBusyWorker.id;
};

//assigns the job to the least busy worker, so when the worker "pops" the job it gets the job
Queue.prototype.assignJob = function(jobType, kue, ctx, done){

  if (this.assignedJobs[jobType] == null) this.assignedJobs[jobType] = [];
  //load balance
  var assigned = {kue:kue, ctx:ctx, done:done, workerId: this.getLeastBusyWorker(jobType), state:this.JOB_STATE.PENDING};

  this.assignedJobs[jobType].push(assigned);
};

Queue.prototype.cleanupJobDB = function(id, error){

};

Queue.prototype.removeBusyJob = function(id){

  var _this = this;

  var found = null;

  _this.busyJobs.reverse().every(function(job, jobIndex){

    if (job.kue.id == id){
      found = job;
      _this.busyJobs.splice(jobIndex, 1);
      _this.updateWorkerBusy(job.workerId, -1);
    }

    return !found;
  });

  return found;
};

Queue.prototype.listen = function(){

  var _this = this;

  Object.keys(_this.JOB_TYPE).forEach(function(jobType){

    _this.__queue
      .process(_this.JOB_TYPE[jobType], _this.options.concurrency[jobType], function(job, ctx, done){
        _this.assignJob(job.data.type, job, ctx, done);
      });
  });

  _this.__queue.on('job complete', function(id){
    _this.cleanupJobDB(id);
  });

  _this.__queue.on('failed', function(id, e){
    _this.cleanupJobDB(id, e);
  });
};

Queue.prototype.initialize = function(options){

  var _this = this;

  var initializeError = null;

  try{

    require('events').EventEmitter.prototype._maxListeners = 1000;

    if (!options) options = {};

    if (options.redis == null) options.redis = {};

    if (!options.concurrency) options.concurrency = {};

    if (options.kue == null) options.kue = {};

    Object.keys(_this.JOB_TYPE).forEach(function(jobType){

      if (!options.concurrency[jobType]) options.concurrency[jobType] = 10;
    });

    Object.defineProperty(_this, 'options', {value:options});

    _this.connect(options);

  }catch(e){
    initializeError = e;
  }

  return new Promise(function(resolve, reject){
    if (initializeError) return reject(initializeError);
    else return resolve();
  })
};

Queue.prototype.connect = function(options){

  var _this = this;

  if (Array.isArray(options.redis)){

    _this.__client = new Redis.Cluster(options.redis);

    options.kue.redis = {
      createClientFactory: function () {
        return new Redis.Cluster(options.redis);
      }
    };

  } else {

    _this.__client = new Redis(options.redis);

    options.kue.redis = {
      createClientFactory: function () {
        return new Redis(options.redis);
      }
    };
  }

  _this.__queue = kue.createQueue(options.kue);

  _this.listen();
};

Queue.prototype.stop = function(callback){

  var _this = this;

  _this.__queue.shutdown(2000, function(e) {
    if (e) console.warn('subscriber queue didn\'t shut down properly');
      callback();
    });
};

module.exports = Queue;