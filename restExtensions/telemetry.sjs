/**
 * REST API Extension for Telemetry services
 *
 * @author Brad Mann brad.mann@marklogic.com
 */

var rest = require('/lib/restLib.sjs');
var telemetry = require('/lib/telemetryLib.sjs');

function get(context, params) {
	var data = rest.required('data');
	context.outputTypes = ['application/json'];

	if (data == 'searchTermFrequencies') {
		var begin = xs.dateTime(rest.required('begin'));
		var end = xs.dateTime(rest.required('end'));
		var terms = telemetry.getSearchTermFrequencies(begin, end);
		return xdmp.arrayValues([{results: terms}]);
	} else if (data == 'userTimeseries' || data == 'requestTimeseries') {
		var type = (data == 'userTimeseries') ? 'distinct' : 'aggregate';
		data = (data == 'userTimeseries') ? 'user' : 'request';
		var period = xs.duration(rest.get('period', 'P1Y'));
		var begin = xs.dateTime(rest.get('begin', '2016-01-01T00:00:00Z'));
		var end = xs.dateTime(rest.get('end', '2017-01-01T00:00:00Z'));
		var counts = telemetry.getTimeseriesData(data, begin, end, period, null, type);
		return xdmp.arrayValues([{results: counts}]);
	} else if (data == 'serviceTimeseries') {
		data = 'request';
		var period = xs.duration(rest.get('period', 'P1Y'));
		var begin = xs.dateTime(rest.get('begin', '2016-01-01T00:00:00Z'));
		var end = xs.dateTime(rest.get('end', '2017-01-01T00:00:00Z'));
		var service = rest.required('service');
		var serviceQuery = cts.pathRangeQuery('fn:collection("telemetry")/path', '=', service);
		var counts = telemetry.getTimeseriesData(data, begin, end, period, serviceQuery);
		return xdmp.arrayValues([{results: counts}]);
	} else if (data == 'serviceList') {
		var services = cts.values(cts.pathReference('fn:collection("telemetry")/path'), null, null, cts.collectionQuery('telemetry')).toArray();
		return xdmp.arrayValues([{results: services}]);
	} else if (data == 'servicePerformance') {
		var begin = xs.dateTime(rest.get('begin', '2016-01-01T00:00:00Z'));
		var end = xs.dateTime(rest.get('end', '2017-01-01T00:00:00Z'));
		var services = cts.values(cts.pathReference('fn:collection("telemetry")/path'), null, null, cts.collectionQuery('telemetry'));
		var results = {};
		for (var service of services) {
			results[service] = telemetry.getServicePerformance(service, begin, end);
		}
		return xdmp.arrayValues([{results: results}]);
	}
}

function post(context, params) {
	var action = rest.required('action');
	if (action == 'write') {
		xdmp.invokeFunction(
			function() {
				telemetry.write();
			},
			{transactionMode: 'update-auto-commit'}
		);
	}
	context.outputTypes = ['application/json'];
	return xdmp.arrayValues([{success: true}]);
}

exports.POST = post;
exports.GET = get