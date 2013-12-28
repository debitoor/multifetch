var stream = require('stream');
var util = require('util');

var isJson = function(response) {
	var type = response.getHeader('Content-Type') || '';
	return (/(text|application)\/json/).test(type);
};

var NullifyStream = function(response) {
	if(!(this instanceof NullifyStream)) {
		return new NullifyStream(response);
	}

	stream.Transform.call(this);

	this._response = response;
	this._started = false;
	this._nullify = false;
};

util.inherits(NullifyStream, stream.Transform);

NullifyStream.prototype._transform = function(data, encoding, callback) {
	if(this._nullify) {
		return callback();
	}
	if(!this._started && !isJson(this._response)) {
		this._started = true;
		this._nullify = true;

		return callback(null, 'null');
	}

	this._started = true;
	callback(null, data);
};

module.exports = NullifyStream;
