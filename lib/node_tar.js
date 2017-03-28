let archiver = require('archiver');
let ignore = require('ignore');
let fs = require('fs');
let os = require('os');
let request = require('request');

module.exports = {

  call: function(cwd, file, callback) {
    let archive = archiver('tar', { gzip: true });
    let ig = ignore().add(fs.readFileSync('.gitignore').toString());
    let filter = ig.createFilter();

    archive.on('finish', function (err) {
      if (err) { throw err }
      callback()
    })

    let output = fs.createWriteStream(file)
    archive.pipe(output)
    var data = {}
    if (os.platform() === 'win32') {
      data.mode = 0o0755
    }

    archive.bulk([
      { expand: true,
        cwd: cwd,
        src: ['**'],
        dest: false,
        filter: filter,
        data: data,
        dot: true
      }
    ]).finalize()
  }
}
