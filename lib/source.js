var Promise = require('bluebird');

function Source(){

}

Source.prototype.initialize = function(options){

  return new Promise(function(resolve, reject){

    try{
      console.log('initializing source component:::');
      resolve();
    }catch(e){
      reject(e);
    }
  });
};


module.exports = Source;