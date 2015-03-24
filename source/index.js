var url = require('url');

var pump = require('pump');
var extend = require('extend');
var async = require('async');

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
		if(query[key] !== path && ignore.indexOf(key) === -1) {
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

var endStream = function (jsonStream, error) {
	jsonStream.writeObject('_error', error);
	jsonStream.end();
};

var create = function(options, prefetch) {
	if(!prefetch && typeof options === 'function') {
		prefetch = options;
		options = {};
	}


	options = options || {};
	var ignore = options.ignore || [];
	var headers = options.headers !== undefined ? options.headers : true;
	var concurrency = options.concurrency || 1; // Defaults to sequential fetching

	var fetch = headers ? fetchWithHeaders : fetchBare;

	prefetch = prefetch || noopCallback;

	return function(request, response, next) {
		var app = request.app;
		var query = getResources(request, ignore);
		var keys = Object.keys(query);

		var json = new JsonStream();
		var error = false;

		response.setHeader('Content-Type', 'application/json');

		pump(json, response);

		// Exit early if there is nothing to fetch.
		if(keys.length === 0) {
			return endStream(json, error);
		}

		// The resource queue processes resource streams sequentially.
		var resourceQueue = async.queue(function worker(task, callback) {
			pump(task.resource, json.createObjectStream(task.key), function(err) {
				if(err) {
					json.destroy();
					return callback(err);
				}
				if(!(/2\d\d/).test(task.response.statusCode)) {
					error = true;
				}
				callback();
			});
		}, 1);

		// Asynchronously fetch the resource for a key and push the resulting
		// stream into the resource queue.
		var fetchResource = function(key, callback) {
			var messages = createMessages(request, query[key]);
			prefetch(request, messages.request, function(prevent) {
				if (prevent) return callback();

				var resource = fetch(messages.request, messages.response);
				var task = {
					resource: resource,
					request: messages.request,
					response: messages.response,
					key: key
				};

				app(messages.request, messages.response, function() {
					resourceQueue.kill();
					json.destroy();
				});

				// Callback is called once the stream for this resource has
				// been fully piped out to the client.
				resourceQueue.push(task, callback);
			});
		};

		// Fire off all requests and push the resulting streams into a queue to
		// be processed
		async.eachLimit(keys, concurrency, fetchResource, function(err) {
			if(resourceQueue.idle()) {
				endStream(json, error);
			} else {
				// Called once all streams have been fully pumped out to the client.
				resourceQueue.drain = function() {
					endStream(json, error);
				};
			}
		});
	};
};

module.exports = create;
