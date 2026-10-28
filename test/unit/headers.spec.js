var stream = require('stream');
var multifetch = helper.requireSource('index');

describe('multifetch headers mode', function() {
	it('returns headers from internal responses', function(done) {
		var middleware = multifetch({ headers: true });
		var request = {
			app: function(internalRequest, response) {
				response.statusCode = 201;
				response.setHeader('Content-Type', 'application/json');
				response.setHeader('X-Result', 'ok');
				response.end(JSON.stringify({ success: true }));
			},
			body: {},
			headers: {},
			method: 'GET',
			query: { resource: '/api/example' },
			url: '/multifetch'
		};
		var response = new stream.PassThrough();
		response.setHeader = function() {};
		var body = '';

		response.on('data', function(chunk) {
			body += chunk.toString();
		});
		response.once('error', done);
		response.once('end', function() {
			try {
				var result = JSON.parse(body);
				chai.expect(result.resource.statusCode).to.equal(201);
				chai.expect(result.resource.headers['x-result']).to.equal('ok');
				chai.expect(result.resource.body).to.deep.equal({ success: true });
				done();
			} catch(error) {
				done(error);
			}
		});

		middleware(request, response, done);
	});
});
