var JsonStream = helper.requireSource('json');

describe('JsonStream', function() {
	var json;

	describe('write empty object', function() {
		beforeEach(function(done) {
			var jsonStream = new JsonStream();

			helper.readStream(jsonStream, function(err, result) {
				json = result;
				done(err);
			});

			jsonStream.end();
		});

		it('should write an empty object on no input', function() {
			chai.expect(json).to.deep.equal({});
		});
	});

	describe('calling end on object stream should not end json stream', function() {
		var onEnd = sinon.spy();

		beforeEach(function(done) {
			var jsonStream = new JsonStream();
			var objectStream = jsonStream.createObjectStream('key');

			jsonStream.on('end', onEnd);

			objectStream.on('finish', function() {
				done();
			});

			objectStream.write('null');
			objectStream.end();
		});

		it('should not call end on json stream', function() {
			chai.expect(onEnd.called).to.be.false;
		});
	});

	describe('closing json stream should close object stream', function() {
		var onClose = sinon.spy();

		beforeEach(function() {
			var jsonStream = new JsonStream();
			var objectStream = jsonStream.createObjectStream('key');

			objectStream.on('close', onClose);
			jsonStream.destroy();
		});

		it('should close object stream', function() {
			chai.expect(onClose.calledOnce).to.be.true;
		});
	});

	describe('stream single json object', function() {
		beforeEach(function(done) {
			var jsonStream = new JsonStream();
			var objectStream = jsonStream.createObjectStream('key');

			helper.readStream(jsonStream, function(err, result) {
				json = result;
				done(err);
			});

			objectStream.on('finish', function() {
				jsonStream.end();
			});

			objectStream.write('{');
			objectStream.write('"id"');
			objectStream.write(':');
			objectStream.write('1');
			objectStream.write('}');
			objectStream.end();
		});

		it('should contain valid json entry', function() {
			chai.expect(json).to.deep.equal({ key: { id: 1 } });
		});
	});

	describe('stream multiple json values', function() {
		beforeEach(function(done) {
			var jsonStream = new JsonStream();

			helper.readStream(jsonStream, function(err, result) {
				json = result;
				done(err);
			});

			var objectStream1 = jsonStream.createObjectStream('key_1');

			objectStream1.on('finish', function() {
				var objectStream2 = jsonStream.createObjectStream('key_2');

				objectStream2.on('finish', function() {
					jsonStream.end();
				});

				objectStream2.write('[');
				objectStream2.write('2');
				objectStream2.write(']');
				objectStream2.end();
			});

			objectStream1.write('n');
			objectStream1.write('u');
			objectStream1.write('l');
			objectStream1.write('l');
			objectStream1.end();
		});

		it('should contain valid json', function() {
			chai.expect(json).to.deep.equal({ key_1: null, key_2: [2] });
		});
	});

	describe('write json object', function() {
		beforeEach(function(done) {
			var jsonStream = new JsonStream();

			helper.readStream(jsonStream, function(err, result) {
				json = result;
				done(err);
			});

			jsonStream.writeObject('key', { id: 1 });
			jsonStream.end();
		});

		it('should contain valid json', function() {
			chai.expect(json).to.deep.equal({ key: { id: 1 } });
		});
	});
});
