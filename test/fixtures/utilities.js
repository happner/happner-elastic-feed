function TestUtilities(options) {

}

TestUtilities.create = function(options){
  return new TestUtilities(options);
};

TestUtilities.prototype.doRequest = function (protocol, host, port, path, token) {

  return new Promise(function (resolve, reject) {

    var request = require('request');

    try {

      if (!protocol) protocol = 'http';

      if (!host) host = '127.0.0.1';

      if (!port) port = 55000;

      if (path == null) path = '';

      if (path.substring(0, 1) != '/') path = '/' + path;

      var options = {url: protocol + '://' + host + ':' + port + path};

      if (token) options.url += '?happn_token=' + token;

      request(options, function (error, response, body) {

        resolve({"error": error, "response": response, "body": body});
      });

    } catch (e) {

      reject(e);
    }
  });
};

TestUtilities.prototype.integer = function getRandomInt(min, max) {

  return Math.floor(Math.random() * (max - min + 1)) + min;
};

TestUtilities.prototype.string = function(options){

  if (options == null) options = {};

  if (options.length == null) options.length = 20;

  var loopCount = options.length / 10 + 2;

  var createString = function(){
    var str = "";

    for (var i = 0;i < loopCount;i++){
      str += require('shortid').generate();
    }

    return str.substring(0, options.length);
  };

  if (options.count){

    var stringArr = [];

    for (var i = 0; i < options.count; i++)
      stringArr.push(createString());

    return stringArr;

  } else return createString();
};

TestUtilities.prototype.randomPaths = function(options){

  if (options == null) options = {};

  if (options.count == null) options.count = 10;

  if (options.maxSegments == null) options.maxSegments = 3;

  if (options.segmentDelimiter == null) options.segmentDelimiter = "/";

  var paths = [];

  for (var itemCount = 0; itemCount < options.count; itemCount++){

    var maxSegments = this.integer(1, options.maxSegments);
    var segments = [];

    if (options.prefix) segments.push(options.prefix);

    for (var segmentCount = 0; segmentCount < maxSegments; segmentCount++){
      segments.push(this.string());
    }

    if (options.suffix) segments.push(options.suffix);

    var subscription = segments.join(options.segmentDelimiter);

    if (options.duplicate){
      for (var duplicateCount = 0; duplicateCount < options.duplicate; duplicateCount++)
        paths.push(subscription);
    }
    else paths.push(subscription);
  }

  return paths;
};

module.exports = TestUtilities;