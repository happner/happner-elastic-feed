var Service = require('../lib/index');

var config = {};

var service = new Service();

var serviceType = 'proxy';

var async = require("async");

var utilities = require("../lib/utilities").create();

var services = utilities.readConfigArgv({"exitOnFail": true});

process.on('uncaughtException', __stop);

process.on('exit', __stop);

process.on('SIGTERM', __stop);

process.on('SIGINT', __stop);

if (Object.keys(services).length == 0) {

  console.warn('missing service arguments in format node service/start [service name]=service, ie: node service/start proxy=proxy.port:55555,proxy.target:http://localhost:9200');
  __stop();
}

var currentlyStarting;

async.eachSeries(Object.keys(services), function (serviceName, serviceCB) {

  currentlyStarting = serviceName;

  var serviceConfig = services[serviceName];

  service[serviceName].call(service, serviceConfig)

    .then(function () {

      console.log(serviceType + ' service started...');
      serviceCB();
    })
    .catch(function (e) {

      console.warn(serviceType + ' failed to start: ' + e.toString());
      serviceCB(e);
    });

}, function (e) {

  if (e) {
    console.warn('failed starting service: ' + currentlyStarting);
    return __stop(e);
  }

  console.log('started all services!');
});

function __stop(error) {

  var complete = function (e) {

    e = e ? e : error;

    if (e) {

      console.warn('stop failed: ' + e.toString());
      return process.exit(1);
    }

    console.log('services stopped successfully.');

    process.exit(0);
  };

  if (!service) return complete();

  service.stop().then(complete).catch(complete);
}