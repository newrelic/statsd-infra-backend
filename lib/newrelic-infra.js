/* jshint node:true, laxcomma:true */

/*
 * Flush stats to New Relic Infrastucture Agent.
 *
 * To enable this backend, include 'newrelic-infra' in the backends
 * configuration array:
 *
 *   backends: ['newrelic-infra']
 *
 * This backend supports the following config options in 'newrelic' key:
 *
 *   port: Port where Infrastructure Agent is listening. Defaults to '9070'.
 *   rules: A list of rules to convert StatsD metrics and compose New Relic
 *          Infrastructure payloads.
 *
 */

'use strict';

const http = require('http');

let l;
let debug;
const host = 'localhost';
let port;
const sendTimeoutInSeconds = 1;
let rules = [];
let metricsLimit;
let sendLimitErrors;
const nriStats = {};

const sendPayload = function nriSend(host, port, payload) {
  if (debug) {
    l.log(`Sending payload: ${payload}`);
  }
  const startTime = new Date().getTime();
  const options = {
    host: host,
    port: port,
    path: '/data',
    method: 'POST',
    headers: {
      'Content-Length': payload.length,
      'Content-Type': 'application/json',
      'User-Agent': 'StatsD-backend'
    }
  };
  const req = http.request(options, function(res) {
    res.on('end', function() {
      if (Math.floor(res.statusCode / 100) === 2) {
        if (debug) {
          l.log('Payload sent successfully');
        }
      }
    });
    res.on('data', function(d) {
      switch (Math.floor(res.statusCode / 100)) {
      case 5:
        if (debug) {
          l.log(`Unexpected error from New Relic Infrastructure Agent. HTTP ${res.statusCode} Error: '${d}'`);
        }
        nriStats.last_exception = Math.round(new Date().getTime() / 1000);
        break;
      case 4:
        if (debug) {
          l.log(`Error sending JSON payload to New Relic Infrastructure Agent. HTTP ${res.statusCode} Error: '${d}'`);
        }
        nriStats.last_exception = Math.round(new Date().getTime() / 1000);
        break;
      default:
        if (debug) {
          l.log(`Unexpected response from New Relic Infrastructure Agent. HTTP ${res.statusCode} Response: '${d}'`);
        }
      }
    });
  });
  req.on('error', function(e) {
    if (debug) {
      l.log(`Unexepected error requesting NR Agent: ${e.message}`);
    }
  });
  req.setTimeout(sendTimeoutInSeconds * 1000, function() {
    if (debug) {
      l.log('Request timed out sending JSON payload to New Relic Infrastructure agent');
    }
    req.end();
  });
  req.write(payload);
  req.end();
  nriStats.flush_time = Math.round(new Date().getTime() - startTime);
  nriStats.flush_length = payload.length;
  nriStats.last_flush = Math.round(new Date().getTime() / 1000);
};

const collectMetrics = function nriCollectMetrics(rawMetrics, rules) {
  const gauges = rawMetrics.gauges || {};
  const counters = rawMetrics.counters || {};
  const counterRates = rawMetrics.counter_rates;
  const timerData = rawMetrics.timer_data || {};
  const sets = rawMetrics.sets || {};
  const data = {};

  const ruleTemplate = function evalSchema(tpl, metricData) {
    const re = /{([^}]+)?}/g;
    let match;
    let result = tpl;
    while ((match = re.exec(tpl))) {
      result = result.replace(match[0], metricData[match[1]]);
    }
    return result;
  };
  const validateKeyWithSchema = function validate(key, schema) {
    const splittedSchema = schema.split('.');
    const splittedKey = key.split('.');

    return splittedKey.length >= splittedSchema.length;
  };
  const extractSchemaFields = function(key, schema) {
    const splittedSchema = schema.split('.');
    const splittedKey = key.split('.');
    const fields = {};
    splittedSchema.forEach(function(sword, idx) {
      let word = sword.match(/{([^}]*).*/);
      let value;
      if (word !== null) {
        word = word[1];
        if (idx + 1 === splittedSchema.length && idx + 1 < splittedKey.length) {
          value = splittedKey.slice(idx, splittedKey.length).join('.');
        } else {
          value = splittedKey[idx];
        }
        fields[word] = value;
      }
    });
    return fields;
  };
  const evalRule = function evalRule(rule, metricName, value) {
    var re = new RegExp(rule.matchExpression);
    let found = re.test(metricName);

    if (found) {
      if (validateKeyWithSchema(metricName, rule.metricSchema)) {
        var metricFields = extractSchemaFields(metricName, rule.metricSchema);
        var eventType = rule.eventType;
        if (eventType.match(/{.*}/) && debug) {
          l.log('You can\'t use variable substitutions for EventType: ${rule.eventType}');
        }
        var entityName = ruleTemplate(rule.entityName, metricFields);
        var entityType = ruleTemplate(rule.entityType, metricFields);
        var entityId = `${entityType}:${entityName}`;

        metricFields[metricFields.metricName] = value;
        delete metricFields.metricName;

        if (data.hasOwnProperty(entityId)) {
          if (!data[entityId].metrics.hasOwnProperty(eventType)) {
            data[entityId].metrics[eventType] = {};
          }
          data[entityId].metrics[eventType] = Object.assign(
            data[entityId].metrics[eventType],
            metricFields
          );
        } else {
          data[entityId] = {
            entity: { name: entityName, type: entityType },
            metrics: {}
          };
          data[entityId].metrics[eventType] = metricFields;
        }

        Object.keys(rule.labels || {}).forEach(function(label) {
          data[entityId].metrics[eventType][`label.${label}`] = ruleTemplate(rule.labels[label], metricFields);
        });
      } else if (debug) {
        l.log(`It isn't possible to compose and event for key '${metricName}'. It has less elements than metric schema: '${rule.metricSchema}'.`);
      }
    }

    return found;
  };

  if (debug) {
    let expressions = rules.map(function(rule) { return rule.matchExpression; });
    l.log('Matching keys against rule expressions: [' + expressions.join(', ') + ']');
  }

  let matchedKeys = 0;

  Object.keys(counters).forEach(function(metricName) {
    rules.some(function(rule) {
      if (evalRule(rule, metricName, counters[metricName])) {
        evalRule(rule, `${metricName}PerSecond`, counterRates[metricName]);
        matchedKeys++;
      }
    });
  });

  Object.keys(timerData).forEach(function(metricName) {
    rules.some(function(rule) {
      Object.keys(timerData[metricName]).forEach(function(timerKey) {
        evalRule(rule, `${metricName}.${timerKey}`, timerData[metricName][timerKey]);
      });
    });
  });

  Object.keys(gauges).forEach(function(metricName) {
    rules.some(function(rule) {
      evalRule(rule, metricName, gauges[metricName]);
    });
  });

  Object.keys(sets).forEach(function(metricName) {
    rules.some(function(rule) {
      evalRule(rule, `${metricName}.count`, sets[metricName].size());
    });
  });

  if (debug) {
    const totalKeys = Object.keys(counters).length + Object.keys(timerData).length + Object.keys(gauges).length + Object.keys(sets).length;
    l.log(`Matched keys ${matchedKeys}. Total keys: ${totalKeys}`);
  }

  return data;
};

const composePayload = function nriPayload(data) {
  const defaultIntegration = {
    name: 'com.newrelic.statsd',
    integration_version: '0.1.0',
    protocol_version: '1'
  };

  const v1Payload = function(v1data) {
    const integration = Object.assign({}, defaultIntegration);
    const metricSets = [];

    Object.keys(v1data).forEach(function(entityId) {
      const metrics = v1data[entityId].metrics;
      Object.keys(metrics).forEach(function(eventType) {
        const values = metrics[eventType];
        const metricsLength = Object.keys(values).length;

        if (metricsLength > metricsLimit) {
          if (sendLimitErrors) {
            metricSets.push(
              {
                event_type: "StatsdLimitErrorSample",
                entityName: entityId,
                numberOfMetrics: metricsLength,
                configuredLimit: metricsLimit,
              }
            )
          }
          if (debug) {
            l.log(`The event has more than ${metricsLimit} metrics and can't be processed. Metrics length: ${metricsLength}`);
          }
          nriStats.last_exception = Math.round(new Date().getTime() / 1000);
        } else {
          metricSets.push(
            Object.assign(
              {
                event_type: eventType,
                entityName: entityId
              },
              values
            )
          );
        }
      });
    });
    return Object.assign(integration, { metrics: metricSets, inventory: {}, events: [] });
  };

  const v2Payload = function(v2data) {
    const integration = Object.assign({}, defaultIntegration);
    const entitiesData = [];

    Object.keys(v2data).forEach(function(entityId) {
      const metrics = v2data[entityId].metrics;
      const metricSets = [];
      Object.keys(metrics).forEach(function(eventType) {
        const values = metrics[eventType];
        const metricsLength = Object.keys(values).length;
        if (metricsLength > metricsLimit) {
          if (sendLimitErrors) {
            metricSets.push(
              {
                event_type: "StatsdLimitErrorSample",
                numberOfMetrics: metricsLength,
                configuredLimit: metricsLimit
              }
            );
          }
          if (debug) {
            l.log(`The event has more than ${metricsLimit} metrics and can't be processed. Metrics length: ${metricsLength}`);
          }
        } else {
          metricSets.push(Object.assign({ event_type: eventType }, values));
        }
      });

      entitiesData.push({
        entity: v2data[entityId].entity,
        metrics: metricSets,
        events: [],
        inventory: {}
      });
    });

    return Object.assign({}, integration, { protocol_version: '2', data: entitiesData });
  };

  return v2Payload(data);
};

const flushMetrics = function nriFlush(timestamp, rawMetrics) {
  if (rules.length === 0 && debug) {
    l.log('There are not rules configured for backend `newrelic`. Without rules, we can not know how to process and send StatsD metrics to New Relic Infrastructure. ');
  }
  const metricsByEntity = collectMetrics(rawMetrics, rules);
  const payload = composePayload(metricsByEntity);

  if ((payload.metrics && payload.metrics.length > 0) || (payload.data && payload.data.length > 0))  {
    sendPayload(host, port, JSON.stringify(payload));
  }

  return payload;
};

const backendStatus = function nriBackendStatus(writeCb) {
  Object.keys().forEach(function(stat) {
    writeCb(null, 'newrelic', stat, nriStats[stat]);
  });
};

if (process.env.NODE_ENV === 'test') {
  exports.flushMetrics = flushMetrics;
}

exports.init = function nriInitBackend(startupTime, config, events, logger) {
  debug = config.debug;
  if (typeof logger === undefined) {
    l = require('util');
  } else {
    l = logger;
  }

  if (config.newrelic) {
    port = Number(config.newrelic.port || 9070);
    rules = config.newrelic.rules || [];
    metricsLimit = Number(config.newrelic.metricsLimit || 150)
    if (config.newrelic.sendLimitErrors === undefined) {
      sendLimitErrors = true;
    } else {
      sendLimitErrors = config.newrelic.sendLimitErrors;
    }
  }

  nriStats.last_flush = startupTime;
  nriStats.last_exception = startupTime;

  events.on('flush', flushMetrics);
  events.on('status', backendStatus);
  return true;
};
