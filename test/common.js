/*jshint -W079 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

var path = require('path');
var util = require('util');

var sinon = require('sinon');
var chai = require('chai');
var once = require('once');

require('mocha');

var server = require('./server');

global.sinon = sinon;
global.chai = chai;

chai.Assertion.includeStack = true;
chai.use(require('sinon-chai'));

var PORT = 10808;

chai.Assertion.addChainableMethod('subset', function(expected) {
	var actual = this.__flags.object;

	var actualJson = JSON.stringify(actual);
	var expectedJson = JSON.stringify(expected);

	this.assert(
		sinon.match(expected).test(actual),
		util.format('expected %s to contain subset %s', actualJson, expectedJson),
		util.format('expected %s not to contain subset %s', actualJson, expectedJson),
		expected);
});

var helper = function() {
	var that = {};

	var url = function(path) {
		return 'http://localhost:' + PORT + (path || '/');
	};

	var requireSource = function(module) {
		return require(path.join(__dirname, '..', 'source', module));
	};

	var readStream = function(stream, callback) {
		callback = once(callback);

		var buffer = [];

		stream.on('data', function(data) {
			buffer.push(data);
		});
		stream.on('end', function() {
			var json = Buffer.concat(buffer).toString('utf-8');
			json = JSON.parse(json);

			callback(null, json);
		});
		stream.on('close', function() {
			callback(new Error('Stream closed'));
		});
		stream.on('error', function(err) {
			callback(err);
		});
	};

	that.url = url;
	that.server = server;
	that.port = PORT;

	that.requireSource = requireSource;
	that.readStream = readStream;

	return that;
};

global.helper = helper();
