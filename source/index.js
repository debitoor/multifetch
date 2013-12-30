var url = require('url');

var pump = require('pump');
var extend = require('extend');

var JsonStream = require('./json');
var NullifyStream = require('./nullify');
var http = require('./http');

var noopCallback = function(serverRequest, internalRequest, callback) {
	callback();
};

var createMessages = function(request, url) {
	var headers = {
		cookie: request.headers.cookie || '',
		accept: 'application/json'
	};

	return http(request, {
		method: 'GET',
		url: url,
		headers: headers
	});
};

var getResources = function(request, ignore) {
	var body = (typeof request.body === 'object') ? request.body : {};
	var query = extend({}, body, request.query);

	var path = url.parse(request.url).pathname;

	return Object.keys(query).reduce(function(acc, key) {
		if(key !== path && ignore.indexOf(key) === -1) {
			acc[key] = query[key];
		}

		return acc;
	}, {});
};

var fetchWithHeaders = function(request, response) {
	var json = new JsonStream();
	var nullify = new NullifyStream(response);

	pump(response.socket.input, nullify, json.createObjectStream('body'), function(err) {
		if(err) {
			return json.destroy();
		}

		json.writeObject('statusCode', response.statusCode);
		json.writeObject('headers', response._headers);
		json.end();
	});

	return json;
};

var fetchBare = function(request, response) {
	var nullify = new NullifyStream(response);

	pump(response.socket.input, nullify, function(err) {
		if(err) {
			return nullify.destroy();
		}
	});

	return nullify;
};

var create = function(options, callback) {
	if(!callback && typeof options === 'function') {
		callback = options;
		options = {};
	}

	options = options || {};

	var ignore = options.ignore || [];
	var headers = options.headers !== undefined ? options.headers : true;

	var fetch = headers ? fetchWithHeaders : fetchBare;

	callback = callback || noopCallback;

	return function(request, response, next) {
		var app = request.app;
		var query = getResources(request, ignore);
		var keys = Object.keys(query);

		var json = new JsonStream();
		var error = false;

		response.setHeader('Content-Type', 'application/json');

		pump(json, response);

		(function loop() {
			var key = keys.pop();

			if(!key) {
				json.writeObject('_error', error);
				return json.end();
			}

			var messages = createMessages(request, query[key]);

			var write = function(prevent) {
				if(prevent) {
					return loop();
				}

				var resource = fetch(messages.request, messages.response);

				pump(resource, json.createObjectStream(key), function(err) {
					if(err) {
						return json.destroy();
					}
					if(!(/2\d\d/).test(messages.response.statusCode)) {
						error = true;
					}

					loop();
				});

				app(messages.request, messages.response, function(err) {
					json.destroy();
				});
			};

			callback(request, messages.request, write);
		}());
	};
};

module.exports = create;
