var Promise = require('bluebird');
var uuid = require('uuid');
var utilities = require('./utilities');
var happn = require('happn-3');
var PareTree = require('wild-pare');
var sift = require('sift');

function Feed() {}

Feed.prototype.STATE = {
  PENDING: 0,
  STOPPED: 1,
  RUNNING: 2
};

Feed.prototype.initialize = function (config) {

  return new Promise(function (resolve, reject) {

    try {
      resolve();
    } catch (e) {
      reject(e);
    }
  });
};

Feed.prototype.validate = function (options) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (options.action == null){

      if (options.id) options.action = 'update';

      options.action = 'create';
    }

    if (options.action == 'create') {

      if (options.name == null) return reject(new Error('options.name argument missing'));
      if (options.groupName == null || options.group) return reject(new Error('options.groupName argument missing'));
      if (options.dashBoards == null) return reject(new Error('options.dashBoards argument missing'));

      if (options.description == null) options.description = '';

      _this.findByName(options.name)

        .then(function (existing) {

          if (existing) return reject(new Error('feed with name ' + options.name + ' already exists'));

          if (options.groupName) return _this.__ensureGroup(options.groupName);

          return _this.__createGroup(options.group);
        })
        .then(function (group) {
          options.group = group;
          resolve(options);
        })
        .catch(reject);

    } else if (options.action == 'update') {

      if (options.id == null) return reject(new Error('options.id argument missing'));

      return resolve(options);
    }
  });
};

Feed.prototype.findByName = function(){

};

Feed.prototype.__ensureGroup = function(){

};

Feed.prototype.__createGroup = function(){

};

Feed.prototype.__create = function(){

};

Feed.prototype.__update = function(){

};

Feed.prototype.upsert = function (options, $happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.validate(options)

      .then(function (validatedFeed) {

        if (options.action == 'create')
        _this.__create(validatedFeed, function (e, created) {
          if (e) return reject(e);
          return resolve(created);
        });

        if (options.action == 'update')
          _this.__update(validatedFeed, function (e, updated) {
            if (e) return reject(e);
            return resolve(updated);
          });
      })
      .catch(reject);
  });
};

Feed.prototype.stop = function ($happn, callback) {

  var _this = this;

  if (typeof $happn == 'function') {
    callback = $happn;
    $happn = null;
  }

  callback();
};

Feed.prototype.__getPath = function(options){

  if (options.groupName) return '/happner-feed-system/feeds/' + options.groupName + '/*';

  return '/happner-feed-system/feeds*';
};

Feed.prototype.list = function (options, $happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    $happn.data.get(_this.__getPath(options), options.criteria, function (e, feeds) {

      if (e) return reject(e);

      resolve(feeds);
    });
  });
};

module.exports = Feed;