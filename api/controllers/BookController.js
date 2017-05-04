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
var Unrar = require('unrar')
var Transform = require('stream').Transform
var dataFolder = "./UNARCHIVED/"
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
      var extension = archivePath.substring(archivePath.length - 4, archivePath.length)
      var bookName = files[0].filename.substring(0, files[0].filename.length - 4)
      console.log("Unarchiving book <" + bookName + "> with extension <" + extension + ">")
      if (!fs.existsSync(dataFolder)){
        console.log("Creating data folder : " + dataFolder)
        fs.mkdirSync(dataFolder)
      }

      if (isZip(extension)) {
        console.log("Unarchiving zip file...")
        yauzl.open(archivePath, {lazyEntries: true}, handleZipFile)
      } else if (isRar(extension)) {
        rar = new Unrar(archivePath)
        console.log("Unarchiving rar file...")
        rar.list(handleRarFile)
      } else {
        console.log("wrong file extension")
      }
      return res.json({
        message: files.length + ' file(s) uploaded successfully!',
        files: files
      })
    })

  }
}

module.exports = Book;

function isRar(extension) {
  return extension === ".cbr" || extension === ".rar" ? true : false
}

function isZip(extension) {
  return extension === ".cbz" || extension === ".zip" ? true : false
}

function makeDirSync(dir) {
  if (dir === ".") return
  if (!fs.existsSync(dir)){
    console.log("makeDirSync: creating folder <" + dir + ">")
    var parent = path.dirname(dir)
    console.log("makeDirSync: parent <" + parent + ">")
    if (!fs.existsSync(parent)) {
      makeDirSync(parent)
    }
    console.log("makeDirSync: unstacked")
    fs.mkdirSync(dir)
  }
}

function makeDirAsync(dir, cb) {
  if (dir === ".") return cb()
  fs.stat(dir, function(err) {
    if (err == null) return cb() // folder already exists
    var parent = path.dirname(dir)
    makeDirAsync(parent, function() {
      process.stdout.write(dir.replace(/\/$/, "") + "/\n")
      fs.mkdir(dir, cb)
    })
  })
}

function handleRarFile(err, entries) {
  // We run through all entries first to create folders...
  for (var i = 0; i < entries.length; i++) {
    var name = entries[i].name
    var type = entries[i].type
    if (type !== 'File') {
      //console.log("(1/2) Creating folder: <" + name + ">")
      makeDirSync(dataFolder + name)
    }
  }
  // Then we go through a second time to write files
  for (var i = 0; i < entries.length; i++) {
    var name = entries[i].name
    var type = entries[i].type
    if (type !== 'File') {
      continue;
    }
    try {
      rar.stream(name).pipe(fs.createWriteStream(dataFolder + name))
    } catch (e) {
      throw e
    }
  }
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
      var foldername = dataFolder + entry.fileName
      makeDirAsync(foldername, function() {
        if (err) throw err;
        zipfile.readEntry()
      })
    } else {
      makeDirAsync(path.dirname(entry.fileName), function() {
        zipfile.openReadStream(entry, function(err, readStream) {
          if (err) throw err
          // report progress through large files
          var filename = dataFolder + entry.fileName
          var filter = new Transform()
          filter._transform = function(chunk, encoding, cb) {
            cb(null, chunk)
          }
          filter._flush = function(cb) {
            cb()
            zipfile.readEntry()
          }
          // pump file contents
          var writeStream = fs.createWriteStream(filename)
          incrementHandleCount()
          writeStream.on("close", decrementHandleCount)
          readStream.pipe(filter).pipe(writeStream)
        })
      })
    }
  })
}
