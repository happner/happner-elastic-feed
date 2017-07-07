happner elastic feed
----------------------------
*The happner elastic feed works with the [happner-elastic-dataprovider](https://github.com/happner/elastic-dataprovider) to pull data from a happner instance via the subscription service, and push the data into a feed warehouse. Feeds are generated from the users group permissions to create subscriptions to the data changes in the warehouse happner service, feed data (obfuscated by a dynamic index name and type name, both uuids) is then made available to a kibana dashboard that is tailor made for the feed data.*

###prerequisites:

###[elasticsearch 5.4](https://www.elastic.co/blog/elasticsearch-5-4-0-released)

###[kibana 5.4](https://www.elastic.co/blog/kibana-5-4-0-released)

###2 happner instances:
1. the warehouse instance (must be running in secure mode), connected to the data warehouse elasticsearch instances
2. the feed instance, connected to a feed elasticsearch instances, which are in turn interrogated by kibana.

### installation instructions:

```bash
#install deps
npm install happner-elastic-feed
#test run - most should pass
mocha test/func

run the service locally:
git clone https://github.com/happner/elastic-feed.git && cd elastic-feed && npm install && node service/start
```
###detailed premise for this architecture

*The [happner].exchange.feed.create is called with teh username you wish to generate the feed for and optionally the dashboard id you want generated for the user, the user is fetched from the security layer and is checked for groups and permissions, the feed is then adapted to subscribe to all paths the user has permissions for (this could also be limited using an optional argument). A [uuid] is generated for the feed, and a jwt token wraps the uuid and the user name, this token can be used to access the feed portal, which is able to decde the token and redirect the user to the appropriate feed URL on an iframe containing the user dashboard, in the background the feed dashboard has been cloned and made ready as well, the data that comes in via the feed subscriptions is batched and then pushed to the feed queue, where it will land up in the feed indexes and types so te data can appear in the users customised dashboard.*

Happner setup instructions in more detail [here](https://github.com/happner/happner/blob/master/docs/walkthrough/the-basics.md).