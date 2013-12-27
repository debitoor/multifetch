var fs = require('fs');
var path = require('path');

var express = require('express');
var users = require('./fixtures/users');
var albums = require('./fixtures/albums');

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

var json = function(request, response, next) {
	response.setHeader('Content-Type', 'application/json');
	next();
};

var create = function() {
	var app = express();

	app.use(express.json());
	app.use(express.methodOverride());

	app.use(function(request, response, next) {
		response.notFound = function() {
			response.statusCode = 404;
			response.json({ message: 'Resource not found' });
		};

		next();
	});

	app.get('/', function(request, response) {
		response.setHeader('Content-Type', 'text/plain; charset=utf-8');
		response.send('Application root');
	});

	app.get('/package', function(request, response) {
		response.redirect('/api');
	});

	app.get('/api', json, function(request, response) {
		fs.readFile(path.join(__dirname, '..', 'package.json'), function(err, data) {
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

	app.get('/api/users/:user/albums/:album', json, function(request, response) {
		var userAlbums = findAllByOwner(albums, request.params.user);
		var album = findByName(userAlbums, request.params.album);

		if(!album || album.owner !== request.params.user) {
			return response.notFound();
		}

		response.json(album);
	});

	return app;
};

module.exports = create;

if(require.main === module) {
	var PORT = 8080;

	create().listen(PORT, function() {
		console.log('Server listening on port ' + PORT);
	});
}
