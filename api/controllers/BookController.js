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
var currentFolder = ""
// see https://github.com/thejoshwolfe/yauzl/

//TODO: http://usejsdoc.org

var BookC = {

  // /book returns all Books as json, excluding Book.contents
  index: function(req, res) {
    Book.find({
      where: {},
      select: ['title', 'authors', 'pages', 'year', 'location', 'cover', 'id']
    }).exec(function(err, books) {
      if (err) {
        return res.serverError(err)
      }
      return res.json(books);
    })
  },

  // /book/upload returns a form to upload cbz/cbr
  upload: function(req, res) {
    res.writeHead(200, {
      'content-type': 'text/html'
    });
    res.end(
      '<form action="http://localhost:1337/book/doUpload" enctype="multipart/form-data" method="post" accept-charset="UTF-8">'+
      '<input type="text" name="title"><br>'+
      '<input type="text" name="author"><br>'+
      '<input type="text" name="year"><br>'+
      '<input type="file" name="archive" multiple="multiple"><br>'+
      '<input type="submit" value="Upload">'+
      '</form>'
    )
  },

  // test
  read: function(req, res) {
    return res.send("okkkk")
  },

  // called by /book/upload input
  doUpload: function(req, res) {
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
      //currentFolder = bookName
      if (!fs.existsSync(dataFolder)){
        console.log("Creating data folder : " + dataFolder)
        fs.mkdirSync(dataFolder)
      }
      if (isZip(extension)) {
        console.log("Unarchiving zip file...")
        yauzl.open(archivePath, {lazyEntries: true}, zipCallback(req))
      } else if (isRar(extension)) {
        rar = new Unrar(archivePath)
        console.log("Unarchiving rar file...")
        rar.list(rarCallback(req))
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

module.exports = BookC;

function isRar(extension) {
  return extension === ".cbr" || extension === ".rar" ? true : false
}

function isZip(extension) {
  return extension === ".cbz" || extension === ".zip" ? true : false
}

function makeDirSync(dir) {
  if (dir === ".") return
  // do the parent === ./UNARCHIVED check here instead?
  var parent = path.dirname(dir)
  if (parent === "./UNARCHIVED") {
    // this is the book root directory
    console.log("ROOT FOLDER ::: " + dir)
    currentFolder = dir
  }
  if (!fs.existsSync(dir)){
    if (!fs.existsSync(parent)) {
      makeDirSync(parent)
    }
    fs.mkdirSync(dir)
  } else {
    console.log("MAKEDIRSYNC : folder " + dir + " already exists")
  }
}

function makeDirAsync(dir, cb) {
  if (dir === ".") return cb()
  var parent = path.dirname(dir)
  if (parent === "./UNARCHIVED") {
    // this is the book root directory
    console.log("ROOT FOLDER ::: " + dir)
    currentFolder = dir
  }
  fs.stat(dir, function(err) {
    if (err == null) return cb() // folder already exists
    makeDirAsync(parent, function() {
      process.stdout.write(dir.replace(/\/$/, "") + "/\n")
      fs.mkdir(dir, cb)
    })
  })
}

//
// RAR
//

function rarCallback(req) {
  console.log("PARAM :: " + req.param("title"))
  console.log("PARAM :: " + req.param("author"))
  console.log("PARAM :: " + req.param("year"))

  return function handleRarFile(err, entries) {
    // We run through all entries first to create folders...
    for (var i = 0; i < entries.length; i++) {
      var name = entries[i].name
      var type = entries[i].type
      if (type !== 'File') {
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
    // now check contents
    var bookContents = getContents(currentFolder)
    var loc = currentFolder.substring(dataFolder.length, currentFolder.length)

    // Checking if provided author exists
    Author.findOne({
      name: req.param("author")
    }).exec(function(err, author){
      if (err) return res.serverError(err)
      if (!author) { // author does not exist, creating
        console.log("author does not exist yet, creating..")
        Author.create({
          name: req.param("author"),
          bio: "",
          wrote: []
        }).exec(function(err, newAuthor) {
          if (err) return res.serverError(err)
          console.log("Created new author : <" + JSON.stringify(newAuthor) + ">")
          Book.create({ // author created, now creating book
            title: req.param("title", "No Title"),
            authors: [newAuthor.id],
            pages: bookContents.length,
            year: req.param("year", 0),
            location: loc,
            contents: bookContents,
            cover: bookContents[0]
          }).exec(function(err, records) {
            if (err) return res.serverError(err)
            // created book, adding Book.id to Author.wrote
            newAuthor.wrote.push(records.id)
            newAuthor.save()
            console.log("added id of book to author " + newAuthor.id)
            console.log("Error: " + err)
            console.log("Created Book with id " + records.id)
          })
        })
      } else { // author already exists, creating book
        console.log("author does already exist, adding book..")
        Book.create({
          title: req.param("title", "No Title"),
          authors: [author.id],
          pages: bookContents.length,
          year: req.param("year", 0),
          location: loc,
          contents: bookContents,
          cover: bookContents[0]
        }).exec(function(err, records) {
          if (err) return res.serverError(err)
          // created book, adding Book.id to Author.wrote
          author.wrote.push(records.id)
          author.save()
          console.log("added id of book to author " + author.id)
          //console.log("Created book : \n" + JSON.stringify(records))
          console.log("Error: " + err)
          console.log("Created Book with id " + records.id)
        })
      }
    })
  }
}

//
// ZIP
//

function zipCallback(req) {
  return function handleZipFile(err, zipfile) {
    if (err) throw err;

    var handleCount = 0
    function incrementHandleCount() {
      handleCount++
    }
    function decrementHandleCount() {
      handleCount--
      if (handleCount === 0) {
        console.log("all input and output handles closed")
        var bookContents = getContents(currentFolder)
        var loc = currentFolder.substring(dataFolder.length, currentFolder.length)

        Author.findOne({
          name: req.param("author")
        }).exec(function(err, author){
          if (err) return res.serverError(err)
          if (!author) { // author does not exist, creating
            console.log("author does not exist yet, creating..")
            Author.create({
              name: req.param("author"),
              bio: "",
              wrote: []
            }).exec(function(err, newAuthor) {
              if (err) return res.serverError(err)
              console.log("Created new author : <" + JSON.stringify(newAuthor) + ">")
              Book.create({
                title: req.param("title", "No Title"),
                authors: [newAuthor.id],
                pages: bookContents.length,
                year: req.param("year", 0),
                location: loc,
                contents: bookContents,
                cover: bookContents[0]
              }).exec(function(err, records) {
                newAuthor.wrote.push(records.id)
                newAuthor.save()
                console.log("Error: " + err)
                console.log("Created Book with id " + records.id)
              })
            })
          } else { // author already exists
            console.log("author does already exist, adding book..")
            Book.create({
              title: req.param("title", "No Title"),
              authors: [author.id],
              pages: bookContents.length,
              year: req.param("year", 0),
              location: loc,
              contents: bookContents,
              cover: bookContents[0]
            }).exec(function(err, records) {
              if (err) return res.serverError(err)
              // created book, adding Book.id to Author.wrote
              author.wrote.push(records.id)
              author.save()
              //console.log("Created book : \n" + JSON.stringify(records))
              console.log("Created Book with id " + records.id + "and author id " + author.id)
            })
          }
        })
      } //endif handleCount == 0
    } // end decrementHandleCount

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
      }
    })
  }
}

function getContents(dir) {
  var results = []
  //console.log("getContents::dir = <" + dir + ">")
  fs.readdirSync(dir).forEach(function(file) {
    file = dir + '/' + file
    var stat = fs.statSync(file)
    if (stat && stat.isDirectory()) {
      results = results.concat(getContents(file))
    } else {
      filelength = file.length
      file = file.substring(dataFolder.length, filelength)
      var extension = file.substring(file.length - 4, file.length)
      if (extension === ".jpg" || extension === "jpeg" || extension === ".png") {
        results.push(file)
      } else {
        console.log("Non-image file <" + file + "> not added to index")
      }
    }
  })
  return results
}
