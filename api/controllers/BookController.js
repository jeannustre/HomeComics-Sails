/**
* BookController
*
* @description :: Server-side logic for managing books
* @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
*/

var fs = require('fs')
//var stream = require('stream')
var yauzl = require('yauzl')
var path = require('path')
var util = require('util')
var Unrar = require('node-unrar')
var Transform = require('stream').Transform
// see https://github.com/thejoshwolfe/yauzl/

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
      var archivePath = files[0].fd
      var fnLength = archivePath.length
      var extension = archivePath.substring(fnLength - 4, fnLength)
      if (extension === ".cbz" || extension === ".zip") {
        console.log("Unarchiving zip file...")
        yauzl.open(archivePath, {lazyEntries: true}, handleZipFile)
      } else if (extension === ".cbr" || extension === ".rar") {
        console.log("Unarchiving rar file...")
        var rar = new Unrar(archivePath)
        rar.extract('./UNARCHIVED/', null, function(err) {
          if (err) throw err
          console.log("Unarchived rar file successfully")
        })
      }
      return res.json({
        message: files.length + ' file(s) uploaded successfully!',
        files: files
      })
    })
  }
}

module.exports = Book;

function mkdirp(dir, cb) {
  if (dir === ".") return cb()
  fs.stat(dir, function(err) {
    if (err == null) return cb() // folder already exists
    var parent = path.dirname(dir)
    mkdirp(parent, function() {
      process.stdout.write(dir.replace(/\/$/, "") + "/\n")
      fs.mkdir(dir, cb)
    })
  })
}

function handleZipFile(err, zipfile) {
  if (err) throw err;

  var handleCount = 0
  function incrementHandleCount() {
    handleCount++
  }
  function decrementHandleCount() {
    handleCount--
    if (handleCount === 0) {
      console.log("all input and output handles closed")
    }
  }

  incrementHandleCount()
  zipfile.on("close", function() {
    console.log("closed input file")
    decrementHandleCount()
  })

  zipfile.readEntry()
  zipfile.on("entry", function(entry) {
    if (/\/$/.test(entry.fileName)) {
      // directory file names end with '/'
      mkdirp(entry.fileName, function() {
        if (err) throw err;
        zipfile.readEntry()
      })
    } else {
      // ensure parent directory exists
      mkdirp(path.dirname(entry.fileName), function() {
        zipfile.openReadStream(entry, function(err, readStream) {
          if (err) throw err
          // report progress through large files
          var byteCount = 0
          var totalBytes = entry.uncompressedSize
          var lastReportedString = byteCount + "/" + totalBytes + " 0%"
          process.stdout.write(entry.fileName + "..." + lastReportedString)
          function reportString(msg) {
            var clearString = ""
            for (var i = 0; i < lastReportedString.length; i++) {
              clearString += "\b"
              if (i >= msg.length) {
                clearString += " \b"
              }
            }
            process.stdout.write(clearString + msg)
            lastReportedString = msg
          }
          // report progress at 60hz
          var progressInterval = setInterval(function() {
            reportString(byteCount + "/" + totalBytes + " " + ((byteCount / totalBytes * 100) | 0) + "%")
          }, 1000/60)
          var filter = new Transform()
          filter._transform = function(chunk, encoding, cb) {
            byteCount += chunk.length
            cb(null, chunk)
          }
          filter._flush = function(cb) {
            clearInterval(progressInterval)
            reportString("")
            // delete the "..."
            process.stdout.write("\b \b\b \b\b \b\n")
            cb()
            zipfile.readEntry()
          }

          // pump file contents
          var writeStream = fs.createWriteStream(entry.fileName)
          incrementHandleCount()
          writeStream.on("close", decrementHandleCount)
          readStream.pipe(filter).pipe(writeStream)
        })
      })
    }
  })
}
