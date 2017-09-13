var utilities = require('../../utilities').create()
  , url = require('url')
  , RedisCache = require('redis-lru-cache')
  , Mesh = require('happner-2')
  , PareTree = require('wild-pare')
  , LRU = require("lru-cache")
  , async = require('async')
  ;

function Proxy(options) {

  var _this = this;

  if (!options) options = {};

  if (!options.proxy) options.proxy = {};

  if (!options.proxy.elasticProtocol) options.proxy.elasticProtocol = 'http';

  if (!options.proxy.elasticURL) options.proxy.elasticURL = 'http://localhost:9200';

  if (!options.proxy.elasticListenPort) options.proxy.elasticListenPort = 55555;

  if (!options.proxy.kibanaProtocol) options.proxy.kibanaProtocol = 'http';

  if (!options.proxy.kibanaURL) options.proxy.kibanaURL = 'http://localhost:5601';

  if (!options.proxy.kibanaListenPort) options.proxy.kibanaListenPort = 4444;

  _this.__excludedAuthUrls = [
    '/_cluster/health/.kibana?timeout=5s',
    '/_nodes/_local?filter_path=nodes.*.settings.tribe',
    '/_nodes?filter_path=nodes.*.version%2Cnodes.*.http.publish_address%2Cnodes.*.ip',
    '/.kibana/config/_search'
  ];

  // /_mget {"docs":[{"_index":".kibana","_type":"config","_id":"5.4.2"}]}
  //

  if (options.excludedAuthUrls) {

    options.excludedAuthUrls.forEach(function (url) {

      _this.__excludedAuthUrls.push(url);
    });
  }

  if (!options.permissionsCache) options.permissionsCache = {};

  if (!options.permissionsCache.max) options.permissionsCache.max = 5000;

  if (!options.permissionsCache.maxAge) options.permissionsCache.maxAge = 1000 * 60 * 60 * 48;//two days

  if (!options.kibana_server_secret) options.kibana_server_secret = 'happn';

  this.__options = options;
}

/* initialize and stop */

Proxy.prototype.initialize = initialize;

Proxy.prototype.stop = stop;

/* elastic proxy methods */

Proxy.prototype.__handleElasticAuthorize = __handleElasticAuthorize;//check for the special elastic header

Proxy.prototype.__handleElasticRequest = __handleElasticRequest;//after the authorization

/* kibana proxy methods */

Proxy.prototype.__handleKibanaRequest = __handleKibanaRequest;

Proxy.prototype.__handleKibanaAuthenticate = __handleKibanaAuthenticate;

Proxy.prototype.__handleKibanaAuthorize = __handleKibanaAuthorize;

Proxy.prototype.__handleKibanaAvailableDashboards = __handleKibanaAvailableDashboards;

Proxy.prototype.__handleKibanaBadRequest = __handleKibanaBadRequest;

/* security methods */

Proxy.prototype.__sessionFromToken = __sessionFromToken;

Proxy.prototype.__authorizeKibanaRequest = __authorizeKibanaRequest;

Proxy.prototype.__handleSecurityChange = __handleSecurityChange;

Proxy.prototype.__setPermissions = __setPermissions;

Proxy.prototype.__removePermissions = __removePermissions;

Proxy.prototype.__handlePermissionsCacheDropped = __handlePermissionsCacheDropped;

Proxy.prototype.__checkPassthrough = __checkPassthrough;

Proxy.prototype.__completeAuthorize = __completeAuthorize;

Proxy.prototype.__getHappnToken = __getHappnToken;

Proxy.prototype.__prepareRequest = __prepareRequest;

function initialize($happn) {

  var _this = this;

  _this.$happn = $happn;

  //[start:{"key":"initialize", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    _this.__sessionCache = new RedisCache({
      cacheId: 'happner-feed-proxy-sessions',
      lru: {
        max: 10000
      },
      clear: true
    });

    _this.__happnSecurityService = $happn._mesh.happn.server.services.security;

    _this.__happnSecurityService.onDataChanged(_this.__handleSecurityChange.bind({instance:_this, $happn:$happn}));

    var wildProxyConfig = {

      listeners: [
        {
          name: 'elastic-proxy',
          port: _this.__options.proxy.elasticListenPort,
          protocol: _this.__options.proxy.elasticProtocol,
          target: _this.__options.proxy.elasticURL
        },
        {
          name: 'kibana-proxy',
          port: _this.__options.proxy.kibanaListenPort,
          protocol: _this.__options.proxy.kibanaProtocol,
          target: _this.__options.proxy.kibanaURL
        }
      ],
      rules: [
        {
          name: 'elastic-proxy',
          steps: [
            {
              name: 'elastic-authorize',
              path: '*',
              handler: _this.__handleElasticAuthorize.bind({instance: _this, $happn: $happn})
            },
            {
              name: 'elastic-proxy',
              path: '*',
              handler: _this.__handleElasticRequest.bind({instance: _this, $happn: $happn}),
              terminate: true
            }
          ]
        },
        {
          name: 'kibana-proxy',
          steps: [
            {
              name: 'kibana-authenticate',
              path: '/auth?*',
              handler: _this.__handleKibanaAuthenticate.bind({instance: _this, $happn: $happn}),
              terminate: true
            },
            {
              name: 'kibana-authorize',
              path: '*',
              handler: _this.__handleKibanaAuthorize.bind({instance: _this, $happn: $happn})
            },
            {
              name: 'kibana-available-dashboards',
              path: '/dashboards?*',
              handler: _this.__handleKibanaAvailableDashboards.bind({instance: _this, $happn: $happn}),
              terminate: true
            },
            {
              name: 'kibana-proxy',
              path: '/app/kibana*',
              handler: _this.__handleKibanaRequest.bind({instance: _this, $happn: $happn}),
              terminate: true
            },
            {
              name: 'kibana-bad',
              path: '*',
              handler: _this.__handleKibanaBadRequest.bind({instance: _this, $happn: $happn})
            }
          ]
        }
      ]
    };

    _this.__authorizeEngine = require('./rules-engine').create('browser-kibana', require('./rulestacks/browser-kibana'), _this);

    _this.__authorizeEngine.parseRules('kibana-elastic', require('./rulestacks/kibana-elastic'), _this);

    _this.__proxy = require('wild-proxy').create(wildProxyConfig);

    _this.__permissions = new PareTree();

    var permissionsLRUOptions = {
      max: _this.__options.permissionsCache.max,
      dispose: _this.__handlePermissionsCacheDropped.bind({instance: _this, $happn: $happn}),//function (key, n) { n.close() }
      maxAge: _this.__options.permissionsCache.maxAge
    };

    _this.__permissionsCache = new LRU(permissionsLRUOptions);

    return _this.__proxy.listen()

      .then(function () {
        //[end:{"key":"initialize", "self":"_this"}:end]

        resolve();
      })
      .catch(reject);
  });
}

function stop($happn, callback) {

  var _this = this;

  try {

    //[start:{"key":"stop", "self":"_this"}:start]

    if (typeof $happn == 'function') {
      callback = $happn;
      $happn = null;
    }

    if (_this.__proxy) _this.__proxy.stop()

      .then(function () {

        //[end:{"key":"stop", "self":"_this"}:end]
        callback();
      }).catch(function (e) {
        //[end:{"key":"stop", "self":"_this", "error":"e"}:end]
        callback(e);
      });


    return callback();

  } catch (e) {

    console.warn('failed to stop proxy: ' + e.toString());
    //[end:{"key":"stop", "self":"_this", "error":"e"}:end]
    return callback(e);
  }
}

function __handleElasticRequest(req, res) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    try {

      //[start:{"key":"__handleRequest", "self":"_this"}:start]

      //TODO: handler code checks permissions on production mesh

      _this.instance.emit('handle-request-happened', {
        from: req.url,
        to: _this.instance.__options.proxy.elasticURL
      }, _this.$happn);

      //[end:{"key":"__handleRequest", "self":"_this"}:end]

      resolve();

    } catch (e) {

      _this.instance.emit('handle-request-error', e.toString(), _this.$happn);

      reject(e);
      //[end:{"key":"__handleRequest", "self":"_this", "error":"e"}:end]
    }
  });
}

function __sessionFromToken(token) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.__sessionCache.get(token, function (e, session) {

      try {

        if (e) return reject(new Error('__sessionFromToken failed at cache retrieval: ' + e.toString()));

        if (!session) {

          session = _this.__happnSecurityService.decodeToken(token);

          session.type = 0;

          return _this.__sessionCache.set(token, session, function (e) {

            if (e) return reject(new Error('__sessionFromToken failed at cache set: ' + e.toString()));

            resolve(session);
          });
        }

        return resolve(session);

      } catch (e) {

        reject(new Error('__sessionFromToken failed: ' + e.toString()));
      }
    });
  });
}

function __handleKibanaAuthenticate(req, res) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    var authURL = url.parse(req.url, true);

    var token = authURL.query.happn_token;

    var username = authURL.query.username;

    var password = authURL.query.password;

    var redirect = authURL.query.redirect ? decodeURIComponent(authURL.query.redirect) : null;

    _this.instance.emit('kibana-authenticate', authURL.query);

    if (!redirect) throw new Error('missing redirect redirect argument');

    if (!token && !username) {

      throw new Error('missing happn_token or username querystring arguments');
    }

    var doRedirect = function (redirectToken, redirectUrl) {

      res.setHeader('Set-Cookie', 'happn_token=' + redirectToken);

      // Redirect back after setting cookie
      res.statusCode = 302;

      res.setHeader('Location', redirectUrl);

      res.end();

      return resolve(true); //preventProxy=true means we are not proxying any further
    };

    if (username) {

      if (!password) throw new Error('missing password querystring argument');

      var meshClient = new Mesh.MeshClient({secure: true});

      return meshClient.login({
          username: username,
          password: password
        })
        .then(function () {

          _this.instance.__sessionFromToken(meshClient.token, _this.$happn)

            .then(function (session) {

              _this.instance.__setPermissions(session, _this.$happn, function(e){

                if (e) return reject(e);

                doRedirect(meshClient.token, redirect);
              });

            }).catch(reject);
        })
        .catch(function (e) {
          reject(new Error('__kibanaAuthenticate failed, credentials auth error: ' + e));
        });
    }

    _this.instance.__sessionFromToken(token, _this.$happn)

      .then(function (session) {

        _this.instance.__setPermissions(session, _this.$happn, function(e){

          if (e) return reject(e);

          doRedirect(token, redirect);
        });

      }).catch(reject);
  });
}

function __completeAuthorize (req, session, permissions, resolve, reject){

  var _this = this;

  try{

    //TODO: check the body

    console.log('__completeAuthorize:::', req.method, req.url, req.body, session, permissions);

    resolve();

  }catch(e){

    reject(e);
  }
}

function __authorizeKibanaRequest(req, session, $happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (_this.__permissionsCache.get(session.id) == null)

      //the session cache has either dumped the session or we have restarted the proxy between authorization and authentication requests
      //TODO: think about replays here!!!
      return _this.__setPermissions(session, $happn, function(e){

        if (e) return reject(e);

        _this.__completeAuthorize(req, session, _this.__permissions.search({path:'*', filter:{key:session.id}}), resolve, reject);
      });

    _this.__completeAuthorize(req, session, _this.__permissions.search({path:'*', filter:{key:session.id}}), resolve, reject)
  });
}

//appends session and body to the req if they can be parsed from req
function __prepareRequest(req, res){

  var _this = this;

  return new Promise(function(resolve, reject){

    req.token = _this.__getHappnToken(req, res);//throw 403 is true, so response is sent

    if (req.method == 'POST')
      return utilities.parsePostBody(req, res).then(resolve).catch(reject);

    resolve(req);
  });

}

//all kibana calls should have a happn_token cookie
function __handleKibanaAuthorize(req, res) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.instance.__authorizeEngine.enforce('browser-kibana', {req:req, res:res},

      function(facts, consequence, callback){

        if (consequence && consequence.action == "deny"){

          _this.instance.emit('kibana-authorize-failed', {url:req.url, reason:consequence.message}, _this.$happn);

          res.statusCode = 403;

          res.end('authorization failed, request rejected: ' + consequence.message);

          return callback(null, false);
        }

        if (consequence && consequence.action == "proxy"){

          _this.instance.emit('kibana-authorize-succeeded', {url:req.url, reason:consequence.message}, _this.$happn);

          return callback(null, false);
        }

        return callback(null, true);
      })

      .then(function(completed){

        resolve(!completed.req.session)//stop executing if the session doesn't exist, (!null = true)
      })

      .catch(function(e){

        _this.instance.emit('kibana-authorize-failed', {url:req.url, error:e.toString()}, _this.$happn);

        res.statusCode = 500;

        res.end('authorization failed, request failed: ' + e.toString());

      });
  });
}

function __checkPassthrough(req){

  try{

    if (this.__excludedAuthUrls.indexOf(req.url) > -1) return true;

    if (req.url == '/_mget'){

      var body = JSON.parse(req.body);

      if (body.docs && body.docs[0]["_index"] == ".kibana" && body.docs[0]["_type"] == "config") return true;
    }

  }catch(e){
    //do nothings
    this.emit('elastic-passthrough-failed', {url:req.url, error:e.toString()});
  }

  return false;
}

function __handleElasticAuthorize(req, res) {

  var _this = this;

  req.authorized = false;

  return new Promise(function (resolve) {

    _this.instance.__authorizeEngine.enforce('kibana-elastic', {req:req, res:res},

      function(facts, consequence, callback){

        if (consequence && consequence.action == "deny"){

          _this.instance.emit('elastic-authorize-failed', {url:req.url, reason:consequence.message}, _this.$happn);

          res.statusCode = 403;

          res.end('authorization failed, request rejected: ' + consequence.message);

          return callback(null, false);
        }

        if (consequence && consequence.action == "proxy"){

          _this.instance.emit('elastic-authorize-succeeded', {url:req.url, reason:consequence.message}, _this.$happn);

          req.authorized = true;

          return callback(null, false);
        }

        return callback(null, true);
      })

      .then(function(completed){

        resolve(!completed.req.authorized)//stop executing if the session doesn't exist, (!null = true)
      })

      .catch(function(e){

        _this.instance.emit('elastic-authorize-failed', {url:req.url, error:e.toString()}, _this.$happn);

        res.statusCode = 500;

        res.end('authorization failed, request failed: ' + e.toString());

      });

    // _this.instance.emit('elastic-authorize', req.url, _this.$happn);
    //
    // if (!req.headers.kibana_server_secret == _this.instance.__options.kibana_server_secret) {
    //
    //   _this.instance.emit('elastic-authorize-failed-no-secret', req.url, _this.$happn);
    //
    //   return resolve(true);
    // }
    //
    // var token = _this.instance.__getHappnToken(req, res); //throw403 false, so we dont write a response back until we have checked passThrough
    //
    // utilities.processPost(req, res) // get the body
    //
    //   .then(function () {
    //
    //     return new Promise(function(tokenResolve, tokenReject){
    //
    //       if (!token){
    //
    //         //some calls are keep-alives between kibana and elastic, so token-less but still permissable
    //
    //         if (_this.instance.__checkPassthrough(req)) return resolve(); // resolve out of top promise
    //
    //         return tokenReject(new Error('no token found in request headers')); // reject to containing catch
    //       }
    //
    //       tokenResolve();
    //     });
    //   })
    //
    //   .then(function () {
    //
    //     //grab our session
    //     return _this.instance.__sessionFromToken(token, _this.$happn);
    //   })
    //
    //   .then(function (session) {
    //
    //     //the request url and body are verified against the calling session
    //     return _this.instance.__authorizeKibanaRequest(req, session, token, _this.$happn);
    //   })
    //
    //   .then(resolve)
    //
    //   .catch(function(e){
    //
    //     _this.instance.emit('elastic-authorize-failed', {url:req.url, error:e.toString()}, _this.$happn);
    //
    //     res.statusCode = 403;
    //
    //     res.end('authorization failed, request rejected: ' + e.toString());
    //
    //     resolve(true);
    //   });
  });
}

function __getHappnToken(req, res, throw403){

  req.cookies = utilities.parseCookies(req);

  var token = req.cookies['happn_token'];

  if (!token && throw403) {

    res.statusCode = 403;

    res.end('no happn_token cookie found, request rejected');

    return false;
  }

  return token;
}

function __handleKibanaAvailableDashboards(req, res) {

  var _this = this;

  return new Promise(function (resolve) {

    _this.instance.emit('kibana-available-dashboards', req.url, _this.$happn);

    resolve();
  });
}

function __handleKibanaBadRequest(req, res) {

  var _this = this;

  return new Promise(function (resolve) {

    _this.instance.emit('kibana-bad-request', req.url, _this.$happn);

    resolve();
  });
}

function __handleKibanaRequest(req, res) {

  var _this = this;

  return new Promise(function (resolve) {

    _this.instance.emit('kibana-request', req.url, _this.$happn);

    resolve();
  });
}

function __handlePermissionsCacheDropped(sessionId, session){

  this.instance.__removePermissions(session);
}

function __removePermissions(session) {


  this.__permissions.remove({path: '*', filter: {"key": session.id}});
  this.__permissionsCache.del(session.id, session);
}

function __setPermissions(session, $happn, callback) {

  var _this = this;

  _this.__happnSecurityService.users.getUser(session.username, function(e, user){

    if (e) {

      _this.emit('get-user-failed', {session:session, error:e.toString()}, $happn);

      return callback(e);
    }

    async.eachSeries(Object.keys(user.groups), function(groupName, groupCB){

      _this.__happnSecurityService.users.getGroup(groupName, function (e, group) {

        if (e) return groupCB(e);

        for (var permissionPath in group.permissions){

          var permission = group.permissions[permissionPath];

          if (permission.actions.indexOf('on') > -1 ||
              permission.actions.indexOf('get') > -1 ||
              permission.actions.indexOf('*') > -1)

            _this.__permissions.add(permissionPath, {key:session.id, data:session.username})
        }

        groupCB();

      });

    }, function(e){

      if (e) {
        _this.emit('get-groups-failed', {session:session, error:e.toString()}, $happn);
        return callback(e);
      }

      _this.__permissionsCache.set(session.id, session);

      return callback();
    });
  });
}

function __handleSecurityChange(whatHappnd, changedData) {

  console.log('security changed:::', whatHappnd, changedData);

  this.instance.__permissionsCache.reset();

  this.instance.__permissions.remove('*');
}


module.exports = Proxy;