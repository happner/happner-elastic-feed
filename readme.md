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
1: queue -
2. subscriber -
3. emitter -
4. portal -

### detailed premise for this architecture

#### system is a collection of happner components:

Happner setup instructions in more detail [here](https://github.com/happner/happner/blob/master/docs/walkthrough/the-basics.md).

### performance testing and the analyzer service: