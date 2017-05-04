/**
* BookController
*
* @description :: Server-side logic for managing books
* @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
*/

var fs = require('fs')
var stream = require('stream')
var yauzl = require('yauzl')
// see https://github.com/thejoshwolfe/yauzl/blob/master/examples/unzip.js

var Book = {

  index: function(req, res) {
    res.writeHead(200, {'content-type': 'text/html'});
    res.end(
      '<form action="http://localhost:1337/book/upload" enctype="multipart/form-data" method="post">'+
      '<input type="text" name="title"><br>'+
      '<input type="file" name="archive" multiple="multiple"><br>'+
      '<input type="submit" value="Upload">'+
      '</form>'
    )
  },

  upload: function(req, res) {
    req.file('archive').upload({
      // 800MB
      maxBytes: 800000000
    }, function(err, files) {
      if (err) {
        return res.serverError(err)
      }
      if (files.length === 0) {
        return res.badRequest('No file was uploaded')
      }

      var path = files[0].fd
      console.log('unzipping file at ' + path)
      yauzl.open(path, {lazyEntries: true}, function(err, zipfile) {
        if (err) throw err;
        zipfile.readEntry();
        zipfile.on("entry", function(entry) {
          console.log('entry: ' + JSON.stringify(entry))
          if (/\/$/.test(entry.fileName)) {
            console.log('A')
            zipfile.readEntry()
            // Directory file names end with '/'.
            // Note that entires for directories themselves are optional.
            // An entry's fileName implicitly requires its parent directories to exist.
          } else {
            // file entry
            console.log('B')
            zipfile.openReadStream(entry, function(err, readStream) {
              if (err) throw err;
              readStream.on("end", function() {
                zipfile.readEntry();
              });
              //readStream.pipe(fsomewhere);
            });
          }
        });
      })


      return res.json({
        message: files.length + ' file(s) uploaded successfully!',
        files: files
      })

    })

  }
}

module.exports = Book;
