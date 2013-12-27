// TODO:
// return more data for each resource
// { user: { status: 200, body: { ... } }, album: { ... } }

var url = require('url');
var util = require('util');
var stream = require('stream');

var pump = require('pump');
var extend = require('xtend');

var JsonStream = require('./json');
var http = require('./http');

var Sink = function(response) {
	stream.Transform.call(this);

	this._response = response;
	this._started = false;
	this._sink = false;
};

util.inherits(Sink, stream.Transform);

Sink.prototype._transform = function(data, encoding, callback) {
	if(this._sink) {
		return callback();
	}
	if(!this._started && !this.isJson()) {
		this._started = true;
		this._sink = true;

		return callback(null, 'null');
	}

	this._started = true;
	callback(null, data);
};

Sink.prototype.isJson = function() {
	var type = this._response.getHeader('Content-Type') || '';
	return (/(text|application)\/json/).test(type);
};

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

var resources = function(request, ignore) {
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

var create = function(ignore, callback) {
	if(!callback && typeof ignore === 'function') {
		callback = ignore;
		ignore = [];
	}

	ignore = ignore || [];
	callback = callback || noopCallback;

	return function(request, response, next) {
		var app = request.app;
		var query = resources(request, ignore);
		var keys = Object.keys(query);

		var json = new JsonStream();

		var status = 'success';
		var errs = [];

		response.setHeader('Content-Type', 'application/json');

		pump(json, response);

		(function loop() {
			var key = keys.pop();

			if(!key) {
				json.writeObject('_status', status);
				json.writeObject('_errors', errs);
				return json.end();
			}

			var messages = createMessages(request, query[key]);
			var sink = new Sink(messages.response);

			var write = function(err) {
				if(err) {
					return loop();
				}

				pump(messages.response.socket.input, sink, json.createObjectStream(key), function(err) {
					if(err) {
						return json.destroy();
					}
					if(!/2\d\d/.test(messages.response.statusCode) || !sink.isJson()) {
						status = 'error';
						errs.push(key);
					}

					loop();
				});

				app(messages.request, messages.response, function(err) {
					response.end();
				});
			};

			callback(request, messages.request, write);
		}());
	};
};

module.exports = create;
