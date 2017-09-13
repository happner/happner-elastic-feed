module.exports = [
  {
    name: 'browser-kibana-excluded-url',
    processor: require('../rules/passthrough').create(),
    consequence: {
      match: {
        action: 'proxy',
        terminate: true
      }
    },
    settings:{
      urls:[
        '/_cluster/health/.kibana?timeout=5s',
        '/_nodes/_local?filter_path=nodes.*.settings.tribe',
        '/_nodes?filter_path=nodes.*.version%2Cnodes.*.http.publish_address%2Cnodes.*.ip',
        '/.kibana/config/_search'
      ]
    }
  },
  {
    name: 'browser-kibana-happn-token',
    processor: require('../rules/happn-token').create(),
    consequence: {
      nomatch: {
        action: "deny",
        event: 'happn-token-missing',
        message: 'missing happn-token',
        terminate: true
      }
    }
  },
  {
    name: 'browser-kibana-authorize',
    processor: require('../rules/happn-session').create(),
    consequence: {
      nomatch: {
        action: "deny",
        event: 'authorization-failed',
        message: 'authorization failed',
        terminate: true
      }
    }
  },
  {
    name: 'browser-kibana-default',
    consequence: {
      action: "proxy",
      event: 'default-rule-reached',
      message: 'default-rule-reached',
      terminate: true
    }
  }
];