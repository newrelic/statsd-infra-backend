## Overview

StatsD backend for sending metrics to New Relic Infrastructure

## Requirements

* StatsD versions >= 0.3.0.
* New Relic Infrastructure Agent

## Installation

```sh
    $ cd /path/to/statsd
    $ npm install statsd-newrelic-backend
```

## Enabling

1. Add `statsd-newrelic-backend` backend to the list of StatsD backends in the StatsD configuration file.

```js
{
    backends: ["statsd-newrelic-infra-backend"],
}
```

2. Configure the necessary configuration values for running this backend:

```js
    newrelic: {
      port: 5001,
      rules: [
        {
          matchExpression: "myapp.*redis.*",
          metricSchema: "{app}.{environment}.{service}.{serviceName}.{metricName}",
          entityName: "{app}-{environment}",
          entityType: "Redis Cluster",
          eventType: "RedisStatsdSample",
          labels: {
            role: "cache",
            environment: "{environment}"
          }
        }
      ]
    }
```

See our [example config file](exampleConfig.js) for a complete StatsD configuration.

3. Start/restart the StatsD daemon and your metrics should now be pushed to your
New Relic Infrastructure account.

## Development

- Fork and clone this project
- Download project dependencies using `npm`
- Modify the code
- Ensure everything is running properly executing tests: `npm test`
- Push the code to your fork
- Send a Pull Request

## License

New Relic Infrastructure Backend for StatsD is free-to-use, proprietary
software. Please see the full license (found in [LICENSE](LICENSE) in this
distribution) for details on its license and the licenses of its dependencies.
