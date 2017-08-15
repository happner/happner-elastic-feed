var Promise = require('bluebird');
var uuid = require('uuid');
var utilities = require('./utilities');
var happn = require('happn-3');
var PareTree = require('wild-pare');
var sift = require('sift');
var uuid = require('uuid');
var Crypto = require('happn-util-crypto');
var crypto = new Crypto();

function Feed(options) {

  if (!options.output_secret) throw new Error('output_secret option missing for feed output obfuscation');
  this.__options = options;
}

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

Feed.prototype.validate = function (options, $happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (options.action == null) {

      if (options.id) options.action = 'update';

      options.action = 'create';
    }

    if (options.action == 'create') {

      if (options.name == null) return reject(new Error('options.name argument missing'));
      if (options.groupName == null || options.group) return reject(new Error('options.groupName argument missing'));
      if (options.dashBoards == null) return reject(new Error('options.dashBoards argument missing'));
      if (options.dataPaths == null) return reject(new Error('options.dataPaths argument missing'));

      if (options.description == null) options.description = '';

      _this.findByName(options.name, $happn)

        .then(function (existing) {

          if (existing) return reject(new Error('feed with name ' + options.name + ' already exists'));

          if (options.groupName) return _this.__ensureGroup(options.groupName, options.dataPaths);

          if (options.group && options.group._meta && options.group._meta.path) return _this.__updateGroup(options.group, options.dataPaths);

          if (options.group) return _this.__createGroup(options.group, options.dataPaths);

          return _this.__createGroup(options);
        })
        .then(function (group) {
          options.group = group;
          resolve(options);
        })
        .catch(reject);

    } else if (options.action == 'update') {

      if (options.id == null) return reject(new Error('options.id argument missing'));

      _this.findById(options.id, $happn)

        .then(function (existing) {

          if (!existing) return reject(new Error('feed with id ' + options.id + ' does not exist'));

          return new Promise(function(resolveGroup, rejectGroup){

            if (options.groupName) return _this.__ensureGroup(options.groupName, options.dataPaths).then(function(group){
              existing.group = group;
              resolveGroup(existing);
            }).catch(rejectGroup);

            if (options.group && options.group._meta && options.group._meta.path) return _this.__updateGroup(options.group, options.dataPaths).then(function(group){
              existing.group = group;
              resolveGroup(existing);
            }).catch(rejectGroup);

            if (options.group) return _this.__createGroup(options.group, options.dataPaths).then(function(group){
              existing.group = group;
              resolveGroup(existing);
            }).catch(rejectGroup);

            resolveGroup(existing);
          });
        })
        .then(function (existing) {

          resolve(existing);
        })
        .catch(reject);
    }
  });
};

Feed.prototype.findByName = function (name, $happn) {

  return this.list({criteria: {$eq: {name: name}}}, $happn);
};

Feed.prototype.__ensureGroup = function (options, $happn) {

  return new Promise(function (resolve, reject) {

    $happn._mesh.exchange.security.listGroups($happn, options.groupName)
      .then(function (group) {

        if (group == null) return reject('feed group with name: ' + options.groupName + ', does not exist.');
        resolve(group);
      })
      .catch(reject);
  });

};

Feed.prototype.__updateGroupPermissions = function(options, group) {

  group.permissions = {events:{}, methods:{}};

  var eventsBasePath = "/" + $happn._mesh.config.name + "/feed/";

  options.dataPaths.forEach(function (dataPath) {

    var basePath = eventsBasePath;

    if (dataPath.substring(0, 1) == '/') basePath = basePath.substring(1);

    group.permissions.events[basePath + dataPath] = {authorized: true};
  });

  group.permissions.methods[eventsBasePath + 'view'] = {authorized: true};
};

Feed.prototype.__updateGroup = function (options, $happn) {

  this.__updateGroupPermissions(options);

  return new Promise(function (resolve, reject) {

    $happn._mesh.exchange.security.updateGroup($happn, options)
      .then(function (group) {
        resolve(group);
      })
      .catch(reject);
  });
};

Feed.prototype.__attachNewFeedGroup = function(options) {

  options.group = {
    name: options.groupName,
    description: options.groupDescription ? options.groupDescription : 'automated feed group',
  };

  this.__updateGroupPermissions(options);
};

Feed.prototype.__createGroup = function (options, $happn) {

  this.__attachNewFeedGroup(options);

  return $happn._mesh.exchange.security.addGroup(options.group);
};

Feed.prototype.__outputPaths = function(inputPaths){

  return inputPaths.map(function(inputPath){

    return '/happner-feed-system/data/' + crypto.createHashFromString(inputPath);
  });
};

Feed.prototype.__create = function (options, $happn) {

  var feedId = (uuid.v4() + uuid.v4()).replace(/\-/g,'');

  var feed = {
    id:feedId,
    name:options.name,
    group:options.group.name,
    dataPaths:options.dataPaths,
    outputPaths: this.__outputPaths(options.dataPaths, $happn)
  };

  return $happn._mesh.data.set(this.__getPath(feed), feed)
};

Feed.prototype.__update = function (options, $happn) {

  if (options.dataPaths)  options.outputPaths = this.__outputPaths(options.dataPaths, $happn);

};

Feed.prototype.upsert = function (options, $happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.validate(options, $happn)

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

  if (typeof $happn == 'function') {
    callback = $happn;
    $happn = null;
  }

  callback();
};

Feed.prototype.__getPath = function (options, methodName) {

  if (options == null) options = {};

  if (options.id == null) options.id = '*';

  return '/happner-feed-system/feeds/' + options.id;
};

Feed.prototype.list = function (options, $happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    $happn._mesh.data.get(_this.__getPath(options), options.criteria, function (e, feeds) {

      if (e) return reject(e);

      resolve(feeds);
    });
  });
};

module.exports = Feed;