multifetch
==========

Express middleware for performing internal batch GET requests. It allows the client to send a single HTTP request, which in turn can fetch multiple JSON resources in the app, without performing any further requests.

Usage
-----

It can be used without any configuration.

```javascript
var multifetch = require('multifetch');
var express = require('express');

var app = express();

app.get('/api/multifetch', multifetch());

app.get('/api/user', function(request, response) {
	response.json({
		name: 'user_1',
		associates: ['user_2', 'user_3']
	});
});

app.listen(8080);
```

Performing a GET request to `/api/multifetch?user=/api/user`, will return the user and some meta information. The query parameter should have a resource name as key and the relative path as value. The path can have its own query, as long it's encoded correctly.

```javascript
{
	user: {
		statusCode: 200,							// Response code returned by the user route
		headers: {									// All response headers
			'content-type': 'application/json',
			...
		},
		body: {										// The actual json body
			name: 'user_1',
			associates: ['user_2', 'user_3']
		}
	},
	_error: false									// _error will be true if one of the requests failed
}
```

This way we can fetch multiple resources, by adding them to the query. If we had more routes defined, it would be possible to do `/api/multifetch?user=/api/user&albums=/api/users/user_1/albums&files=/api/files`. And the response will contain all the resources as described above.

```javascript
{
	user: {
		statusCode: 200,
		headers: { ... },
		body: { ... }
	},
	albums: {
		statusCode: 200,
		headers: { ... },
		body: [ ... ]
	},
	files: {
		statusCode: 200,
		headers: { ... },
		body: [ ... ]
	},
	_error: false
}
```

This doesn't perform any additional HTTP requests, instead it uses express' internal routing to get the resources and send them back to client. The JSON is streamed to client one requests at the time.

It is also possible to configure `multifetch` to ignore some of the query parameters, or call a provided callback function before performing any internal routing, which makes it possible to set any required headers on the internal request, e.g. api access tokens (the `cookie` header is set by default).

```javascript
// Ignore access_token and token in the query
app.get('/api/multifetch', multifetch(['access_token', 'token']));

// Callback function run before each internal request
app.get('/api/multifetch', multifetch(function(serverRequset, internalRequest, next) {
	if(serverRequest.hasAccess) {
		// Calling next with a truthy value, skips this internal request.
		return next(true);
	}

	// Copy token
	internRequest.headers.token = serverRequest.headers.token || serverRequest.query.token;
	next();
}));
```

If `request.body` is available and is a JSON object, resources will also be included from there (body object with resource names as keys, and paths as values). This
can de bone by using a `post` route with the `bodyParse` middleware.

Non JSON resources, where `content-type` doesn't contain `json`, are returned as strings.
