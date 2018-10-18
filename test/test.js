process.env.NODE_ENV = 'test';

const assert = require('assert');
const events = require('events');
const nri = require('../lib/newrelic-infra.js');
const util = require('util');
const nock = require('nock');

describe('New Relic Infrastructure StatsD Backend', function () {
  before(function () {
    nock.disableNetConnect();
  });
  const defaultConfig = {
    debug: false,
    newrelic: {
      port: 9070,
      rules: [{
        matchExpression: '.*',
        metricSchema: '{metricName}',
        entityType: 'foo',
        entityName: 'bar',
        eventType: 'Example'
      }]
    }
  };
  const defaultIntegration = {
    name: 'com.newrelic.statsd',
    integration_version: '0.1.0',
    protocol_version: '1',
    metrics: [],
    inventory: {},
    events: []
  };

  describe('nriInitBackend', function () {
    const timestamp = 12345;

    it('no matching rules', function () {
      const emitter = new events.EventEmitter();
      const config = Object.assign({}, defaultConfig);
      config.newrelic.rules = [{
        matchExpression: '.*redis.*',
        metricSchema: '{app}.{service}.{metricName}',
        entityType: 'Redis Cluster',
        entityName: 'Production Host1',
        eventType: 'RedisSample'
      }];

      const metrics = {
        gauges: {my_gauge: 1},
        counters: {my_counter: 10},
        counter_rates: {my_counter: 1}
      };
      const httpserver = nock('http://localhost:9070')
        .post('/v1/data')
        .reply(204);

      nri.init(null, config, emitter, util);
      emitter.emit('flush', timestamp, metrics);
      assert.equal(httpserver.isDone(), false);
      nock.cleanAll();
    });

    it('valid matching rules', function (done) {
      const emitter = new events.EventEmitter();
      const config = Object.assign({}, defaultConfig);
      config.newrelic.rules = [{
        matchExpression: '.*redis.*',
        metricSchema: '{app}.{service}.{metricName}',
        entityType: 'Redis Cluster',
        entityName: 'Production Host1',
        eventType: 'RedisSample'
      }];
      const metrics = {
        gauges: {'myapp.redis.my_gauge': 1},
        counters: {'myapp.redis.my_counter': 10},
        counter_rates: {'myapp.redis.my_counter': 1},
        timer_data: {
          'myapp.redis.my_timer': {
            sum: 10,
            mean: 10
          }
        }
      };
      const expected = defaultIntegration;
      expected.metrics = [{
        event_type: 'RedisSample',
        app: 'myapp',
        service: 'redis',
        'my_gauge': 1,
        'my_counter': 10,
        'my_counterPerSecond': 1,
        'my_timer.sum': 10,
        'my_timer.mean': 10
      }];

      const httpserver = nock('http://localhost:9070')
        .post('/v1/data')
        .reply(204, function (uri, requestBody) {
          assert.deepEqual(requestBody, expected);
          done();
        });
      nri.init(null, config, emitter, util);
      emitter.emit('flush', timestamp, metrics);
      assert.equal(httpserver.isDone(), true);
    });

    it('matching rules with invalid metricSchema', function () {
      const emitter = new events.EventEmitter();
      const config = Object.assign({}, defaultConfig);
      config.newrelic.rules = [{
        matchExpression: '.*redis.*',
        metricSchema: '{app}.{service}.{metricName}',
        entityType: 'Redis Cluster',
        entityName: 'Production Host1',
        eventType: 'RedisSample'
      }];

      const metrics = {
        gauges: {'redis.my_gauge': 1}
      };
      const httpserver = nock('http://localhost:9070')
        .post('/v1/data')
        .reply(204);

      nri.init(null, config, emitter, util);
      emitter.emit('flush', timestamp, metrics);
      assert.equal(httpserver.isDone(), false);
      nock.cleanAll();
    });

    it('limit of keys exceeded', function (done) {
      const emitter = new events.EventEmitter();
      const config = Object.assign({}, defaultConfig);
      const metricsLimit = 2;
      config.newrelic.rules = [{
        matchExpression: '.*redis.*',
        metricSchema: '{app}.{service}.{metricName}',
        entityType: 'Redis Cluster',
        entityName: 'Production Host1',
        eventType: 'RedisSample'
      }];
      config.newrelic.metricsLimit = metricsLimit;
      const metrics = {
        gauges: {'myapp.redis.my_gauge': 1},
        counters: {'myapp.redis.my_counter': 10},
        counter_rates: {'myapp.redis.my_counter': 1},
        timer_data: {
          'myapp.redis.my_timer': {
            sum: 10,
            mean: 10
          }
        }
      };
      const expected = defaultIntegration;
      expected.metrics = [{event_type: 'StatsdLimitErrorSample', numberOfMetrics: 7, configuredLimit: metricsLimit}];
      const httpserver = nock('http://localhost:9070')
        .post('/v1/data')
        .reply(204, function (uri, requestBody) {
          assert.deepEqual(requestBody, expected);
          done();
        });
      nri.init(null, config, emitter, util);
      emitter.emit('flush', timestamp, metrics);
      assert.equal(httpserver.isDone(), true);
    });

    it('nomad telemetry', function (done) {
      const emitter = new events.EventEmitter();
      const config = Object.assign({}, defaultConfig);
      config.newrelic.rules = [{
        matchExpression: 'nomad.client.allocs.cpu.*',
        metricSchema: "{app}.{client}.{type}.{resource}.{metricName}.{jobName}.{taskGroupName}.{allocationID}.{taskName}.{ipAddress}",
        entityType: 'Nomad telemetry',
        entityName: 'Production Host1',
        eventType: 'eventFoo'
      }];
      const metrics = {
        gauges: {
          'nomad.client.allocs.cpu.total_percent.job-a.task-group-b.xxx-yyy.task-a.ip-foo-bar': 0.58028,
          'nomad.client.allocs.cpu.total_percent.job-b.task-group-b.yyy-zzz.task-b.ip-foo-bar': 0.026463
        }
      };
      const expected = defaultIntegration;
      expected.metrics = [
        {
          event_type: "eventFoo",
          app: "nomad",
          client: "client",
          type: "allocs",
          ipAddress: "ip-foo-bar",
          jobName: "job-a",
          resource: "cpu",
          taskGroupName: "task-group-a",
          allocationID: "xxx-yyy",
          taskName: "task-a",
          total_percent: 0.58028
        }, {
          event_type: "eventFoo",
          app: "nomad",
          type: "allocs",
          client: "client",
          ipAddress: "ip-foo-bar",
          jobName: "job-b",
          resource: "cpu",
          taskGroupName: "task-group-b",
          allocationID: "yyy-zzz",
          taskName: "task-b",
          total_percent: 0.026463
        }
      ];

      const httpserver = nock('http://localhost:9070')
        .post('/v1/data')
        .reply(204, function (uri, requestBody) {
          assert.deepEqual(requestBody, expected);
          done();
        });
      nri.init(null, config, emitter, util);
      emitter.emit('flush', timestamp, metrics);
      assert.equal(httpserver.isDone(), true);
    });

  });
});
