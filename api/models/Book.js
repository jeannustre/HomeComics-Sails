/**
 * Book.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

var yauzl = require('yauzl')
var fs = require('fs')
var path = require('path')
var util = require('util')
var Unrar = require('unrar')
var Transform = require('stream').Transform

module.exports = {

  attributes: {

    title: {
      type : 'string'
    },
    authors: {
      type: 'array' // array of Author.id
    },
    pages: {
      type: 'int' // number of pages
    },
    year: {
      type: 'int' // date of publication
    },
    contents: {
      type: 'array' // array of strings representing the URL of each page, from the root folder
    },
    location: {
      type: 'string' // location of the first book folder
    },
    cover: {
      type: 'string' // contents[0]
    },

  },

  fromZip: function(options, cb) {
    yauzl.open(options.path, {lazyEntries: true}, zipCallback(options))

  },

  fromRar: function(options, cb) {

  }

};


//
// ZIP
//

function zipCallback(params) {
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
        var bookContents = getContents(currentFolder, params.dataFolder)
        var loc = currentFolder.substring(params.dataFolder.length, currentFolder.length)

        Author.findOne({
          name: params.author
        }).exec(function(err, author){
          if (err) return res.serverError(err)
          if (!author) { // author does not exist, creating
            console.log("author does not exist yet, creating..")
            Author.create({
              name: params.author,
              bio: "",
              wrote: []
            }).exec(function(err, newAuthor) {
              if (err) return res.serverError(err)
              console.log("Created new author : <" + JSON.stringify(newAuthor) + ">")
              Book.create({
                title: params.title,
                authors: [newAuthor.id],
                pages: bookContents.length,
                year: params.year,
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
              title: params.title,
              authors: [author.id],
              pages: bookContents.length,
              year: params.year,
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
        var foldername = params.dataFolder + entry.fileName
        makeDirAsync(foldername, function() {
          if (err) throw err;
          zipfile.readEntry()
        })
      } else {
        zipfile.openReadStream(entry, function(err, readStream) {
          if (err) throw err
          // report progress through large files
          var filename = params.dataFolder + entry.fileName
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

function getContents(dir, dataFolder) {
  var results = []
  //console.log("getContents::dir = <" + dir + ">")
  fs.readdirSync(dir).forEach(function(file) {
    file = dir + '/' + file
    var stat = fs.statSync(file)
    if (stat && stat.isDirectory()) {
      results = results.concat(getContents(file, dataFolder))
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


// TODO: move this to a module for conciseness?
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
