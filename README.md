## Overview

StatsD backend for sending metrics to New Relic Infrastructure

## Requirements

* StatsD versions >= 0.3.0.
* New Relic Infrastructure Agent >= v1.0.818

## Installation

```sh
    $ cd /path/to/statsd
    $ npm install @newrelic/statsd-infra-backend
```

## Enabling

1. Add `@newrelic/statsd-infra-backend` backend to the list of StatsD backends in the StatsD configuration file.

```js
{
    backends: ["@newrelic/statsd-infra-backend"],
}
```

2. Configure the necessary configuration values for running this backend:

```js
    newrelic: {
      port: 8001,
      rules: [
        {
          matchExpression: "myapp.*redis.*",
          metricSchema: "{app}.{environment}.{service}.{serviceName}.{metricName}",
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

## Release

- Update the `CHANGELOG.md` file with all the info about the new release.
- Run `npm run release`. Check
  [this](https://github.com/conventional-changelog/standard-version#release-as-a-target-type-imperatively-like-npm-version)
  too see all the different options for this command.
- Run `git push --follow-tags origin master && npm publish` to publish the package
- Create the github release pointing to the tag created by `npm run release`

## License

New Relic Infrastructure Backend for StatsD is free-to-use, proprietary
software. Please see the full license (found in [LICENSE](LICENSE) in this
distribution) for details on its license and the licenses of its dependencies.
