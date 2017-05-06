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
var Archive = require('../archiveUtils.js')

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
    console.log("REQUIRE  : " + JSON.stringify(Archive))
    yauzl.open(options.path, {lazyEntries: true}, zipCallback(options, cb))
  },

  fromRar: function(options, cb) {

  }

};


//
// ZIP
//

function zipCallback(params, cb) {
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
        console.log("Archive : <" + JSON.stringify(Archive) + ">")
        var bookContents = Archive.getContents(currentFolder, params.dataFolder)
        var loc = currentFolder.substring(params.dataFolder.length, currentFolder.length)

        var bookParams = {
          title: params.title,
          authors: [],
          pages: bookContents.length,
          year: params.year,
          location: loc,
          contents: bookContents,
          cover: bookContents[0]
        }

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
              bookParams.authors.push(newAuthor.id)
              console.log("Creating book with params: " + JSON.stringify(bookParams))
              Book.create(bookParams).exec(function(err, records) {
                newAuthor.wrote.push(records.id)
                newAuthor.save()
                console.log("Created Book with id <" + records.id + "> and new Author with id <" + newAuthor.id + ">")
                cb(records)
              })
            })
          } else { // author already exists
            bookParams.authors.push(author.id)
            Book.create(bookParams).exec(function(err, records) {
              if (err) return res.serverError(err)
              author.wrote.push(records.id)
              author.save()
              console.log("Created Book with id <" + records.id + "> and Author with id <" + author.id + ">")
              cb(records)
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
        Archive.makeDirAsync(foldername, function() {
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
