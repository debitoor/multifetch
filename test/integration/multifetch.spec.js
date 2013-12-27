var request = require('request');
var multifetch = helper.requireSource('index');

describe('multifetch', function() {
	var server, body;

	before(function(done) {
		server = helper.server();

		server.get('/api/multifetch', multifetch());
		server = server.listen(helper.port, done);
	});

	after(function(done) {
		server.close(done);
	});

	describe('empty request', function() {
		before(function(done) {
			request.get({
				url: helper.url('/api/multifetch'),
				qs: {},
				json: true
			}, function(err, _, result) {
				body = result;
				done(err);
			});
		});

		it('should be an empty response', function() {
			chai.expect(body).to.deep.equal({
				_status: 'success',
				_errors: []
			});
		});
	});

	describe('get single user', function() {
		before(function(done) {
			request.get({
				url: helper.url('/api/multifetch'),
				qs: { user: '/api/users/user_1' },
				json: true
			}, function(err, _, result) {
				body = result;
				done(err);
			});
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

	describe('get all users', function() {
		before(function(done) {
			request.get({
				url: helper.url('/api/multifetch'),
				qs: { users: '/api/users' },
				json: true
			}, function(err, _, result) {
				body = result;
				done(err);
			});
		});

		it('should be successful response', function() {
			chai.expect(body).to.contain.subset({
				_status: 'success',
				_errors: []
			});
		});

		it('should contain users array', function() {
			chai.expect(body)
				.to.have.property('users')
				.to.be.instanceof(Array);
		});

		it('should contain all users in array', function() {
			chai.expect(body.users.length).to.equal(3);
		});
	});

	describe('get chunked albums for user_3', function() {
		before(function(done) {
			request.get({
				url: helper.url('/api/multifetch'),
				qs: { albums: '/api/users/user_3/albums' },
				json: true
			}, function(err, _, result) {
				body = result;
				done(err);
			});
		});

		it('should be successful response', function() {
			chai.expect(body).to.contain.subset({
				_status: 'success',
				_errors: []
			});
		});

		it('should contain albums array', function() {
			chai.expect(body)
				.to.have.property('albums')
				.to.be.instanceof(Array);
		});

		it('should contain all albums for user', function() {
			chai.expect(body.albums.length).to.equal(5);
		});
	});

	describe('get multiple resources', function() {
		before(function(done) {
			request.get({
				url: helper.url('/api/multifetch'),
				qs: {
					albums: '/api/users/user_3/albums',
					user: '/api/users/user_2',
					album: '/api/users/user_2/albums/album_1'
				},
				json: true
			}, function(err, _, result) {
				body = result;
				done(err);
			});
		});

		it('should be successful response', function() {
			chai.expect(body).to.contain.subset({
				_status: 'success',
				_errors: []
			});
		});

		it('should contain albums array', function() {
			chai.expect(body)
				.to.have.property('albums')
				.to.be.instanceof(Array);
		});

		it('should contain all albums for user', function() {
			chai.expect(body.albums.length).to.equal(5);
		});

		it('should contain user', function() {
			chai.expect(body)
				.to.have.property('user')
				.to.deep.equal({
					name: 'user_2',
					associates: ['user_1', 'user_3'],
					location: {
						city: 'Aarhus',
						address: 'Niels Borhs Vej'
					}
				});
		});

		it('should contain album for user', function() {
			chai.expect(body)
				.to.have.property('album')
				.to.deep.equal({
					owner: 'user_2',
					name: 'album_1',
					date: '2013-12-01',
					files: [{
						name: 'file_1',
						size: 512
					}]
				});
		});
	});

	describe('error on invalid resource', function() {
		before(function(done) {
			request.get({
				url: helper.url('/api/multifetch'),
				qs: { user: '/api/users/not_valid' },
				json: true
			}, function(err, _, result) {
				body = result;
				done(err);
			});
		});

		it('should be failed response', function() {
			chai.expect(body).to.contain.subset({
				_status: 'error',
				_errors: ['user']
			});
		});

		it('should contain user error', function() {
			chai.expect(body)
				.to.have.property('user')
				.to.have.property('message');
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

	describe('get users with query', function() {
		before(function(done) {
			request.get({
				url: helper.url('/api/multifetch'),
				qs: { user: '/api/users?skip=1&limit=1' },
				json: true
			}, function(err, _, result) {
				body = result;
				done(err);
			});
		});

		it('should be successful response', function() {
			chai.expect(body).to.contain.subset({
				_status: 'success',
				_errors: []
			});
		});

		it('should contain single user in array', function() {
			chai.expect(body)
				.to.have.property('user')
				.to.deep.equal([
					{
						name: 'user_2',
						associates: ['user_1', 'user_3'],
						location: {
							city: 'Aarhus',
							address: 'Niels Borhs Vej'
						}
					}
				]);
		});
	});

	describe('get multifetch in query', function() {
		before(function(done) {
			request.get({
				url: helper.url('/api/multifetch'),
				qs: {
					multifetch: '/api/multifetch',
					album: '/api/users/user_3/albums/album_3'
				},
				json: true
			}, function(err, _, result) {
				body = result;
				done(err);
			});
		});

		it('should ignore multifetch resource', function() {
			chai.expect(body).to.contain.subset({
				_status: 'success',
				_errors: []
			});
		});

		it('should contain user album', function() {
			chai.expect(body)
				.to.have.property('album')
				.to.deep.equal({
					owner: 'user_3',
					name: 'album_3',
					date: '2013-11-29',
					files: [{
						name: 'file_2',
						size: 1024
					}]
				});
		});
	});

	describe('get api data (async)', function() {
		before(function(done) {
			request.get({
				url: helper.url('/api/multifetch'),
				qs: {
					api: '/api',
					user: '/api/users/user_3'
				},
				json: true
			}, function(err, _, result) {
				body = result;
				done(err);
			});
		});

		it('should ignore multifetch resource', function() {
			chai.expect(body).to.contain.subset({
				_status: 'success',
				_errors: []
			});
		});

		it('should contain user', function() {
			chai.expect(body)
				.to.have.property('user');
		});

		it('should contain api data', function() {
			chai.expect(body)
				.to.have.property('api');
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
			chai.expect(body)
				.to.deep.equal({
					root: null,
					_errors: ['root'],
					_status: 'error'
				});
		});
	});

	describe('get redirect', function() {
		before(function(done) {
			request.get({
				url: helper.url('/api/multifetch'),
				qs: { api: '/package' },
				json: true
			}, function(err, _, result) {
				body = result;
				done(err);
			});
		});

		it('should be failed response', function() {
			chai.expect(body)
				.to.deep.equal({
					api: null,
					_errors: ['api'],
					_status: 'error'
				});
		});
	});
});
