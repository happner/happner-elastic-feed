describe('analyzer-functional-tests', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var fs = require('fs');

  var uuid = require('uuid');

  var checkCleanedUp = function(analyzer, done){

    var failed = false;

    Object.keys(analyzer.__modules).every(function(originalPath){

      if (fs.existsSync(originalPath + '.analyzed.js')){

        done(new Error('file not cleaned up: ' + originalPath + '.analyzed.js'));
        failed = true;
      }
      return !failed;
    });

    if (!failed) done();
  };

  it('tests the __getModulePath method', function (done) {

    var Analyzer = require('../../lib/analyze/service');

    var analyzer = new Analyzer();

    var testModule1Path = analyzer.__getModulePath('../fixtures/testAnalyzerModule1');

    var testModule2Path = analyzer.__getModulePath('../fixtures/testAnalyzerModule2');

    //ensure we are able to require this absolute paths

    require(testModule1Path);

    require(testModule2Path);

    done();
  });


  it('tests the require and cleanup', function (done) {

    var Analyzer = require('../../lib/analyze/service');

    var analyzer = new Analyzer();

    var TestModule1 = analyzer.require('../fixtures/testAnalyzerModule1', true);

    var testModule1 = new TestModule1();

    var TestModule2 = analyzer.require('../fixtures/testAnalyzerModule2', true);

    var testModule2 = new TestModule2();

    expect(Object.keys(analyzer.__modules).length).to.be(2);

    analyzer.cleanup();

    checkCleanedUp(analyzer, done);
  });

  it('tests the require and cleanup and a synchronous method', function (done) {

    var Analyzer = require('../../lib/analyze/service');

    var analyzer = new Analyzer();

    var TestModule1 = analyzer.require('../fixtures/testAnalyzerModule1', true);

    var testModule1 = new TestModule1();

    var TestModule2 = analyzer.require('../fixtures/testAnalyzerModule2', true);

    var testModule2 = new TestModule2();

    expect(Object.keys(analyzer.__modules).length).to.be(2);

    testModule1.testMethod1('test', 1);

    testModule2.testMethod1('test', 1);

    var analysis = analyzer.getAnalysis();

    expect(analysis['testAnalyzerModule1']['testMethod1'] >= 0).to.be(true);

    expect(analysis['testAnalyzerModule2']['testMethod1'] >= 0).to.be(true);

    analyzer.cleanup();

    checkCleanedUp(analyzer, done);

  });

  it('sanity tests', function (done) {

    this.timeout(10000);

    var Analyzer = require('../../lib/analyze/service');

    var analyzer = new Analyzer();

    var TestModule1 = analyzer.require('../fixtures/testAnalyzerModule1', true);

    var testModule1 = new TestModule1();

    var TestModule2 = analyzer.require('../fixtures/testAnalyzerModule2', true);

    var testModule2 = new TestModule2();

    testModule1.testMethod1('test', 1);

    testModule1.testMethod2('test', 2);

    testModule2.testMethod1('test', 1);

    testModule2.testMethod2('test', 2);

    testModule1.testMethod3(function(){

      testModule1.testPromiseMethod('promise', 1)

        .then(function(){

          testModule2.testPromiseMethod('promise', 2)

            .then(function(){

              testModule1.on('some event', function(data){

                testModule1.__averageTimeEnd('some_event', 'testAnalyzerModule1');

                var analysis = analyzer.getAnalysis();

                expect(analysis['testAnalyzerModule1']['testMethod3'] >= 2000).to.be(true);

                expect(analysis['testAnalyzerModule1']['testPromiseMethod'] >= 2000).to.be(true);

                expect(analysis['testAnalyzerModule1']['testMethod1'] >= 0).to.be(true);

                expect(analysis['testAnalyzerModule2']['testMethod1'] >= 0).to.be(true);

                analyzer.cleanup();

                checkCleanedUp(analyzer, done);
              });

              testModule1.fireEvent();
            })
        });
    });
  });
});