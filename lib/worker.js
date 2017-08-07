var Promise = require('bluebird');

function Worker(){

}

Worker.prototype.initialize = function(options){

  return new Promise(function(resolve, reject){

    try{
      console.log('initializing worker component:::');
      resolve();
    }catch(e){
      reject(e);
    }
  });
};


module.exports = Worker;