var Promise = require('bluebird');
var uuid = require('uuid');
var utilities = require('../../utilities');
var happn = require('happn-3');
var sift = require('sift');
var uuid = require('uuid');

function Feed(options) {

  this.__options = options;
}

Feed.prototype.STATE = {
  PENDING: 0,
  STOPPED: 1,
  RUNNING: 2
};

/* initialize and stop */
{
  Feed.prototype.initialize = function (config, $happn) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      try {

        resolve();
      } catch (e) {
        reject(e);
      }
    });
  };

  Feed.prototype.stop = function ($happn, callback) {

    if (typeof $happn == 'function') {
      callback = $happn;
      $happn = null;
    }

    callback();
  };

}

/*upsert and validation*/
{
  Feed.prototype.__create = function (options, $happn) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      var feed = {
        id: options.id,
        name: options.name,
        groupname: options.group.name,
        datapaths: options.datapaths,
        state: options.state == null ? _this.STATE.PENDING : options.state,
        version: 1
      };

      $happn._mesh.data.set(_this.__getPath(feed), feed, function (e, created) {

        if (e) return reject(e);

        _this.emit('feed-created', created, $happn);

        resolve(created);
      });
    });
  };

  Feed.prototype.__update = function (options, $happn) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      var feed = {
        name: options.name,
        groupname: options.group.name,
        version: options.version
      };

      if (options.datapaths) feed.datapaths = options.datapaths;
      if (options.state != null) feed.state = options.state;
      if (options.group) feed.groupname = options.group.name;

      $happn._mesh.data.set(_this.__getPath(options), feed, {merge: true}, function (e, updated) {

        if (e) return reject(e);

        _this.emit('feed-updated', updated, $happn);

        resolve(updated);
      });
    });
  };

  Feed.prototype.upsert = function (options, $happn) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      _this.validate(options, $happn)

        .then(function (validatedFeed) {

          if (options.action == 'create')

            return _this.__create(validatedFeed, $happn)
              .then(resolve)
              .catch(reject);


          if (options.action == 'update')

            return _this.__update(validatedFeed, $happn)
              .then(resolve)
              .catch(reject);

          reject('undefined or bad action: ' + options.action);
        })
        .catch(reject);
    });
  };

  Feed.prototype.validate = function (options, $happn) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      if (options.action == null) {

        if (options.id) options.action = 'update';

        else options.action = 'create';
      }

      if (options.action == 'create') {

        if (options.name == null) return reject(new Error('options.name argument missing'));
        if (options.groupname == null && !options.group) options.group = {name: options.name + ' group'};
        //if (options.dashboards == null) return reject(new Error('options.dashboards argument missing'));
        if (options.datapaths == null) return reject(new Error('options.datapaths argument missing'));

        if (options.description == null) options.description = '';

        options.id = (uuid.v4() + uuid.v4()).replace(/\-/g, '');

        _this.findByName(options.name, $happn)

          .then(function (existing) {

            if (existing) return reject(new Error('feed with name ' + options.name + ' already exists'));

            if (options.groupname) return _this.__ensureGroup(options, $happn);

            if (options.group && options.group._meta && options.group._meta.path) return _this.__updateGroup(options, $happn);

            return _this.__createGroup(options, $happn);
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

            options.version = existing.version + 1;

            return new Promise(function (resolveGroup, rejectGroup) {

              if (options.groupname) return _this.__ensureGroup(options, $happn).then(function (group) {
                options.group = group;
                resolveGroup(options);
              }).catch(rejectGroup);

              if (options.group && options.group._meta && options.group._meta.path) return _this.__updateGroup(options, $happn).then(function (group) {
                options.group = group;
                resolveGroup(options);
              }).catch(rejectGroup);

              if (options.group) return _this.__createGroup(options, $happn).then(function (group) {
                options.group = group;
                resolveGroup(options);
              }).catch(rejectGroup);

              resolveGroup(options);
            });
          })
          .then(resolve)
          .catch(reject);
      }
    });
  };
}

/* feed security group management */
{
  Feed.prototype.__ensureGroup = function (options, $happn) {

    return new Promise(function (resolve, reject) {

      $happn.exchange.security.listGroups(options.groupname, function (e, groups) {

        if (e) return reject(e);

        if (groups.length == 0) return reject('feed group with name: ' + options.groupname + ', does not exist.');

        resolve(groups[0]);
      })
    });
  };

  Feed.prototype.__updateGroupPermissions = function (options) {

    options.group.permissions = {events: {}, methods: {}};

    var eventsBasePath = "/feed/";

    options.datapaths.forEach(function (dataPath) {

      var basePath = eventsBasePath;

      if (dataPath.substring(0, 1) == '/') basePath = basePath.substring(1);

      options.group.permissions.events[basePath + dataPath] = {authorized: true};
    });

    options.group.permissions.methods[eventsBasePath + 'view/' + options.id] = {authorized: true};
  };

  Feed.prototype.__updateGroup = function (options, $happn) {

    this.__updateGroupPermissions(options);

    return new Promise(function (resolve, reject) {

      $happn.exchange.security.updateGroup(options.group)
        .then(function (group) {
          resolve(group);
        })
        .catch(reject);
    });
  };

  Feed.prototype.__attachNewFeedGroup = function (options) {

    if (!options.group.description) options.group.description = 'automated feed group';

    if (!options.group.feedId) options.group.feedId = options.id;

    this.__updateGroupPermissions(options);
  };

  Feed.prototype.__createGroup = function (options, $happn) {

    this.__attachNewFeedGroup(options);

    return $happn.exchange.security.addGroup(options.group);
  };
}

/* search and list */
{
  Feed.prototype.__getPath = function (options, methodName) {

    if (options == null) options = {};

    if (options.id == null) options.id = '*';

    return '/happner-feed-system/feeds/' + options.id;
  };

  Feed.prototype.list = function (options, $happn) {

    var _this = this;

    return new Promise(function (resolve, reject) {

      $happn._mesh.data.get(_this.__getPath(options), {criteria: options.criteria}, function (e, feeds) {

        if (e) return reject(e);

        resolve(feeds);
      });
    });
  };

  Feed.prototype.findByName = function (name, $happn) {

    return this.list({criteria: {"data.name": name}}, $happn).then(function (found) {
      return new Promise(function (resolve) {
        resolve(found[0]);
      });
    });
  };

  Feed.prototype.findById = function (id, $happn) {

    return this.list({criteria: {"data.id": id}}, $happn).then(function (found) {
      return new Promise(function (resolve) {
        resolve(found[0]);
      });
    });
  };
}

module.exports = Feed;