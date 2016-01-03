var s3TailStream = require('..'),
    moment = require('moment');

// Search for log files older than 14 days
var fromDate = moment().subtract(14, 'days').toDate();

var opts = {
  query: {
    // S3 bucket name
    Bucket: 's3-tail-stream',
    // Object prefix (eg. folder prefix)
    Prefix: 'logs/',
    // log files older than 14 days
    from: fromDate
  }//,
  // keep polling after 60 seconds for new files that match criteria
  retry: 60*1000
};
s3TailStream(opts)
  .pipe(process.stdout);
