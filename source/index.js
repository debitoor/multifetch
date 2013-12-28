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

var fetch = function(app, messages) {
	var request = messages.request;
	var response = messages.response;

	var json = new JsonStream();
	var sink = new Sink(response);

	pump(response.socket.input, sink, json.createObjectStream('body'), function(err) {
		if(err) {
			return json.destroy();
		}

		json.writeObject('statusCode', response.statusCode);
		json.writeObject('headers', response._headers);
		json.end();
	});

	setImmediate(function() {
		app(request, response, function(err) {
			json.destroy();
		});
	});

	json.hasError = function() {
		return !(/2\d\d/).test(response.statusCode) || !sink.isJson();
	};

	return json;
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

				var resource = fetch(app, messages);

				pump(resource, json.createObjectStream(key), function(err) {
					if(err) {
						return json.destroy();
					}
					if(resource.hasError()) {
						error = true;
					}

					loop();
				});
			};

			callback(request, messages.request, write);
		}());
	};
};

module.exports = create;
