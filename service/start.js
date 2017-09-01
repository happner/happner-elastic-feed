var Service = require('../lib/index');

var config = {};

var service = new Service();

var serviceType = 'proxy';

//TODO: allow for passing in [array] of services and configs to append

service

  .proxy(config)

  .then(function () {

    console.log(serviceType + ' service started...');
  })
  .catch(function(e){

    console.warn(serviceType + ' failed to start: ' + e.toString());
  });