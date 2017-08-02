var Promise = require('bluebird');
var uuid = require('uuid');
var utilities = require('./utilities');
var happn = require('happn-3');
var PareTree = require('wild-pare');

function Feed(){

}

Feed.prototype.initialize = function(config){

  var _this = this;

  return new Promise(function(resolve, reject){

    try{
      console.log('initializing feed component:::');
      resolve();
    }catch(e){
      reject(e);
    }
  });

  // return new Promise(function(resolve, reject){
  //
  //   Object.defineProperty(_this, '__config', {value:config});
  //
  //   if (!_this.__config.source && !_this.__config.destination) return reject('a source or destination configuration must be passed in');
  //
  //   if (!_this.__config.source) _this.__config.source = {
  //     port:55000,
  //     secure:true
  //   };
  //
  //   if (!_this.__config.destination) _this.__config.destination = {
  //     port:55000,
  //     secure:true
  //   };
  //
  //   happn.client.create(_this.__config.source)
  //     .then(function(sourceData){
  //
  //       _this.__sourceData = sourceData;
  //
  //       return happn.client.create(_this.__config.destination);
  //     })
  //     .then(function(destData){
  //
  //       _this.__destData = destData;
  //
  //       return _this.__attachToDestFeeds();
  //     })
  //     .then(function(destFeedsTree){
  //
  //       _this.__destFeeds = destFeedsTree;
  //
  //       return _this.__attachToSourceSecurity();
  //     })
  //     .catch(reject);
  // });
};

Feed.prototype.create = function(options, $happn){

  return new Promise(function(resolve, reject){

  });
};

Feed.prototype.delete = function(options, $happn){

  return new Promise(function(resolve, reject){

  });
};

Feed.prototype.list = function(options, $happn){

  var _this = this;

  return new Promise(function(resolve, reject){

    var path = '/_system/feeds/*';

    if (options.username) path = '/_system/feeds/' + options.username + '/*';

    if (options.username && options.type) path = '/_system/feeds/' + options.username + '/' +  options.type+ '/*';

    if (!options.username && options.type) path = '/_system/feeds/*/' +  options.type+ '/*';

    _this.__destData.get(path, function(e, feeds){

      if (e) return reject(e);

      resolve(feeds);
    });
  });
};

Feed.prototype.pause = function(options, $happn){

  var _this = this;

  return new Promise(function(resolve, reject){

  });
};

Feed.prototype.resume = function(options, $happn){

  var _this = this;

  return new Promise(function(resolve, reject){

  });
};

Feed.prototype.fatalError = function(message){

};

var __sourceSecurityMatrix = null;

Feed.prototype.__updateToSourceSecurity = function(data, meta){

  var _this = this;

  _this.__sourceData.get('/_SYSTEM/_SECURITY/*', function (e, items) {

    if (e) return _this.fatalError('failed to update security matrix, shutting down');

    __sourceSecurityMatrix = items;
  });
};

Feed.prototype.__attachToDestFeeds = function(){

  //creates our pare tree

  return new Promise(function(resolve, reject) {

    var pareTree = new PareTree();

    resolve(pareTree);
  });
};

Feed.prototype.__attachToSourceSecurity = function(){

  var _this = this;

  return new Promise(function(resolve, reject) {

    _this.__sourceData.get('/_SYSTEM/_SECURITY/*', function (e, items) {

      _this.__sourceSecurityMatrix = items;

      _this.__sourceData.on('/_SYSTEM/_SECURITY/*', _this.__updateToSourceSecurity.bind(_this))
    });
  });
};


Feed.prototype.__getNewFeedConfig = function(options){

  var _this = this;

  return new Promise(function(resolve, reject){

    if (!options.username) return reject('a user name must be passed in for the feed');

    if (!options.type) options.type = utilities.randomId();

    if (!options.dashboard) options.dashboard = _this.__config.defaultDashboard;

    _this.list({username:options.username, type:options.type})

      .then(function(existing){

        if (existing.length > 0) return reject('a feed by the name ' + options.username + '_' + options.type + ' already exists');

        options.feedName =  options.username + '_' + options.type;
        resolve(options);
      })
      .catch(reject);
  });
};

module.exports = Feed;