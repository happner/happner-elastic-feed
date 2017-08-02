describe('func', function () {

  this.timeout(5000);

  var expect = require('expect.js');

  var Service = require('..');

  var service = new Service();

  var globals = require('../lib/globals');

  var request = require('request');

  var fs = require('fs');

  context('service', function(){

    it('starts up and stops an elastic a source mesh', function(done){

      var sourceConfig = {};

      service.startSourceMesh(sourceConfig)

        .then(function(mesh){
          mesh.stop().then(function(){
            done();
          }).catch(function(e){
            done(e);
          });

      }).catch(done);
    });

    it('starts up and stops an elastic a source and destination mesh', function(done){

      var sourceConfig = {};
      var destinationConfig = {};

      service.startSourceMesh(sourceConfig)

        .then(function(sourceMesh){

          service.startDestinationMesh(destinationConfig)

            .then(function(destinationMesh){

              sourceMesh.stop()

                .then(function(){

                  destinationMesh.stop().then(function(){
                    done();
                  }).catch(done);
              }).catch(done);

            }).catch(done);

        }).catch(done);
    });
  });

  context('queue', function(){

    var sourceConfig = {
      kue:{

      }
    };

    service.startSourceMesh(sourceConfig)

      .then(function(mesh){

        


        mesh.stop().then(function(){
          done();
        }).catch(function(e){
          done(e);
        });

      }).catch(done);
  });

  context('feeds', function(){

    it('creates a feed based on a users permissions and a source and destination data client - then adds data, checks our portal component serves up the html', function(done){

      var FeedComponent = require('../lib/feed.js');

      var feedComponent = new FeedComponent();

      var happn = mockHappn();

      feedComponent.initialize({
        source:sourceConfig,
        destination:destConfig
      }).then(function(initialized){
        //first we must get the user info

        var feedConfig;

        var testObjects = {};

        feedComponent.__getNewFeedConfig({
            dashboards:['elastic-feed-test']
          }, happn)

          .then(function(config){

            feedConfig = config;

            //we first get the destination feed info, this is in a pub/sub format via the pare-tree

            return feedComponent.__attachToDestFeeds(feedConfig, happn);
          })

          .then(function(feeds){

            feedComponent.__destFeeds = feeds;

            return feedComponent.__getFeedDestinationPaths(feedConfig, happn);
          })

          .then(function(paths){

            feedConfig.destPaths = paths;

            return feedComponent.__cloneDashboardsAndObjects(feedConfig, happn);
          })

          .then(function(dashboards){
            feedConfig.dashboards = dashboards;



            return feedComponent.__createToken(feedConfig, happn);
          })

          .then(function(token){
            testObjects.token = token;



            return feedComponent.__persistFeed(feedConfig, happn);
          })

          .then(function(persisted){

            testObjects.url = persisted.url;

            return feedComponent.__startFeed(persisted, happn);
          })

          .then(function(started){

            return new Promise(function(resolve, reject){

              feedComponent.source.set('/func-test-feed/data', {'value':10}, function(e){

                if (e) return reject(e);
                else return resolve();
              });
            });
          })

          .then(function(pushed){

            expect(feedComponent.__queue.length).to.be(1);

            done();

          }).catch(done);

      }).catch(done);
    });

    it('pauses and resumes a feed', function(done){

      var FeedComponent = require('../lib/feed.js');

      var feedComponent = new FeedComponent();

      var happn = mockHappn();

      feedComponent.initialize({
        source:sourceConfig,
        destination:destConfig
      }).then(function(initialized){
        //first we must get the user info

        var feedConfig;

        var testObjects = {};

        feedComponent.__getNewFeedConfig({
            dashboards:['elastic-feed-test']
          }, happn)

          .then(function(config){
            feedConfig = config;
            return feedComponent.__getFeedSourcePaths(feedConfig, happn);
          })

          .then(function(paths){
            feedConfig.sourcePaths = paths;



            return feedComponent.__getFeedDestinationPaths(feedConfig, happn);
          })

          .then(function(paths){
            feedConfig.destPaths = paths;



            return feedComponent.__cloneDashboardsAndObjects(feedConfig, happn);
          })

          .then(function(dashboards){
            feedConfig.dashboards = dashboards;



            return feedComponent.__createToken(feedConfig, happn);
          })

          .then(function(token){
            testObjects.token = token;



            return feedComponent.__persistFeed(feedConfig, happn);
          })

          .then(function(persisted){

            testObjects.url = persisted.url;

            return feedComponent.__startFeed(persisted, happn);
          })

          .then(function(started){

            return new Promise(function(resolve, reject){

              return feedComponent.pause(feedConfig);
            });
          })

          .then(function(paused){

            return feedComponent.list();
          })

          .then(function(listed){

            return new Promise(function(resolve, reject){

              try{

                expect(listed[0].status).to.be(globals.FEED_STATUS.PAUSED);

                return feedComponent.resume(feedConfig);
              }catch(e){
                reject(e);
              }
            });
          })

          .then(function(listed){

            return new Promise(function(resolve, reject){

              try{

                expect(listed[0].status).to.be(globals.FEED_STATUS.ACTIVE);
                resolve();
              }catch(e){
                reject(e);
              }
            });
          })

          .catch(done);

      }).catch(done);
    })
  });

  context('queue', function(){

  });

  context('portal', function(){

    xit('creates a feed based on a users permissions and a source and destination data client - then adds data, checks our portal component serves up the html', function(done){

      var FeedComponent = require('../lib/feed.js');

      var feedComponent = new FeedComponent();

      var happn = mockHappn();

      feedComponent.initialize({
        source:sourceConfig,
        destination:destConfig
      }).then(function(initialized){
        //first we must get the user info

        var feedConfig;

        var testObjects = {};

        feedComponent.__getNewFeedConfig({
            sourceUser:'_ADMIN',
            dashboards:['elastic-feed-test']
          }, happn)

          .then(function(config){
            feedConfig = config;
            return feedComponent.__getFeedSourcePaths(feedConfig, happn);
          })

          .then(function(paths){
            feedConfig.sourcePaths = paths;



            return feedComponent.__getFeedDestinationPaths(feedConfig, happn);
          })

          .then(function(paths){
            feedConfig.destPaths = paths;



            return feedComponent.__cloneDashboardsAndObjects(feedConfig, happn);
          })

          .then(function(dashboards){
            feedConfig.dashboards = dashboards;



            return feedComponent.__createToken(feedConfig, happn);
          })

          .then(function(token){
            testObjects.token = token;



            return feedComponent.__persistFeed(feedConfig, happn);
          })

          .then(function(persisted){

            testObjects.url = persisted.url;

            return feedComponent.__startFeed(persisted, happn);
          })

          .then(function(started){

            return new Promise(function(resolve, reject){

              getBody('http://127.0.0.1:' + testFeedPort + '/feed?token=' + testObjects.token, function (e, body) {

                try{

                  body.should.eql(fs.readFileSync(__dirname + '/fixtures/expected-feed.html').toString());

                  feedComponent.source.set('/testfeed/data', {'value':10}, function(e){

                    if (e) return reject(e);
                    else return resolve();
                  });
                }catch(e){
                  reject(e);
                }
              });
            });
          })

          .then(function(pushed){

            return new Promise(function(resolve, reject) {

              setTimeout(function () {

                getBody('http://127.0.0.1:' + testFeedPort + '/feed?token=' + testObjects.token, function (e, body) {

                  try {

                    body.should.eql(fs.readFileSync(__dirname + '/fixtures/expected-feed-with-data.html').toString());
                    resolve();
                  } catch (e) {
                    reject(e);
                  }
                });
              }, 3000);
            });

          }).catch(done);

      }).catch(done);
    });

  });

  context('service', function(){

  });

});