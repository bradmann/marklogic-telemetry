/**
 * Library with support functions for collecting application telemetry
 *
 * @author Brad Mann brad.mann@marklogic.com
 */

var pathRefereneces = {
	'user': '/path/to/user/node',
	'request': '/path/to/requestId/node',
	'query': '/path/to/query/node'
};

// Function for collecting a telemetry per request. Writes the data to a server field.
// If the server field gets too big, it calls the scheduled task to flush the field
// to disk.
function collect(timestamp, method, path, headers, parameters, duration) {
	xdmp.invokeFunction(
		function() {
			var fieldUri = '/telemetry/serverField/' + xdmp.host();
			xdmp.lockForUpdate(fieldUri);
			var uuid = sem.uuidString();
			var telemetryDoc = {
				uuid: uuid,
				timestamp: timestamp,
				method: method,
				path: path,
				headers: headers,
				parameters: parameters,
				duration: duration
			};
			var telemetryObj = fn.head(xdmp.getServerField(fieldUri)) || {__size: 0};
			telemetryObj[uuid] = telemetryDoc;
			telemetryObj.__size += 1;
			xdmp.setServerField(fieldUri, xdmp.arrayValues([telemetryObj]));
			// Don't let this object get too big in memory.
			if (telemetryObj.__size >= 100000) {
				xdmp.spawn('/scheduledTasks/writeTelemetry.sjs', null, null);
			}
		},
		{transactionMode: 'update-auto-commit'}
	);
}

// Function to flush server fields to documents on disk
function write() {
	var telemetryData = 
		fn.head(xdmp.invokeFunction(
			function() {
				var fieldUri = '/telemetry/serverField/' + xdmp.host();
				xdmp.lockForUpdate(fieldUri);
				var field = fn.head(xdmp.getServerField(fieldUri)) || {__size: 0};
				xdmp.setServerField(fieldUri, {__size: 0});
				return field;
			},
			{transactionMode: 'update-auto-commit'}
		));

	Object.keys(telemetryData).forEach(function(uuid) {
		if (uuid == '__size') {
			return;
		}

		xdmp.documentInsert(
			'/telemetry/' + xdmp.host() + '/' + uuid + '.json',
			telemetryData[uuid],
			[{capability: 'read', roleId: xdmp.role('telemetry-role')}],
			'telemetry'
		);
	});
}

// Function for getting frequencies of search terms
function getSearchTermFrequencies(begin, end) {
	var query =
		cts.andQuery([
			cts.collectionQuery('telemetry'),
			cts.jsonPropertyRangeQuery('timestamp', '>=', begin),
			cts.jsonPropertyRangeQuery('timestamp', '<', end)
		]);
	xdmp.log(query);
	var terms =
		cts.values(
			cts.pathReference(pathRefereneces['query']),
			null,
			['item-frequency', 'frequency-order', 'limit=100'],
			query
		);
	xdmp.log(terms);
	var termFrequencies = [];
	for (var term of terms) {
		termFrequencies.push([term, cts.frequency(term)]);
	}
	return termFrequencies;
}

// Function for getting timeseries data
function getTimeseriesData(data, begin, end, period, additionalQuery, type) {
	var path = pathRefereneces[data];
	var counts = {};
	while (begin.lt(end)) {
		var queries = [
			cts.collectionQuery('telemetry'),
			cts.jsonPropertyRangeQuery('timestamp', '>=', begin),
			cts.jsonPropertyRangeQuery('timestamp', '<', begin.add(period))
		];
		if (additionalQuery) {
			queries.push(additionalQuery);
		}
		var query = cts.andQuery(queries);
		var count = (type == 'distinct') ? 
			fn.count(cts.values(cts.pathReference(path), null, null, query)) :
			cts.countAggregate(cts.pathReference(path), ['item-frequency'], query);
		counts[begin] = count;
		begin = begin.add(period);
	}
	return counts;
}

function getServicePerformance(service, begin, end) {
	var query = cts.andQuery([
		cts.pathRangeQuery('fn:collection("telemetry")/path', '=', service),
		cts.jsonPropertyRangeQuery('timestamp', '>=', begin),
		cts.jsonPropertyRangeQuery('timestamp', '<', end)
	]);
	var max = cts.max(cts.pathReference('fn:collection("telemetry")/duration'), ['item-frequency'], query);
	var min = cts.min(cts.pathReference('fn:collection("telemetry")/duration'), ['item-frequency'], query);
	var durations = cts.values(cts.pathReference('fn:collection("telemetry")/duration'), null, ['item-frequency'], query).toArray();
	var median = cts.median(durations);
	var lq = cts.median(durations.filter(function(duration){return duration < median}));
	var uq = cts.median(durations.filter(function(duration){return duration > median}));
	return {max: max, min: min, median: median, lq: lq, uq: uq};
}

function bindTelemetry(func) {
	var wrap = function(context, params, content) {
		var requestMethod = xdmp.getRequestMethod();
		var requestBody = xdmp.getRequestBody();
		var requestPath = xdmp.getOriginalUrl().split('?')[0];
		var requestParams = {};
		for (var fieldName of xdmp.getRequestFieldNames()) {
			requestParams[fieldName] = xdmp.getRequestField(fieldName);
		}

		if (requestBody && (xdmp.getRequestHeader('Content-Type') == 'application/json')) {
			var obj = requestBody.toObject();
			obj = (obj !== null && typeof obj === 'object') ? obj : {};
			Object.keys(obj).forEach(function(fieldName) {
				requestParams[fieldName] = obj[fieldName];
			});
		}

		var requestHeaders = {};
		for (var headerName of xdmp.getRequestHeaderNames()) {
			requestHeaders[headerName] = fn.head(xdmp.getRequestHeader(headerName));
		}
		xdmp.log('REST CALL: ' + requestMethod + ' ' + requestPath, 'debug');
		xdmp.log('PARAMETERS: ' + JSON.stringify(requestParams), 'debug');
		var now = fn.currentDateTime().toString();
		var results = func.call(this, context, params, content);
		var requestDuration = xdmp.elapsedTime().divide(xs.dayTimeDuration('PT1S'));
		collect(now, requestMethod, requestPath, requestHeaders, requestParams, requestDuration);
		return results;
	}
	// This is important. The "wrap" function created above is anonymous, and therefore has no name.
	// The code below sets the name of the function to the name of the function that was originally
	// passed in.
	return (new Function('return function (call) { return function ' + func.name + ' () { return call(this, arguments) }; };')())(Function.apply.bind(wrap));
}

exports.collect = collect;
exports.write = write;
exports.getSearchTermFrequencies = getSearchTermFrequencies;
exports.getTimeseriesData = getTimeseriesData;
exports.getServicePerformance = getServicePerformance;
exports.bindTelemetry = bindTelemetry;