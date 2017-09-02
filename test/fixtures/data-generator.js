var TestUtilities = require('./utilities');
var SystemUtilities = require('../../lib/utilities');

var testUtilities = new TestUtilities();

var systemUtilities = new SystemUtilities();


function DataGenerator(options) {
  this.__options = options;
}

DataGenerator.prototype.generate = function () {
  //var randomInteger = testUtilities.integer(0, 1000000);
};

//see if we are calling this file as a commandline
var services = systemUtilities.readConfigArgv({"exitOnFail": true});