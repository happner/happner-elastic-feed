var kue = require('kue')
  , queue = kue.createQueue()
  , Promise = require('bluebird')
  , redis = require("redis")
  , uuid = require('uuid')
;

function Queue(){

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

Queue.prototype.detach = function(id, requeueJobs){

  var _this = this;

  return new Promise(function(resolve){

    var type = parseInt(id.split('_')[0]);

    var found = null;

    _this.workers[type].every(function(worker, workerIndex){

      if (worker.id == id){

        found = worker;

        //remove the worker
        _this.workers[type].splice(workerIndex, 1);

        if (worker.busy.length > 0) {
          console.warn('de-registering worker with active jobs');

          //push jobs back into pending list as they are resume-able
          if (requeueJobs) _this.reAssignJobs(type, worker.id);
        }
      }

      return found != null;
    });

    if (found)  {
      _this.updateMetric('attached', type, -1);
      return resolve(found.id);
    }

    resolve(null);
  });
};

Queue.prototype.serializeJob = function(job){

  console.log('serializing:::', JSON.stringify(job, null, 2));

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

  console.log('serialized:::', JSON.stringify(serialized, null, 2));

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

  if (worker) worker.busy += value;
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

        found.state = _this.JOB_STATE.BUSY;

        if (!_this.busyJobs[type]) _this.busyJobs[type] = [];

        _this.busyJobs[type].push(job);

        _this.assignedJobs[type].splice(jobIndex, 1);

        //_this.updateWorkerBusy(job.workerId);
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

  var batch = {data:options.data?options.data:null, timestamp:Date.now()};

  batch.id = options.type + '_' + uuid.v4();

  batch.state = _this.BATCH_STATE.PENDING;

  return new Promise(function(resolve, reject){

    _this.__client.set(batch.id, JSON.stringify(batch), function(e){

      if (e) return reject(e);

      resolve(batch.id);
    });
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

Queue.prototype.getBusyJob = function(type, id){

  var _this = this;

  var found = null;

  _this.busyJobs[type].every(function(job){

    if (job.kue.id == id) found = job;

    return !found;
  });

  return found;
};

Queue.prototype.updateJob = function(updated){

  var _this = this;

  return new Promise(function(resolve, reject){

    var busyJob = _this.getBusyJob(updated.type, updated.id);

    var timestamp = Date.now();

    if (!busyJob) return reject(new Error('job with id: ' +  updated.id + ' is not busy or does not exist'));

    if (updated.progress) busyJob.progress = updated.progress;

    if (updated.state) busyJob.state = updated.state;

    if (updated.step) busyJob.step = updated.step;

    if (updated.log)  busyJob.kue.log('job: ' + '  ' + id + '  ' + timestamp.toString(), updated.log);

    if (updated.state == _this.JOB_STATE.COMPLETED){

      busyJob.done(function(e){

        if (e) return reject(e);

        _this.updateWorkerBusy(busyJob.workerId, -1);

        return resolve(_this.serializeJob(busyJob));
      })
    } else {

      busyJob.kue.progress(busyJob.progress, 100, updated);
    }
  });
};

//if we have a bunch of jobs that have no workers assigned to them or are assigned to a worker that has been de-registered,
// reconfigure them to point to new worker/s
Queue.prototype.reAssignJobs = function(jobType, workerId){

  var _this = this;

  if (_this.assignedJobs[jobType] != null)
  {
    _this.assignedJobs[jobType].reverse().forEach(function(job, jobIndex){

      if ((job.workerId == workerId) || !job.workerId){
        _this.assignedJobs.splice(jobIndex,1);//take it out and reassign to another worker
        _this.assignJob(jobType, job.data, job.ctx, job.complete);
      }
    });
  }

  //also check busy jobs
  if (workerId && _this.busyJobs[jobType] != null){

    _this.busyJobs[jobType].reverse().forEach(function(job, jobIndex){

      if (job.workerId == workerId){

        _this.busyJobs.splice(jobIndex,1);//take it out of busy and reassign to another worker
        _this.assignJob(jobType, job.data, job.ctx, job.complete);
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

  if (!this.assignedJobs[jobType]) this.assignedJobs[jobType] = [];
  //load balance
  this.assignedJobs[jobType].push({kue:kue, ctx:ctx, done:done, workerId: this.getLeastBusyWorker(jobType), state:this.JOB_STATE.PENDING});
};

Queue.prototype.listen = function(){

  var _this = this;

  Object.keys(_this.JOB_TYPE).forEach(function(jobType){

    _this.__queue
      .process(_this.JOB_TYPE[jobType], _this.options.concurrency[jobType], function(job, ctx, done){

        _this.assignJob(job.type, job, ctx, done);
      });
  });
};

Queue.prototype.initialize = function(options){

  var _this = this;

  return new Promise(function(resolve, reject){

    try{

      _this.__metrics = {};

      if (!options) options = {};

      if (!options.subscriber) options.subscriber = {prefix:'subscriber'};

      if (!options.emitter) options.emitter = {prefix:'emitter'};

      if (!options.system) options.system = {prefix:'system'};

      if (!options.concurrency) options.concurrency = {};

      if (!options.kue) options.kue = {};

      Object.keys(_this.JOB_TYPE).forEach(function(jobType){

        if (!options.concurrency[jobType]) options.concurrency[jobType] = 10;
      });

      Object.defineProperty(_this, 'options', {value:options});

      Object.defineProperty(_this, 'assignedJobs', {value:{}});

      Object.defineProperty(_this, 'busyJobs', {value:{}});

      Object.defineProperty(_this, 'analytics', {value:{completed:{}, busy:{}, failed:{}}});

      Object.defineProperty(_this, 'workers', {value:{}});

      _this.__client = redis.createClient(options);

      _this.__queue = kue.createQueue(options.kue);

      _this.listen();

      resolve();

    }catch(e){
      reject(e);
    }
  });
};

Queue.prototype.stop = function(callback){

  var _this = this;

  _this.__subscriberQueue.shutdown(2000, function(e) {
    if (e) console.warn('subscriber queue didn\'t shut down properly');
    _this.__emitterQueue.shutdown(2000, function(e) {
      if (e) console.warn('emitter queue didn\'t shut down properly');
      _this.__systemQueue.shutdown(2000, function(e) {
        if (e) console.warn('system queue didn\'t shut down properly');
        callback();
      });
    });
  });
};

module.exports = Queue;