var utilities = require('../../utilities').create()
  , url = require('url')
  , RedisCache = require('redis-lru-cache')
  , Mesh = require('happner-2')
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
    // '/_mget',
    // '/_cluster/health/.kibana?timeout=5s',
    // '/.kibana/config/_search',
    // '/_nodes?filter_path=nodes.*.version%2Cnodes.*.http.publish_address%2Cnodes.*.ip',
    // '/_nodes/_local?filter_path=nodes.*.settings.tribe'
  ];

  if (options.excludedAuthUrls) {

    options.excludedAuthUrls.forEach(function (url) {

      _this.__excludedAuthUrls.push(url);
    });
  }

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

Proxy.prototype.__authorizeElasticRequest = __authorizeElasticRequest;//check for the special elastic header

function initialize($happn) {

  var _this = this;

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

    _this.__happnerSecurityService = $happn._mesh.exchange.security;

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

    var WildProxy = require('./wild-proxy');

    _this.__proxy = new WildProxy(wildProxyConfig);

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

  return new Promise(function(resolve, reject){

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

  return new Promise(function(resolve, reject){

    var authURL = url.parse(req.url, true);

    var token = authURL.query.happn_token;

    var username = authURL.query.username;

    var password =  authURL.query.password;

    var redirect = authURL.query.redirect ? decodeURIComponent(authURL.query.redirect) : null;

    _this.instance.emit('kibana-authenticate', authURL.query);

    if (!redirect) throw new Error('missing redirect redirect argument');

    if (!token && !username) {

      throw new Error('missing happn_token or username querystring arguments');
    }

    var doRedirect = function(redirectToken, redirectUrl){

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
      .then(function(){

        _this.instance.__sessionFromToken(meshClient.token).then(function(){

          doRedirect(meshClient.token, redirect);

        }).catch(reject);
      })
      .catch(function(e){
        reject(new Error('__kibanaAuthenticate failed, credentials auth error: ' + e));
      });
    }

    _this.instance.__sessionFromToken(token).then(function(){

      doRedirect(token, redirect);

    }).catch(reject);
  });
}

function __authorizeKibanaRequest (req, session) {

  return new Promise(function(resolve, reject){

    //TODO: kibana auth code happens here
    resolve();//passthrough
  });
}

function __handleKibanaAuthorize(req, res) {

  var _this = this;

  return new Promise(function (resolve) {

    if (_this.instance.__excludedAuthUrls.indexOf(req.url) >= 0) return resolve();

    req.cookies = utilities.parseCookies(req);

    var token = req.cookies['happn_token'];

    if (!token) {

      res.statusCode = 403;

      res.end('no happn_token cookie found, request rejected');

      return resolve(true);
    }

    utilities.processPost(req, res)

      .then(function () {
        return _this.instance.__sessionFromToken(token);
      })

      .then(function (session) {

        return _this.instance.__authorizeKibanaRequest(req, session);
      })

      .then(resolve)

      .catch(function(e){

        res.statusCode = 403;

        res.end('authorization failed, request rejected: ' + e.toString());

        resolve(true);
      });
  });
}

function __authorizeElasticRequest(secret) {

  //TODO: ensure the configured secret matches what we have in the kibana request header, otherwise return true

  return true;//passthrough
}

function __handleElasticAuthorize(req, res) {

  var _this = this;

  return new Promise(function (resolve) {

    _this.instance.emit('elastic-authorize', req.url, _this.$happn);

    if (!req.headers || !req.headers.kibana_server_secret || !_this.instance.__authorizeElasticRequest(req.headers.kibana_server_secret)) {

      console.warn('no kibana_server_secret header found: ', req.url, req.headers);

      // Redirect back after setting cookie
      res.statusCode = 403;

      res.end('no kibana_server_secret header found, request rejected');

      return resolve(true);
    }

    //console.log('found kibana_server_secret :)', req.url);

    _this.instance.emit('elastic-authorize-ok', req.url, _this.$happn);

    resolve();//passthrough
  });
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


module.exports = Proxy;