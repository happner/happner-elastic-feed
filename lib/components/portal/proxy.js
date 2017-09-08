var utilities = require('../../utilities').create()
  ,url = require('url')
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

  if (options.excludedAuthUrls){

    options.excludedAuthUrls.forEach(function(url){

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

Proxy.prototype.__kibanaSecretInvalid = __kibanaSecretInvalid;//check for the special elastic header

/* kibana proxy methods */

Proxy.prototype.__handleKibanaRequest = __handleKibanaRequest;

Proxy.prototype.__handleKibanaAuthenticate = __handleKibanaAuthenticate;

Proxy.prototype.__handleKibanaAuthorize = __handleKibanaAuthorize;

Proxy.prototype.__handleKibanaAvailableDashboards = __handleKibanaAvailableDashboards;

Proxy.prototype.__handleKibanaBadRequest = __handleKibanaBadRequest;


function initialize($happn) {

  var _this = this;

  //[start:{"key":"initialize", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

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

function __handleKibanaAuthenticate(req, res) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    try{

      var authURL = url.parse(req.url, true);

      var token = authURL.query.happn_token;

      var redirect = authURL.query.redirect?decodeURIComponent(authURL.query.redirect):null;

      _this.instance.emit('kibana-authenticate', {token:token, redirect:redirect});

      if (!token) throw new Error('missing happn_token querystring argument');

      if (!redirect) throw new Error('missing redirect redirect argument');

      res.setHeader('Set-Cookie', 'happn_token=' + token);

      // Redirect back after setting cookie
      res.statusCode = 302;

      res.setHeader('Location', redirect);

      res.end();

      resolve(true); //preventProxy=true means we are not proxying any further

    }catch(e){

      reject(e);
    }
  });
}

function __handleKibanaAuthorize(req, res) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (_this.instance.__excludedAuthUrls.indexOf(req.url) >= 0) return resolve();

    req.cookies = utilities.parseCookies(req);

    var token = req.cookies['happn_token'];

    if (!token) {

      console.warn('no happn_token cookie found: ', req.url, req.headers);

      res.statusCode = 403;

      res.end('no kibana_server_secret header found, request rejected');

      resolve(true);
    }
    else {

      //console.log('found happn_token :)', req.url);
      //return resolve();//passthrough

      utilities.processPost(req, res, function(e){

        if (e) return reject(e);

        console.log('request body:::', req.body);
        //TODO: add authorization code here for elasticsearch requests
        _this.instance.emit('kibana-authorize', req.url, _this.$happn);

        //console.log('passthrough:::', req.body);
        resolve();//passthrough
      });
    }
  });
}

function __kibanaSecretInvalid(secret){

  //TODO: ensure the configured secret matches what we have in the kibana request header, otherwise return true

  return false;
}

function __handleElasticAuthorize(req, res) {

  var _this = this;

  return new Promise(function (resolve) {

    _this.instance.emit('elastic-authorize', req.url, _this.$happn);

    if (!req.headers || !req.headers.kibana_server_secret || _this.instance.__kibanaSecretInvalid(req.headers.kibana_server_secret)){

      console.warn('no kibana_server_secret header found: ', req.url, req.headers);

      // Redirect back after setting cookie
      res.statusCode = 403;

      res.end('no kibana_server_secret header found, request rejected');

      resolve(true);
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