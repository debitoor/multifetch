var request = require('request');
var multifetch = helper.requireSource('index');

describe('multifetch.options', function() {
	var server, body;

	describe('ignore', function() {
		before(function(done) {
			server = helper.server();

			server.get('/api/multifetch', multifetch(['access_token', 'token']));
			server = server.listen(helper.port, done);
		});

		before(function(done) {
			request.get({
				url: helper.url('/api/multifetch'),
				qs: { user: '/api/users/user_1', token: 'my_token' },
				json: true
			}, function(err, _, result) {
				body = result;
				done(err);
			});
		});

		after(function(done) {
			server.close(done);
		});

		it('should be successful response', function() {
			chai.expect(body).to.contain.subset({
				_status: 'success',
				_errors: []
			});
		});

		it('should ignore token query parameter', function() {
			chai.expect(body).not.to.have.property('token');
		});

		it('should contain user', function() {
			chai.expect(body).to.have.property('user');
		});
	});

	describe('callback', function() {
		before(function(done) {
			var callback = function(serverRequest, internalRequest, next) {
				if(internalRequest.url === '/api/users') {
					return next(true);
				}

				next();
			};

			server = helper.server();

			server.get('/api/multifetch', multifetch(callback));
			server = server.listen(helper.port, done);
		});

		before(function(done) {
			request.get({
				url: helper.url('/api/multifetch'),
				qs: {
					album: '/api/users/user_1/albums/album_1',
					users: '/api/users'
				},
				json: true
			}, function(err, _, result) {
				body = result;
				done(err);
			});
		});

		after(function(done) {
			server.close(done);
		});

		it('should be successful response', function() {
			chai.expect(body).to.contain.subset({
				_status: 'success',
				_errors: []
			});
		});

		it('should not have users', function() {
			chai.expect(body).not.to.have.property('users');
		});

		it('should contain album', function() {
			chai.expect(body).to.have.property('album');
		});
	});

	describe('post json', function() {
		before(function(done) {
			server = helper.server();

			server.post('/api/multifetch', multifetch());
			server = server.listen(helper.port, done);
		});

		before(function(done) {
			request.post({
				url: helper.url('/api/multifetch'),
				body: { user: '/api/users/user_1' },
				json: true
			}, function(err, _, result) {
				body = result;
				done(err);
			});
		});

		after(function(done) {
			server.close(done);
		});

		it('should be successful response', function() {
			chai.expect(body).to.contain.subset({
				_status: 'success',
				_errors: []
			});
		});

		it('should contain user_1', function() {
			chai.expect(body)
				.to.have.property('user')
				.to.deep.equal({
					name: 'user_1',
					associates: [],
					location: {
						city: 'Copenhagen',
						address: 'Wildersgade'
					}
				});
		});
	});
});
