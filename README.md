# marklogic-telemetry
JavaScript Application Telemetry for MarkLogic

Telemetry is a group of modules for collecting metrics on all the service calls that hit your MarkLogic application. It can be used to track data such as:
- Metrics on how many users are hitting the application over time, including which users are most active
- Metrics on the number of documents in the system over time
- Metrics about the activities happening in the app, including the activity duration (elapsed time), overall activity over time, and the number of times each activity is performed over a specific timeframe

### Installation
- Copy the files into your project's modules directory.
- For every function you wish to track, use the following syntax:
```
var telemetry = require('/lib/telemetryLib.sjs');

function get(params) {
    // Application logic
}

exports.GET = telemetry.bindTelemetry(get);
```

- Create a scheduled task with the following settings:
  - task path: /scheduledTasks/writeTelemetry.sjs
  - task root: /
  - task type: hourly
  - task period: 1
  - task database: <your app's db name>
  - task modules: <your app's modules>
  - task user: admin
  - task host: <leave blank>
  - task priority: normal

### Scheduled Task
The scheduled task runs every hour and collects the user metrics from memory and writes them to disk.