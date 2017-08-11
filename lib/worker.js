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

Worker.prototype.__emitJob = function($happn, job, jobType){
  $happn.emit(jobType, job);
};

Worker.prototype.__emitJobError = function($happn, e, jobType){
  $happn.emit(jobType + '-error', e.toString());
};

Worker.prototype.__attach = function($happn, callback){

  var _this = this;

  async.eachSeries(_this.__options.queue.jobTypes,

    function(jobType, jobTypeCB){

      try{

        $happn
          .exchange[_this.__options.queue.name].queue
          .attach({jobType:jobType})
          .then(function(workerId){

            _this.__workerEvents[workerId] = setInterval(function(){

              $happn.exchange[_this.__options.queue.name].queue.pop(this)
                .then(function(job){
                  if (!job) return;
                  $happn.emit(this.jobType, job);
                }.bind(this))
                .catch(function(e){
                  $happn.emit(this.jobType + '-error', e.toString());
                }.bind(this))
            }.bind({jobType:jobType, workerId:workerId}), _this.__options.interval);
            //binding on the setInterval so the correct workerId is used
          })
          .then(jobTypeCB)
          .catch(jobTypeCB);
      }catch(e){
        jobTypeCB(e);
      }
    }, callback);
};

Worker.prototype.initialize = function ($happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.__attach($happn, function(e){
      if (e) return reject(e);
      resolve();
    });
  });
};

Worker.prototype.stop =  function ($happn, callback) {

  var _this = this;

  async.eachSeries(Object.keys(_this.__workerEvents),

    function(workerId, jobTypeCB){

      $happn
        .exchange[_this.__options.queue.name].queue
        .detach({workerId:workerId})
        .then(function(workerId){
          clearInterval(_this.__workerEvents[workerId]);
          jobTypeCB();
        })
        .catch(jobTypeCB);

    }, callback);
};


module.exports = Worker;