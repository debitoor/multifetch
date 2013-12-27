var stream = require('stream');
var util = require('util');

var noop = function() {};

var ObjectStream = function(parent) {
	stream.Writable.call(this);

	this._destroyed = false;
	this._parent = parent;
};

util.inherits(ObjectStream, stream.Writable);

ObjectStream.prototype._write = function(data, encoding, callback) {
	if(this._parent.push(data)) {
		callback();
	} else {
		this._parent._callback = callback;
	}
};

ObjectStream.prototype.destroy = function() {
	if(this._destroyed) {
		return;
	}

	this._destroyed = true;

	this.emit('close');
};

var JsonStream = function() {
	if(!(this instanceof JsonStream)) {
		return new JsonStream();
	}

	stream.Readable.call(this);

	this._objectStream = null;
	this._destroyed = false;
	this._callback = noop;
};

util.inherits(JsonStream, stream.Readable);

JsonStream.prototype._read = function() {
	var cb = this._callback;
	this._callback = noop;
	cb();
};

JsonStream.prototype.end = function() {
	if(this._objectStream) {
		this.push('}');
	} else {
		this.push('{}');
	}

	this.push(null);
};

JsonStream.prototype.destroy = function() {
	if(this._destroyed) {
		return;
	}

	this._destroyed = true;

	if(this._objectStream) {
		this._objectStream.destroy();
	}

	this.emit('close');
};

JsonStream.prototype.createObjectStream = function(key) {
	if(this._objectStream) {
		this.push(',');
	} else {
		this.push('{');
	}

	this.push(JSON.stringify(key) + ':');
	this._objectStream = new ObjectStream(this);

	return this._objectStream;
};

JsonStream.prototype.writeObject = function(key, obj) {
	var objectStream = this.createObjectStream(key);

	objectStream.write(JSON.stringify(obj));
	objectStream.end();
};

module.exports = JsonStream;