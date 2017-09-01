function Proxy(options) {

  if (!options) options = {};

  if (!options.proxy) options.proxy = {};

  if (!options.proxy.target) options.proxy.target = 'http://localhost:9200';

  if (!options.proxy.port) options.proxy.port = 55555;

  this.__options = options;
}

/* initialize and stop */

Proxy.prototype.initialize = initialize;

Proxy.prototype.stop = stop;

/* authorization handlers */

Proxy.prototype.dashboardListAuthorized = dashboardListAuthorized;//get list of dashboards you have permissions to view

Proxy.prototype.handleRequest = handleRequest;//the proxy request handler, outside of happn

function initialize($happn) {

  var _this = this;

  //[start:{"key":"initialize", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    try {

      if (_this.__options.proxy.https) _this.__server = require('https-proxy');

      else _this.__server = require('http-proxy');

      _this.__proxy = _this.__server.createProxyServer({target: _this.__options.proxy.target}).listen(_this.__options.proxy.port);

      _this.__proxy.on('proxyReq', _this.handleRequest.bind({$happn: $happn, instance: _this}));

      //[end:{"key":"initialize", "self":"_this"}:end]

      resolve();

    } catch (e) {

      console.warn('failed to start proxy service: ', e.toString());

      //[end:{"key":"initialize", "self":"_this", "error":"e"}:end]
      reject(e);
    }
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

    if (_this.__proxy) _this.__proxy.close();

    //[end:{"key":"stop", "self":"_this"}:end]
    return callback();

  } catch (e) {

    console.warn('failed to stop proxy: ' + e.toString());
    //[end:{"key":"stop", "self":"_this"}:end]
    return callback(e);
  }
}

function dashboardListAuthorized(req, res, next, $happn, $origin) {

  var _this = this;

  //[start:{"key":"__authDashboards", "self":"_this"}:start]

  var injectNext = function(e){

    if (e) {
      this.instance.emit ('dashboard-list-authorized-error', $origin, $happn);
      //[end:{"key":"__authDashboards", "self":"_this", "error":"e"}:end]
      return next(e);
    }
    next();
    this.instance.emit ('dashboard-list-authorized-happened', $origin, $happn);
    //[end:{"key":"__authDashboards", "self":"_this"}:end]
  }.bind({next:next, instance:_this, $happn:$happn});

  try{

    _this.emit('dashboard-list-authorized-happening', $origin, $happn);

    if (_this.__options.proxy.dashboardListAuthorizedHandler) _this.__options.proxy.dashboardListAuthorizedHandler.call(_this.__options.proxy.dashboardListAuthorizedHandler, req, res, injectNext, $happn, $origin);
    else {
      //TODO: get list of dashboards this $origin has permissions to
      injectNext();
    }
  }catch(e){

    injectNext(e);
  }
}

function handleRequest(proxyReq, req, res, options) {

  var _this = this;

  //[start:{"key":"__handleRequest", "self":"_this"}:start]

  try {

    _this.instance.emit('handle-request-happening', {from: req.url, to: _this.instance.__options.proxy.target}, _this.$happn);

    if (_this.instance.__options.proxy.proxyHandler)
      _this.instance.__options.proxy.proxyHandler.call(_this.instance.__options.proxy.proxyHandler, proxyReq, req, res, options, _this.$happn);

    //TODO: handler code checks permissions on production mesh

    _this.instance.emit('handle-request-happened', {from: req.url, to: _this.instance.__options.proxy.target}, _this.$happn);

    //[end:{"key":"__handleRequest", "self":"_this"}:end]

  } catch (e) {
    _this.instance.emit('handle-request-error', e.toString(), _this.$happn);
    //[end:{"key":"__handleRequest", "self":"_this", "error":"e"}:end]
  }
}

module.exports = Proxy;