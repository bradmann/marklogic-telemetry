/**
 * Scheduled task for writing telemetry server fields to the db.
 *
 * @author Brad Mann brad.mann@marklogic.com
 */

var authMethod = 'basic';
var httpOptions = {authentication: {method: authMethod, username: config.user, password: config.password}};

xdmp.httpPost(config.serverProtocol + '://localhost:' + config.serverPort + '/v1/resources/telemetry?action=write', httpOptions);