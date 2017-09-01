function TestUtilities() {

}

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

module.exports = TestUtilities;