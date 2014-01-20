var stream = require('stream');
var events = require('events');
var http = require('http');
var util = require('util');

var extend = require('extend');

var noop = function() {};

var REMOTE_ADDRESS = '127.0.0.1';
var LOCAL_ADDRESS = REMOTE_ADDRESS;
var REMOTE_PORT = 9000;
var LOCAL_PORT = REMOTE_PORT;
var FAMILY = 'IPv4';

var length = function(data) {
	return (typeof data === 'string') ? Buffer.byteLength(data, 'utf-8') : data.length;
};

var Output = function(parent) {
	stream.Writable.call(this);

	this._parent = parent;
	this._callback = noop;
};

util.inherits(Output, stream.Writable);

Output.prototype._write = function(data, encoding, callback) {
	if(this._parent.push(data, encoding)) {
		callback();
	} else {
		this._callback = callback;
	}

	this._parent.bytesRead += length(data);
};

var Input = function(parent) {
	stream.Readable.call(this);

	this._parent = parent;
	this._callback = noop;
};

util.inherits(Input, stream.Readable);

Input.prototype._read = function(size) {
	var callback = this._callback;
	this._callback = noop;
	callback();
};

var Socket = function(options) {
	stream.Duplex.call(this);

	options = options || {};

	this.input = new Input(this);
	this.output = new Output(this);

	this.remoteAddress = options.remoteAddress || REMOTE_ADDRESS;
	this.remotePort = options.remotePort || REMOTE_PORT;

	this.localAddress = options.localAddress || LOCAL_ADDRESS;
	this.localPort = options.localPort || LOCAL_PORT;

	this.bytesRead = 0;
	this.bytesWritten = 0;

	this.bufferSize = 0;

	this._family = options.family || FAMILY;

	this._destroyed = false;

	var self = this;

	this.output.on('finish', function() {
		// End the readable part, writable output closed.
		self.push(null);
	});
	this.on('finish', function() {
		// The writable part closed, end readable input.
		self.input.push(null);
	});
};

util.inherits(Socket, stream.Duplex);

Socket.prototype._write = function(data, encoding, callback) {
	if(this.input.push(data)) {
		callback();
	} else {
		this.input._callback = callback;
	}

	this.bytesWritten += length(data, encoding);
};

Socket.prototype._read = function(size) {
	var callback = this.output._callback;
	this.output._callback = noop;
	callback();
};

Socket.prototype.connect = function() {
	this.emit('connect');
};

Socket.prototype.destroy = function() {
	if(this._destroyed) {
		return;
	}

	this._destroyed = true;
	this.emit('close');
};

Socket.prototype.address = function() {
	return { port: this.localPort, family: this._family, address: this.localAddress };
};

[
	'setTimeout',
	'setNoDelay',
	'setKeepAlive',
	'unref',
	'ref'
].forEach(function(name) {
	Socket.prototype[name] = noop;
});

var createResponse = function(serverRequest) {
	var response = new http.ServerResponse(serverRequest);

	var socket = serverRequest.socket;
	var header;

	response.assignSocket(socket);

	// Internally used by node to buffer the whole header
	response.__defineSetter__('_header', function() {
		header = ' ';
	});
	response.__defineGetter__('_header', function() {
		return header;
	});

	// Stream data without chunks
	response.__defineSetter__('chunkedEncoding', noop);
	response.__defineGetter__('chunkedEncoding', function() {
		return false;
	});

	socket.on('drain', function() {
		if(socket._httpMessage) {
			socket._httpMessage.emit('drain');
		}
	});
	response.on('finish', function() {
		socket.end();
	});

	return response;
};

var createRequest = function(serverRequest, options) {
	options = options || {};

	var request = new http.IncomingMessage(new Socket());

	var headers = options.headers || serverRequest.headers;
	var trailers = options.trailers || serverRequest.trailers;

	[
		'httpVersion',
		'httpVersionMajor',
		'httpVersionMinor',
		'url',
		'method',
		'complete',
		'upgrade'
	].forEach(function(name) {
		request[name] = options[name] || serverRequest[name];
	});

	extend(request.headers, headers);
	extend(request.trailers, trailers);

	return request;
};

var create = function(serverRequest, options) {
	var request = createRequest(serverRequest, options);
	var response = createResponse(request);

	return {
		request: request,
		response: response
	};
};

module.exports = create;
