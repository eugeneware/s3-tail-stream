var it = require('tape'),
    split = require('split2'),
    s3TailStream = require('..'),
    util = require('util'),
    sl = require('streamlined');

// The timestamps of the files in the test bucket
var fileDates = [
  'Mon Jan 04 2016 01:10:25 GMT+1100 (AEDT)',
  'Mon Jan 04 2016 01:16:46 GMT+1100 (AEDT)',
  'Mon Jan 04 2016 01:17:21 GMT+1100 (AEDT)',
  'Mon Jan 04 2016 01:18:21 GMT+1100 (AEDT)'
].map(function (str) {
  return new Date(str);
});

var auth = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
};

it('should be able to stream all the objects', function(t) {
  t.plan(24);

  var buckets = 0;
  var lines = 0;

  var opts = {
    auth: auth,
    query: {
      Bucket: 's3-tail-stream',
      Prefix: 'logs/'
    }
  };
  s3TailStream(opts)
    .on('error', function (err) {
      t.error(err, 'should not be an error');
    })
    .on('s3-object', function (obj) {
      buckets++;
      t.equal(obj.Bucket, 's3-tail-stream', 'correct bucket');
      t.equal(obj.Key, 'logs/' + buckets + '.txt', 'correct key');
    })
    .pipe(split())
    .pipe(sl.map(commaSplit))
    .on('data', function (data) {
      lines++;
      t.ok(Array.isArray(data), 'is an array');
      t.deepEqual(data, [String(lines), 'Line ' + lines]);
    })
    .on('end', function () {
      t.equal(buckets, 3, 'right number of buckets');
      t.equal(lines, 8, 'right number of lines');
      t.end();
    });
});

it('should be able to restrict with a prefix', function(t) {
  t.plan(10);

  var buckets = 0;
  var lines = 0;

  var opts = {
    auth: auth,
    query: {
      Bucket: 's3-tail-stream',
      Prefix: 'logs/1.txt'
    }
  };
  s3TailStream(opts)
    .on('error', function (err) {
      t.error(err, 'should not be an error');
    })
    .on('s3-object', function (obj) {
      buckets++;
      t.equal(obj.Bucket, 's3-tail-stream', 'correct bucket');
      t.equal(obj.Key, 'logs/' + (buckets) + '.txt', 'correct key');
    })
    .pipe(split())
    .pipe(sl.map(commaSplit))
    .on('data', function (data) {
      lines++;
      t.ok(Array.isArray(data), 'is an array');
      t.deepEqual(data, [String(lines), 'Line ' + lines]);
    })
    .on('end', function () {
      t.equal(buckets, 1, 'right number of buckets');
      t.equal(lines, 3, 'right number of lines');
      t.end();
    });
});

it('should be able to filter by date', function(t) {
  t.plan(16);

  var buckets = 0;
  var lines = 0;

  var opts = {
    auth: auth,
    query: {
      Bucket: 's3-tail-stream',
      Prefix: 'logs/',
      from: fileDates[1]
    }
  };
  s3TailStream(opts)
    .on('error', function (err) {
      t.error(err, 'should not be an error');
    })
    .on('s3-object', function (obj) {
      buckets++;
      t.equal(obj.Bucket, 's3-tail-stream', 'correct bucket');
      t.equal(obj.Key, 'logs/' + (buckets + 1) + '.txt', 'correct key');
    })
    .pipe(split())
    .pipe(sl.map(commaSplit))
    .on('data', function (data) {
      lines++;
      t.ok(Array.isArray(data), 'is an array');
      t.deepEqual(data, [String(lines + 3), 'Line ' + (lines + 3)]);
    })
    .on('end', function () {
      t.equal(buckets, 2, 'right number of buckets');
      t.equal(lines, 5, 'right number of lines');
      t.end();
    });
});

it('should be able to retry and tail', function(t) {
  t.plan(4);

  var buckets = 0;
  var lines = 0;
  var retries = 0;

  var opts = {
    auth: auth,
    query: {
      Bucket: 's3-tail-stream',
      Prefix: 'logs/',
      from: fileDates[3]
    },
    retry: 5000
  };
  var start;
  s3TailStream(opts)
    .on('error', function (err) {
      t.error(err, 'should not be an error');
    })
    .on('s3-object', function (obj) {
      t.fail('shouldnt read anything');
      buckets++;
    })
    .on('s3-retry', function (cancel) {
      retries++;
      if (!start) {
        start = Date.now();
      } else {
        var elapsed = Date.now() - start;
        start = Date.now();
        t.ok(elapsed >= 5000, 'should have polled after 5 seconds');
        cancel();
      }
    })
    .pipe(split())
    .pipe(sl.map(commaSplit))
    .on('data', function (data) {
      t.fail('should not get any data');
      lines++;
    })
    .on('end', function () {
      t.equal(buckets, 0, 'right number of buckets');
      t.equal(lines, 0, 'right number of lines');
      t.equal(retries, 2, 'retried twice');
      t.end();
    });
});

function commaSplit(data) {
  return data.split(',');
}
