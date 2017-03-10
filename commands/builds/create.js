'use strict';

let cli = require('heroku-cli-util');
let archiver = require('archiver');
let fs = require('fs');
let ignore = require('ignore');
let uuid = require('node-uuid');
let os = require('os');
let path = require('path');
let request = require('request');
let exec = require('child_process').execSync

function checkTarInstall(tar) {
  let tarVersion = exec(tar+" --version").toString()

  if (!tarVersion.match(/GNU tar/)) {
    cli.warn("Builds can fail if their code is not compressed with GNU tar.")
    cli.warn("Please install it, or specify the '--tar' option")
    cli.warn("Detected tar version: "+tarVersion.toString())
  }
}

function uploadCwdToSource(app, cwd, tar, fn) {
  let tempFilePath = path.join(os.tmpdir(), uuid.v4() + '.tar.gz');
  let ig = ignore().add(fs.readFileSync('.gitignore').toString());
  let filter = ig.createFilter();

  checkTarInstall(tar)
  app.sources().create({}).then(function(source){
    exec(tar+" cz -C "+cwd+" --exclude .git --exclude .gitmodules . > "+tempFilePath)

    let filesize = fs.statSync(tempFilePath).size;
    let request_options = {
      url: source.source_blob.put_url,
      headers: {
        'Content-Type': '',
        'Content-Length': filesize
      }
    };

    var stream = fs.createReadStream(tempFilePath);
    stream.on('close', function() {
      fs.unlink(tempFilePath);
    });

    stream.pipe(request.put(request_options, function() {
      fn(source.source_blob.get_url);
    }));
  });
}

function create(context, heroku) {
  let app = heroku.apps(context.app);

  var sourceUrl = context.flags['source-url'];
  var tar = context.flags['tar'] || 'tar';

  var sourceUrlPromise = sourceUrl ?
      new Promise(function(resolve) { resolve(sourceUrl);}) :
      new Promise(function(resolve) { uploadCwdToSource(app, context.cwd, tar, resolve); });

  return sourceUrlPromise.then(function(sourceGetUrl) {
    return app.builds().create({
      source_blob: {
        url: sourceGetUrl,
        // TODO provide better default, eg. archive md5
        version: context.flags.version || ''
      }
    });
  })
  .then(function(build) {
    request.get(build.output_stream_url).pipe(process.stderr);
  });
}

module.exports = {
  topic: 'builds',
  command: 'create',
  needsAuth: true,
  needsApp: true,
  help: 'Create build from contents of current dir',
  description: 'create build',
  flags: [
    { name: 'source-url', description: 'Source URL that points to the tarball of your application\'s source code', hasValue: true},
    { name: 'tar', description: 'Path to the executable GNU tar', hasValue: true},
    { name: 'version', description: 'Description of your new build', hasValue: true }
  ],
  run: cli.command(create)
};
