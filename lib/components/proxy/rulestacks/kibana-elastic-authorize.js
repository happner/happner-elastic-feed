module.exports = [
  {
    processor: require('../rules/kibana-elastic-secret').create(),
    consequence: {
      nomatch: {
        action: "deny",
        message: 'missing secret header',
        terminate: true
      }
    }
  },
  {
    name: 'kibana-elastic-excluded-url',
    processor: require('../rules/passthrough').create(),
    consequence: {
      match: {
        action: 'allow',
        terminate: true
      }
    },
    settings: {
      urls: [
        '/_cluster/health/.kibana?timeout=5s',
        '/_nodes/_local?filter_path=nodes.*.settings.tribe',
        '/_nodes?filter_path=nodes.*.version%2Cnodes.*.http.publish_address%2Cnodes.*.ip',
        'POST:/.kibana/config/_search',
        '/.kibana',
        '/.kibana/config/5.4.2/_create'
      ]
    }
  },
  {
    name: 'parse-body',
    processor: require('../rules/parse-body').create()
  },
  {
    name:'kibana-elastic-keepalives',
    processor: require('../rules/kibana-elastic-keepalives').create(),
    consequence: {
      match: {
        action: 'allow',
        terminate: true
      }
    }
  },
  {
    name:'kibana-elastic-config',
    processor: require('../rules/kibana-elastic-config').create(),
    consequence: {
      match: {
        action: 'allow',
        terminate: true
      }
    }
  },
  {
    name: 'kibana-elastic-happn-token',
    processor: require('../rules/happn-token').create(),
    consequence: {
      nomatch: {
        action: "deny",
        event: 'happn-token-missing',
        message: 'missing happn_token',
        terminate: true
      }
    }
  },
  {
    name: 'kibana-elastic-happn-session',
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
    name: 'kibana-elastic-permissions',
    processor: require('../rules/happn-permissions').create(),
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
    name: 'kibana-elastic-authorize',
    processor: require('../rules/kibana-elastic-authorize').create(),
    consequence: {
      nomatch: {
        action: "deny",
        message: 'no permission to access resource'
      }
    }
  },
  {
    name: 'kibana-elastic-default',
    consequence: {
      action: "allow",
      event: 'default-rule-reached',
      message: 'default-rule-reached',
      terminate: true
    }
  }
];