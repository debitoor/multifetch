#!/usr/bin/env node
var exit = process.exit;

process.exit = function (code) {
	setTimeout(exit.bind(process, code), 2000);
};

require('./node_modules/mocha/bin/_mocha');
