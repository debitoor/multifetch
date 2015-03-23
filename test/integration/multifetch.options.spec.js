var request = require('request');
var multifetch = helper.requireSource('index');

describe('multifetch.options', function() {
	var server, body;

	describe('ignore', function() {
		before(function(done) {
			server = helper.server();

			server.get('/api/multifetch', multifetch({ ignore: ['access_token', 'token'] }));
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
			chai.expect(body).to.have.property('_error', false);
		});

		it('should ignore token query parameter', function() {
			chai.expect(body).not.to.have.property('token');
		});

		it('should contain user', function() {
			chai.expect(body)
				.to.have.property('user')
				.to.have.property('statusCode', 200);
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
			chai.expect(body).to.have.property('_error', false);
		});

		it('should not have users', function() {
			chai.expect(body).not.to.have.property('users');
		});

		it('should contain album', function() {
			chai.expect(body)
				.to.have.property('album')
				.to.have.property('statusCode', 200);
		});
	});

	describe('headers', function() {
		before(function(done) {
			server = helper.server();

			server.get('/api/multifetch', multifetch({ headers: false }));
			server = server.listen(helper.port, done);
		});

		after(function(done) {
			server.close(done);
		});

		describe('fetch multiple resources', function() {
			before(function(done) {
				request.get({
					url: helper.url('/api/multifetch'),
					qs: {
						user: '/api/users/user_1',
						album: '/api/users/user_1/albums/album_1'
					},
					json: true
				}, function(err, _, result) {
					body = result;
					done(err);
				});
			});

			it('should be successful response', function() {
				chai.expect(body).to.have.property('_error', false);
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

			it('should contain album_1', function() {
				chai.expect(body)
					.to.have.property('album')
					.to.deep.equal({
						owner: 'user_1',
						name: 'album_1',
						date: '2013-12-12',
						files: [{
							name: 'file_1',
							size: 128
						}, {
							name: 'file_2',
							size: 512
						}]
					});
			});
		});

		describe('hang up on bad request', function() {
			var err;

			before(function(done) {
				request.get({
					url: helper.url('/api/multifetch'),
					qs: { user: '/api/not_found' },
					json: true
				}, function(result) {
					err = result;
					done();
				});
			});

			it('should emit error', function() {
				chai.expect(err).to.defined;
			});
		});

		describe('get non json resource', function() {
			before(function(done) {
				request.get({
					url: helper.url('/api/multifetch'),
					qs: { root: '/' },
					json: true
				}, function(err, _, result) {
					body = result;
					done(err);
				});
			});

			it('should be failed response', function() {
				chai.expect(body).to.have.property('_error', false);
			});

			it('should have string as body', function() {
				chai.expect(body)
					.to.have.property('root', null);
			});
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
			chai.expect(body).to.have.property('_error', false);
		});

		it('should contain user_1', function() {
			chai.expect(body)
				.to.have.property('user')
				.to.contain.subset({
					statusCode: 200,
					body: {
						name: 'user_1',
						associates: [],
						location: {
							city: 'Copenhagen',
							address: 'Wildersgade'
						}
					}
				});
		});
	});


	describe('concurrent fetching', function() {

		before(function(done) {
			server = helper.server();

			server.get('/api/multifetch', multifetch({ concurrency: 5 }));
			server = server.listen(helper.port, done);
		});

		after(function(done) {
			server.close(done);
		});

		describe('fetch multiple resources', function() {
			before(function(done) {
				request.get({
					url: helper.url('/api/multifetch'),
					qs: {
						api: '/api',
						user_1: '/api/users/user_1',
						user_2: '/api/users/user_2',
						user_3: '/api/users/user_3',
						readme: '/README.md'
					},
					json: true
				}, function(err, _, result) {
					body = result;
					done(err);
				});
			});

			it('should be successful response', function() {
				chai.expect(body).to.have.property('_error', false);
			});

			it('should fetch api resource', function() {
				chai.expect(body)
					.to.have.property('api')
					.to.have.property('statusCode', 200);
			});

			it('should fetch user_1 resource', function() {
				chai.expect(body)
					.to.have.property('user_1')
					.to.have.property('statusCode', 200);
			});

			it('should fetch user_2 resource', function() {
				chai.expect(body)
					.to.have.property('user_2')
					.to.have.property('statusCode', 200);
			});

			it('should fetch user_3 resource', function() {
				chai.expect(body)
					.to.have.property('user_3')
					.to.have.property('statusCode', 200);
			});

			it('should fetch user_4 resource', function() {
				chai.expect(body)
					.to.have.property('readme')
					.to.have.property('statusCode', 200);
			});
		});

		describe('hang up on bad request', function() {
			var err;

			before(function(done) {
				request.get({
					url: helper.url('/api/multifetch'),
					qs: {
						bad: '/api/not_found',
					},
					json: true
				}, function(result) {
					err = result;
					done();
				});
			});

			it('should emit an error', function() {
				chai.expect(err).to.be.defined;
			});
		});
	});
});
