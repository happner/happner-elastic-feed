var Promise = require('bluebird');

function Service(){

}

Service.prototype.initialize = function(options){

  return new Promise(function(resolve, reject){

    try{
      console.log('initializing service component:::');
      resolve();
    }catch(e){
      reject(e);
    }
  });
};

module.exports = Service;