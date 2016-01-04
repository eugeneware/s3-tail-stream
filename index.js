var AWS = require('aws-sdk'),
    stream = require('stream'),
    async = require('async'),
    through2 = require('through2');

module.exports = s3Stream;
function s3Stream(opts) {
  if (opts.auth) {
    AWS.config.update(opts.auth);
  }

  if (typeof opts.query.from === 'undefined') {
    opts.query.from = new Date(0);
  }

  if (typeof opts.retry === 'undefined') {
    opts.retry = null;
  }

  var nextMarker = opts.query.Marker || '';
  var keepPushing = true;

  var s3 = new AWS.S3();

  var r = stream.Readable();
  r._read = function () {};

  function streamObject(key, cb) {
    var params = {
      Bucket: opts.query.Bucket,
      Key: key
    };

    // Notify what object we are object, can help with resuming
    r.emit('s3-object', params);

    s3.getObject(params).createReadStream()
    .once('end', cb)
    .once('error', cb)
    .pipe(through2(function (chunk, enc, cb) {
      keepPushing = r.push(chunk);
      cb();
    }));
  }

  function fetch(marker) {
    if (typeof marker === 'undefined') {
      marker = '';
    }

    var params = {
      Bucket: opts.query.Bucket,
      Prefix: opts.query.Prefix,
      Marker: marker
    };

    s3.listObjects(params, function(err, data) {
      if (err) return r.emit('error', err);

      async.eachSeries(data.Contents,
        function (entry, cb) {
          nextMarker = entry.Key;
          var isFolder = entry.Key.match(/_\$folder\$$/);
          if (!isFolder && entry.LastModified >= opts.query.from &&
              entry.Key !== marker) {
            streamObject(entry.Key, cb);
          } else {
            cb();
          }
        },
        function (err) {
          if (err) return r.emit('error', err);
          if (data.IsTruncated) {
            setImmediate(fetch.bind(null, nextMarker));
          } else {
            if (opts.retry !== null) {
              r.emit('s3-retry', function cancel() {
                opts.retry = null;
              });
              setTimeout(fetch.bind(null, nextMarker), opts.retry);
            } else {
              r.push(null);
            }
          }
        });
    });
  }
  setImmediate(function () {
    fetch(nextMarker);
  });

  return r;
}
