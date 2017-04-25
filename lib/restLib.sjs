/**
 * @restLib.sjs - Helper functions for REST calls
 *
 * @author Brad Mann brad.mann@marklogic.com
 */

var paramsCache = null;

/**
 * Build an Object from the REST API parameters
 * @return {Object} An object that contains all the parameters passed in the service call.
 */
function buildParams() {
	params = {};
	var fieldNames = xdmp.getRequestFieldNames();

	for (var fieldName of fieldNames) {
		fieldName = (fieldName.substring(0, 3) === 'rs:') ? fieldName.substring(3) : fieldName;
		params[fieldName] = xdmp.getRequestField(fieldName);
	}

	// If the facets came through as a parameter, convert the param to a json object
	if (params.hasOwnProperty('facets')) {
		params.facets = JSON.parse(params.facets);
	}

	// If this is a POST of JSON data, extract the parameters from the body
	if ((xdmp.getRequestMethod() == 'POST' || xdmp.getRequestMethod() == 'PUT') && xdmp.getRequestHeader('Content-Type').toString().indexOf('application/json') != -1) {
		var body = xdmp.getRequestBody().toObject();
		if (body) {
			Object.keys(body).forEach(function(key){params[key] = body[key]});
		}
	}

	return params;
}

function get(field, defaultVal) {
	defaultVal = (defaultVal === undefined || defaultVal === null) ? null : defaultVal;
	paramsCache = (paramsCache === null) ? buildParams() : paramsCache;
	var val = paramsCache.hasOwnProperty(field) ? paramsCache[field] : defaultVal;
	return val;
}

function required(field) {
	paramsCache = (paramsCache === null) ? buildParams() : paramsCache;
	if (!paramsCache.hasOwnProperty(field)) {
		fn.error(xs.QName('MISSING-REQUIRED-PARAM'), 'The parameter ' + field + ' is required for this service.');
	}
	return paramsCache[field];
}

exports.get = get;
exports.required = required;