# s3-tail-stream

Tail all the objects in an S3 bucket for log processing

[![build status](https://secure.travis-ci.org/eugeneware/s3-tail-stream.png)](http://travis-ci.org/eugeneware/s3-tail-stream)

## Background

Often you need to do log processing, and all your logs are stored in one or more
folders on S3.

You'd like to just easily process them as a single stream, rather than list the
objects and then stream each one.

You'd like to be able to just get objects that have been modified since a given
date like the last time your processed your logs.

You'd like to be able to continually poll the bucket for changes and once new
objects appear that match your criteria you'd like to stream through too.

If this sounds like something you'd like to do, then this is the module for
you!

## Installation

This module is installed via npm:

``` bash
$ npm install s3-tail-stream
```

## Example Usage - Tail and poll

Tail all the logs older than 14 days, and poll every minute for new files

``` js
var s3TailStream = require('s3-tail-stream'),
    moment = require('moment');

// Search for log files older than 14 days
var fromDate = moment().subtract(14, 'days').toDate();

var opts = {
  // S3 credentials
  auth: {
    accessKeyId: 'Your S3 ID',
    secretAccessKey: 'Your S3 Key'
  },
  query: {
    // S3 bucket name
    Bucket: 's3-tail-stream',
    // Object prefix (eg. folder prefix)
    Prefix: 'logs/',
    // log files older than 14 days
    from: fromDate
  },
  // keep polling after 60 seconds for new files that match criteria
  retry: 60*1000
};
s3TailStream(opts)
  .pipe(process.stdout);

// Returns the contents of all 3 files in order. The first 3 lines are from the
// first file, the next 3 lines are from the second files, and the last 2 lines
// are from the last file.
// Also, this program will keep polling every 60 seconds so if a new file gets
// added, the contents will stream out.
/**
1,Line 1
2,Line 2
3,Line 3
4,Line 4
5,Line 5
6,Line 6
7,Line 7
8,Line 8
**/
});
```

## Example Usage - Process compressed files

This is the same as the previous example but the files are gzipped, so
an uncompression function is provided:

``` js
var s3TailStream = require('s3-tail-stream'),
    moment = require('moment'),
    zlib = require('zlib');

// Search for log files older than 14 days
var fromDate = moment().subtract(14, 'days').toDate();

var opts = {
  // S3 credentials
  auth: {
    accessKeyId: 'Your S3 ID',
    secretAccessKey: 'Your S3 Key'
  },
  query: {
    // S3 bucket name
    Bucket: 's3-tail-stream',
    // Object prefix (eg. folder prefix)
    Prefix: 'compressedlogs/',
    // log files older than 14 days
    from: fromDate
  },
  // keep polling after 60 seconds for new files that match criteria
  retry: 60*1000,
  // Transform stream to do the uncompression
  uncompress: zlib.createGunzip
};
s3TailStream(opts)
  .pipe(process.stdout);

// Returns the contents of all 3 files in order. The first 3 lines are from the
// first file, the next 3 lines are from the second files, and the last 2 lines
// are from the last file.
// Also, this program will keep polling every 60 seconds so if a new file gets
// added, the contents will stream out.
/**
1,Line 1
2,Line 2
3,Line 3
4,Line 4
5,Line 5
6,Line 6
7,Line 7
8,Line 8
**/
});
```

## API

### s3TailStream(opts)

Returns a new `Readable` Stream that will be the concatentation of all the
objects that match the query.

* `opts` - Configuration options:
  * `auth` - S3 login. NB: As this uses the `aws-sdk` module, if you have your
    credentials in `~/.aws/config` you can leave this option blank.
    * `accessKeyId` - Your S3 Access Key Id
    * `secretAccessKey` - Your S3 Key
  * `query` - the query object
    * `Bucket` - S3 bucket name
    * `Prefix` - S3 Object Prefix (eg. use to list objects from a given folder)
    * `Marker` (optional) - An S3 object to start listing objects from. Useful
      if you don't want to list all the objects in a bucket, but those *after*
      this marker.
    * `from` (optional) - Javascript Date object that is used to return objects
      *older* than this date.
  * `retry` (optional) - Interval in (ms) to keep looking for new files (ie. tail) that
    match the query. Leave this, or set this to `null` to have the stream
    end when it runs out of files. NB: Setting this too low may cause API
    rate limiing issues.
  * `uncompress` (optional) - If the objects are uncompressed, then provide a
    function which when called will create a `Transform` stream to do the
    uncompression (eg. `zlib.createGunzip`)

### Events

Several events are emitted which can be useful:

* `s3TailStream.emit('s3-object', s3object)` - emits the bucket and key of each
  object that matches the query before it gets streamed.
* `s3TailStream.emit('s3-retry', cancel)` - emitted every time the polling
  interval occurs. The data of the event is a function that you can call to
  stop the polling process.
