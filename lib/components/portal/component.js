var Promise = require('bluebird'),
  ServeStatic = require('serve-static')
;

function Portal(){

}

Portal.prototype.initialize = function(options){

  return new Promise(function(resolve, reject){

    try{
      resolve();
    }catch(e){
      reject(e);
    }
  });
};

Portal.prototype.feed = function (req, res, next) {
  next();
};

Portal.prototype.admin = function (req, res, next) {
  next();
};

module.exports = Portal;