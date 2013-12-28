var stream = require('stream');
var util = require('util');

var isJson = function(response) {
	var type = response.getHeader('Content-Type') || '';
	return (/(text|application)\/json/).test(type);
};

var StringifyStream = function(response) {
	if(!(this instanceof StringifyStream)) {
		return new StringifyStream(response);
	}

	stream.Transform.call(this);

	this._response = response;
	this._started = false;
	this._pass = false;
};

util.inherits(StringifyStream, stream.Transform);

StringifyStream.prototype._transform = function(data, encoding, callback) {
	if(this._pass) {
		return callback(null, data);
	}
	if(!this._started && isJson(this._response)) {
		this._started = true;
		this._pass = true;

		return callback(null, data);
	}

	data = data.toString('utf-8');
	data = JSON.stringify(data).replace(/(^")|("$)/g, '');

	if(!this._started) {
		this._started = true;
		// Strip the single space, used to replace the header.
		data = '"' + data.replace(/^ /, '');
	}

	callback(null, data);
};

StringifyStream.prototype._flush = function(callback) {
	if(this._started && !this._pass) {
		this.push('"');
	}

	callback();
};

module.exports = StringifyStream;
