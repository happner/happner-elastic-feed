var http = require('http');
var s = require("underscore.string");

function Utilities(options) {

  this.__options = options;
}

Utilities.create = function (options) {
  return new Utilities(options);
};

Utilities.prototype.cloneArray = function (arr, reverse) {

  if (!arr) return [];

  if (!Array.isArray(arr)) throw new Error('must be of type Array');

  var cloned = arr.map(function (r) {
    return r;
  });

  if (reverse) return cloned.reverse();

  return cloned;
};

Utilities.prototype.__splitOptions = function(arg, configArgv){

  var argSplit = arg.split('=');

  var key = argSplit[0];

  configArgv[key] = {};

  if (argSplit.length > 1) {

    var optionsString = argSplit.slice(1).join('=');//put the second half back together again

    configArgv[key] = this.__optionStringToJSON(optionsString);
  }
};

Utilities.prototype.__optionStringToJSON = function(str){

  // ie: proxy.port=55555,proxy.target=http://localhost:9200

  var options = {};

  str.split(',').forEach(function(option){

    var optionPair = option.split('=');

    var levels = optionPair[0].split('.');

    var currentLevel = options;

    levels.forEach(function(level, levelIndex){

      if (levelIndex == levels.length - 1) {
        currentLevel[level] = optionPair[1];
        return;
      }

      if (currentLevel[level] == null) currentLevel[level] = {};

      currentLevel = currentLevel[level];
    });
  });

  return options;
};

Utilities.prototype.readConfigArgv = function (options) {

  var _this = this;

  var configArgs = {};

  process.argv.forEach(function (arg, argIndex) {

    try {

      if (argIndex > 1) _this.__splitOptions(arg, configArgs);

    } catch (e) {

      console.warn('badly formatted argument: ' + arg + ', error: ' + e);
      if (options.exitOnFail) process.exit(1);
    }
  });

  return configArgs;
};

Utilities.prototype.stringifyError = function(err) {

  var plainError = {};

  Object.getOwnPropertyNames(err).forEach(function(key) {
    plainError[key] = err[key];
  });

  return JSON.stringify(plainError);
};

Utilities.prototype.parseCookies = function (req) {
  
  var list = {},
    rc = req.headers.cookie;

  rc && rc.split(';').forEach(function( cookie ) {
    var parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });

  return list;
};

Utilities.prototype.parsePostBody = function(request, response) {

  return new Promise(function(resolve, reject){

    try{

      var queryData = "";

      if(request.method == 'POST') {

        request.on('data', function(data) {

          queryData += data;

          if(queryData.length > 1e6) {

            queryData = "";

            response.writeHead(413, {'Content-Type': 'text/plain'}).end();

            request.connection.destroy();

            reject(new Error('processPost failed, body size exceeded limit of 1e6'));
          }
        });

        request.on('end', function() {

          request.body = queryData;

          resolve(queryData);
        });

        request.on('error', function(e) {

          reject(new Error('processPost failed, transmission error: ' + e.toString()));
        });

      } else resolve(null);

    }catch(e){

      reject(e);
    }
  });
};

Utilities.prototype.rpad = function(data, padding, padStr){

  return s.rpad(data.toString(), padding, padStr)
};

Utilities.prototype.lpad = function(data, padding, padStr){

  return s.lpad(data.toString(), padding, padStr)
};

module.exports = Utilities;
