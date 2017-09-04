describe('happner-elastic-feed-portal-functional-tests', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var Service = require('../..');

  var request = require('request');

  var testUtils = require('../fixtures/utilities').create();

  var testData = require('../fixtures/data-generator').create();

  context('data', function () {

    it('tests the data generator', function (done) {

      testData.generate({index:'testdashboarddata'}, function(e, paths){
        console.log('paths:::', paths);
        done(e);
      });
    });
  });
});