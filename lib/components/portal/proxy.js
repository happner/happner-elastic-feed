function Proxy(options) {

  if (!options) options = {};

  if (!options.proxy) options.proxy = {};

  if (!options.proxy.target) options.proxy.target = 'http://localhost:9200';

  if (!options.proxy.port) options.proxy.port = 55555;

  this.__options = options;
}

Proxy.prototype.__authDashboard = function(req, res, next, $origin){
  console.log('__authDashboard', req.url, $origin);
  next();
};

Proxy.prototype.handleRequest = function(proxyReq, req, res, options) {
  console.log('proxy-request:::', req.url);
};

Proxy.prototype.initialize = function ($happn) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    try{

      if (_this.__options.proxy.https) _this.__server = require('https-proxy');

      else _this.__server = require('http-proxy');

      _this.__proxy = _this.__server.createProxyServer({target: _this.__options.proxy.target}).listen(_this.__options.proxy.port);

      _this.__proxy.on('proxyReq', _this.handleRequest);

      resolve();

    }catch(e){
      console.warn('failed to start proxy service: ', e.toString());
      reject(e);
    }
  });
};


module.exports = Proxy;