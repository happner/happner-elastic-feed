happner elastic feed
----------------------------
*The happner elastic feed works with the [happner-elastic-dataprovider](https://github.com/happner/elastic-dataprovider) to pull data from a happner instance via the subscription service, and push the data into a feed warehouse. Feeds are generated from the users group permissions to create subscriptions to the data changes in the production happner service, feed data is then made available to a kibana dashboard that is tailor made for the feed data.*

### prerequisites:

### just feeds:

node v7+

npm

#### whole system needs feeds prerequisites and:

##### [elasticsearch 5.4](https://www.elastic.co/blog/elasticsearch-5-4-0-released)

##### [kibana 5.4](https://www.elastic.co/blog/kibana-5-4-0-released)

##### [redis server](https://redis.io/topics/quickstart)

### installation instructions:

```bash
#install deps
npm install happner-elastic-feed
#test run
npm test

run the service locally:
git clone https://github.com/happner/elastic-feed.git && cd elastic-feed && npm install && node service/start
```

### multiple happner instances:
1: queue - uses [kue](https://github.com/Automattic/kue) as the basis for jobs and batches
2. subscriber - subscribes to * on the production happner environment, pushes jobs into the queue
3. emitter -receives emit jobs submitted by subscriber pushes jobs to the elastic service
4. portal - TBD
5. proxy - transparent proxy between kibana and elasticsearch, checks incoming requests are in line with users permissions, also has authenticate method for dashboard

### detailed premise for this architecture

system a factory or builder with a collection of happner components, that can be appended depending on what services need to be run.

for detailed end-to-end use, please look at the [sanity tests.](https://github.com/happner/happner-elastic-feed/blob/master/test/sanity.js)

#### running the whole system as a service:

```bash

npm i happner-elastic-feed --save

```

```javascript

var Service = require('happner-elastic-feed');

var service = new Service();

var queueConfig = {
queue: {
  jobTypes: {
    "emitter": {concurrency: 10}
  }
}
};

var subscriberConfig = {};

var subscriberWorkerConfig = {
name: 'happner-emitter-worker',
queue: {username: '_ADMIN', password: 'happn', port: 55000, jobTypes: ["feed"]},
data: {
  port: 55001
}
};

var emitterWorkerConfig = {
name: 'happner-emitter-worker',
queue: {username: '_ADMIN', password: 'happn', port: 55000, jobTypes: ["emitter"]},
data: {
  port: 55002
}
};

service
.queue(queueConfig)
.then(function () {
  return service.worker(subscriberWorkerConfig);
})
.then(function () {
  return service.worker(emitterWorkerConfig);
})
.then(function () {
  return service.emitter(emitterWorkerConfig);
})
.then(function () {
  return service.subscriber(subscriberConfig);
})
.then(function () {

//we now have a mesh that has all the components necessary to create feeds and transfer data from the production environment to the feeds warehouse

});


```

#### running just one component (in this case the feed component) in an existing mesh:

```bash

npm i happner-elastic-feed --save

```

```javascript

var Service = require('happner-elastic-feed');

var config = {};

if (!config.data) config.data = {};

if (!config.data.port) config.data.port = 55000;

if (!config.name)  config.name = 'happner-elastic-feed';

var feedFactory = new Service();

var hapnnerConfig = {
name: config.name,
happn: {
  port: config.data.port,
  secure: true
},
modules: {
  "feed": {
    instance: feedFactory.instantiateServiceInstance(feedFactory.Feed)
  }
},
components: {
  "feed": {
    startMethod: "initialize",
    stopMethod: "stop",
    accessLevel: "mesh"
  }
}
};

var Mesh = require('happner-2');

Mesh.create(hapnnerConfig, function (err, instance) {

if (err) return done(err);

var feedRandomName = uuid.v4();

var feedData = {
  action: 'create',
  name: 'Test feed ' + feedRandomName,
  datapaths: [
    '/test/path/1/*',
    '/device/2/*',
    '/device/3/*'
  ]
};

instance.exchange.feed.upsert(feedData)
  .then(function (upserted) {
    //TODO://verify the upserted feed

    instance.stop({}, done);
  })
  .catch(done);
});

```

#### running the proxy component:

```bash

npm i happner-elastic-feed --save

```

```javascript

//starts the proxy service, we test pushing requests through it to elasticsearch, default listen port 55555 and target http://localhost:9200

var Service = require('happner-elastic-feed');

var proxyConfig = {};

var proxyService = new Service();

var http = require('http');

proxyService

    .proxy(proxyConfig)

    .then(function () {

      http.get({
        host: 'localhost',
        port: 55555,
        path: '/_cat/indices?v'
      }, function(res) {

        var body = '';

        res.on('data', function(chunk) {
          body += chunk;
        });

        res.on('end', function() {

          console.log('successfully queried :::', body);

          proxyService.stop()
            .then(function(){
              done();
            })
            .catch(done)
        });

      }).on('error', function(e) {
        done(e);
      });
    })
    .catch(function(e){
      done(e);
    })


```

for detailed proxy usage [have a look at the tests](https://github.com/happner/happner-elastic-feed/blob/master/test/1-func.js#L671).

Happner setup instructions in more detail [here](https://github.com/happner/happner/blob/master/docs/walkthrough/the-basics.md).

### performance testing and the analyzer service:

have not separated this into its own module yet, but this analyzer allows us to add tags to our methods and then report on the average time it takes for the method to execute, this produces an output that is much easier to use than a flame graph.
Tags are special comments that mark where you want to start measuring average function time, and where you want to end measuring (promise.resolve, callback or sync return)

Example of tagged method:

```javascript

//[start:{"key":"initialize", "self":"_this"}:start]

function initialize($happn) {

  var _this = this;

  //[start:{"key":"initialize", "self":"_this"}:start]

  return new Promise(function (resolve, reject) {

    _this
      .__connectQueue($happn)
      .then(function () {
        return _this.__connectFeeds($happn);
      })
      .then(function () {
        return _this.__subscribe($happn);
      })
      .then(function (result) {
        //[end:{"key":"initialize", "self":"_this"}:end]
        resolve(result);
      })
      .catch(function (e) {
        //[end:{"key":"initialize", "self":"_this", "error":"e"}:end]
        reject(e);
      });
  });
}

```

the output tree, in the format Class/Method/[Average time spent] in milliseconds looks like this:

```javascript
{ Queue:
   { __connect: 1,
     listen: 0,
     initialize: 1,
     unAssignJobs: 0,
     reAssignJobs: 0,
     attach: 0.5,
     emit: 8.55,
     __storeNewBatch: 2.38,
     createBatch: 3.35,
     getBatch: 1.825,
     __validateJobBatch: 0.01,
     __updateJobBatch: 2.1,
     __saveNewJob: 8.71,
     __serializeJob: 0.013333333333333334,
     createJob: 12.26,
     getLeastBusyWorker: 0.01,
     __updateStateMetric: 0.03,
     __assignJob: 0.05,
     pop: 0.0891089108910891,
     updateBatch: 5.38,
     getBusyJob: 0,
     findWorker: 0.005,
     __removeBusyJob: 0.05,
     updateBusyJob: 0.44,
     __cleanupJobDB: 3.98 },
  Subscriber:
   { __connectFeeds: 2,
     __subscribe: 1,
     initialize: 3,
     __updateFeed: 0,
     __createJobs: 0,
     __persistBatch: 141.62,
     __persistBatches: 141.71 } }
```

You start your service with methodDurationMetrics: true, to get an analysis of tagged methods, see the [perf test](https://github.com/happner/happner-elastic-feed/blob/master/test/perf.js#L396) to understand how to do this.

###NB: please dont remove tag comments as they will be used to guide us in future optimisations.

### TODOS:

- finish performance analysis tagging
- use jobs without batches to increase performance
- no longer create a new index for every feed
- create proxy with permissions check