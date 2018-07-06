{
  debug: false,
  port: 8125,
  backends: [ "@newrelic/statsd-infra-backend" ],
  newrelic: {
    port: 8001,
    host: "localhost",
    rules: [
      {
        matchExpression: "app1.production.localhost.sample_metric",
        metricSchema: "{app}.{environment}.{hostname}.{metricName}",
        eventType: "MyorgApplicationSample",
        labels: {
          role: "test",
          environment: "{environment}"
        }
      },
    ]
  }
}
