[![New Relic Community Plus header](https://raw.githubusercontent.com/newrelic/open-source-office/master/examples/categories/images/Community_Plus.png)](https://opensource.newrelic.com/oss-category/#community-plus)

# StatsD backend for sending metrics to New Relic

## Requirements

* StatsD v0.3.0 or higher
* New Relic infrastructure Agent v1.0.818 or higher

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

3. Start/restart the StatsD daemon

Your metrics should now be pushed to your New Relic account.

## Development

- Fork and clone this project.
- Download project dependencies using `npm`.
- Modify the code.
- Ensure everything is running properly executing tests: `npm test`.
- Push the code to your fork.
- Send a Pull Request.

## Release

- Update the `CHANGELOG.md` file with all the info about the new release.
- Run `npm run release`. Check
  [this](https://github.com/conventional-changelog/standard-version#release-as-a-target-type-imperatively-like-npm-version)
  too see all the different options for this command.
- Run `git push --follow-tags origin master && npm publish` to publish the package.
- Create the github release pointing to the tag created by `npm run release`.

**Support Channels**

* [New Relic Documentation](https://docs.newrelic.com): Comprehensive guidance for using our platform
* [New Relic Community](https://discuss.newrelic.com): The best place to engage in troubleshooting questions
* [New Relic Developer](https://developer.newrelic.com/): Resources for building a custom observability applications
* [New Relic University](https://learn.newrelic.com/): A range of online training for New Relic users of every level
* [New Relic Technical Support](https://support.newrelic.com/) 24/7/365 ticketed support. Read more about our [Technical Support Offerings](https://docs.newrelic.com/docs/licenses/license-information/general-usage-licenses/support-plan).

## Privacy

At New Relic we take your privacy and the security of your information seriously, and are committed to protecting your information. We must emphasize the importance of not sharing personal data in public forums, and ask all users to scrub logs and diagnostic information for sensitive information, whether personal, proprietary, or otherwise.

We define “Personal Data” as any information relating to an identified or identifiable individual, including, for example, your name, phone number, post code or zip code, Device ID, IP address, and email address.

For more information, review [New Relic’s General Data Privacy Notice](https://newrelic.com/termsandconditions/privacy).

## Contribute

We encourage your contributions to improve this project! Keep in mind that when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.

If you have any questions, or to execute our corporate CLA (which is required if your contribution is on behalf of a company), drop us an email at opensource@newrelic.com.

**A note about vulnerabilities**

As noted in our [security policy](../../security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through [HackerOne](https://hackerone.com/newrelic).

If you would like to contribute to this project, review [these guidelines](./CONTRIBUTING.md).

To all contributors, we thank you!  Without your contribution, this project would not be what it is today.

## License

StatsD-infra-backend is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.
