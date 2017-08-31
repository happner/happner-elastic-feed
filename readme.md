happner elastic feed
----------------------------
*The happner elastic feed works with the [happner-elastic-dataprovider](https://github.com/happner/elastic-dataprovider) to pull data from a happner instance via the subscription service, and push the data into a feed warehouse. Feeds are generated from the users group permissions to create subscriptions to the data changes in the production happner service, feed data is then made available to a kibana dashboard that is tailor made for the feed data.*

### prerequisites:

#### [elasticsearch 5.4](https://www.elastic.co/blog/elasticsearch-5-4-0-released)

#### [kibana 5.4](https://www.elastic.co/blog/kibana-5-4-0-released)

#### [redis server](https://redis.io/topics/quickstart)

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

for detailed end-to-end use, please look at the sanity tests.

running the whole system as a service:

```bash

```

```javascript



```

running just one component (in this case the feed component) in an existing mesh:

```bash

```

```javascript

```


Happner setup instructions in more detail [here](https://github.com/happner/happner/blob/master/docs/walkthrough/the-basics.md).

### performance testing and the analyzer service:

TBD

### TODOS:

- use jobs without batches to increase performance
- no longer create a new index for every feed
- create proxy with permissions check