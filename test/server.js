var fs = require('fs');
var path = require('path');

var express = require('express');
var methodOverride = require('method-override');
var bodyParser = require('body-parser');

var users = require('./fixtures/users');
var albums = require('./fixtures/albums');

var root = function(name) {
	return path.join(__dirname, '..', name);
};

var findByName = function(models, name) {
	return models.filter(function(m) {
		return m.name === name;
	})[0];
};

var findAllByOwner = function(models, owner) {
	return models.filter(function(m) {
		return m.owner === owner;
	});
};

var getBlob = function() {
	var blob = new Buffer(1024 * 1024);

	blob.fill('h');
	blob.write('"', 0, 1);
	blob.write('"', blob.length - 1, 1);

	return blob;
};

var json = function(request, response, next) {
	response.setHeader('Content-Type', 'application/json');
	next();
};

var text = function(request, response, next) {
	response.setHeader('Content-Type', 'text/plain; charset=utf-8');
	next();
};

var album = function(request, response, next) {
	var userAlbums = findAllByOwner(albums, request.params.user);
	var album = findByName(userAlbums, request.params.album);

	if(!album || album.owner !== request.params.user) {
		return response.notFound();
	}

	request.album = album;
	next();
};

var create = function() {
	var app = express();

	app.use(bodyParser.json());
	app.use(methodOverride());

	app.use(function(request, response, next) {
		response.notFound = function() {
			response.statusCode = 404;
			response.json({ message: 'Resource not found' });
		};

		next();
	});

	app.get('/', text, function(request, response) {
		response.send('Application "root"');
	});

	app.get('/README.md', text, function(request, response) {
		fs.createReadStream(root('README.md')).pipe(response);
	});

	app.get('/package', function(request, response) {
		response.redirect('/api');
	});

	app.get('/cookie', function(request, response) {
		response.json({ cookie: request.headers.cookie });
	});

	app.get('/api', json, function(request, response) {
		fs.readFile(root('package.json'), function(err, data) {
			if(err) {
				return response.json({ message: err.message });
			}

			response.setHeader('Content-Length', data.length);
			response.end(data);
		});
	});

	app.get('/api/users', json, function(request, response) {
		var skip = parseInt(request.query.skip, 10) || 0;
		var limit = parseInt(request.query.limit, 10) || users.length;

		response.json(users.slice(skip, skip + limit));
	});

	app.get('/api/users/:name', json, function(request, response) {
		var user = findByName(users, request.params.name);

		if(!user) {
			return response.notFound();
		}

		response.json(user);
	});

	app.post('/api/users', json, function(request, response) {
		var user = request.body;
		users.push(user);

		response.json(user);
	});

	app.get('/api/users/:user/albums', json, function(request, response) {
		var user = findByName(users, request.params.user);
		var userAlbums = findAllByOwner(albums, user && user.name);

		if(!user) {
			return response.notFound();
		}

		response.setHeader('Transfer-Encoding', 'chunked');

		response.write('[');

		userAlbums.forEach(function(album, i) {
			response.write(JSON.stringify(album));

			if(i < userAlbums.length - 1) {
				response.write(',');
			}
		});

		response.write(']');
		response.end();
	});

	app.get('/api/users/:user/albums/:album', json, album, function(request, response) {
		response.json(request.album);
	});

	app.get('/api/users/:user/albums/:album/blob', json, album, function(request, response) {
		response.write(getBlob());
		response.end();
	});

	app.get('/api/users/:user/albums/:album/stream', json, album, function(request, response) {
		var blob = getBlob();
		var offset = 0;

		(function loop() {
			if(offset >= blob.length) {
				return response.end();
			}

			var part = blob.slice(offset, offset + Math.pow(2, 17));
			offset += part.length;

			if(response.write(part) !== false) {
				loop();
			} else {
				response.once('drain', loop);
			}
		}());
	});

	return app;
};

module.exports = create;

if(require.main === module) {
	var PORT = 8080;
	var multifetch = require('../source/index');

	create().get('/api/multifetch', multifetch()).listen(PORT, function() {
		console.log('Server listening on port ' + PORT);
	});
}
