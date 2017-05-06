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

  // public methods
  fromZip: function(options, cb) {
    yauzl.open(options.path, {lazyEntries: true}, zipCallback(options, cb))
  },
  fromRar: function(options, cb) {
    rar = new Unrar(options.path)
    rar.list(rarCallback(options, cb))
  }
};

function rarCallback(options, cb) {
  return function handleRarFile(err, entries) {
    for (var i = 0; i < entries.length; i++) { // We run through all entries first
      if (entries[i].type !== 'File') { // If an entry is a directory...
        Archive.makeDirSync(options.dataFolder + entries[i].name) // create it
      }
    }
    for (var i = 0; i < entries.length; i++) {  // Then we run through them all again...
      var name = entries[i].name // How unoptimized. Boo.
      if (entries[i].type !== 'File')  continue; // Just skip the directories this time
      try { // and if it's a file, write it
        rar.stream(name).pipe(fs.createWriteStream(options.dataFolder + name))
      } catch (e) {
        throw e
      }
    } // Unarchiving complete, registering Book
    var bookContents = Archive.getContents(currentFolder, options.dataFolder)
    var bookParams = { // We create common parameters for the book
      title: options.title,
      authors: [], // This will be filled when an Author has been found or created
      pages: bookContents.length,
      year: options.year,
      location: currentFolder.substring(options.dataFolder.length, currentFolder.length),
      contents: bookContents,
      cover: bookContents[0]
    }
    Author.findOne({ // We try to find an Author...
      name: options.author // with the provided name
    }).exec(function(err, author){
      if (err) return res.serverError(err)
      if (!author) { // If we don't find one,
        Author.create({ // We create one...
          name: options.author, // with the supplied name...
          bio: "", // an empty biography...
          wrote: [] // and an empty array of Book.id, which we will update afterwards
        }).exec(function(err, newAuthor) {
          if (err) return res.serverError(err)
          bookParams.author.push(newAuthor.id) // Update parameters with the new Author's id
          Book.create(bookParams).exec(function(err, records) { // Once the Book is created...
            if (err) return res.serverError(err)
            newAuthor.wrote.push(records.id) // ... we add it's id to the Author's array of Book.id
            newAuthor.save()
            cb(records) // Finally, we return the newly created Book as json
          })
        })
      } else { // We found an Author!
        bookParams.author.push(author.id) // Same as above, but with the extisting Author info
        Book.create(bookParams).exec(function(err, records) {
          if (err) return res.serverError(err)
          author.wrote.push(records.id) //
          author.save()
          cb(records)
        })
      }
    })
  }
}

function zipCallback(params, cb) {
  return function handleZipFile(err, zipfile) {
    if (err) throw err;
    var handleCount = 0 // This will help us keep track of opened file handlers
    function incrementHandleCount() { // TODO : This seems useless
      handleCount++
    }
    function decrementHandleCount() {
      handleCount--
      if (handleCount === 0) { // If no more files are being written to, the unarchiving is over
        var bookContents = Archive.getContents(currentFolder, params.dataFolder) // Get contents of main book folder recursively
        registerBook({ // Registering Book into database
          title: params.title,
          authors: [],
          pages: bookContents.length,
          year: params.year,
          location: currentFolder.substring(params.dataFolder.length, currentFolder.length),
          contents: bookContents,
          cover: bookContents[0]
        })
      }
    }

    incrementHandleCount() // To start things up
    zipfile.on("close", function() { // When an entry has been closed,
      decrementHandleCount() // reduce the number of remaining entries to pop
    })

    zipfile.readEntry() // We pop the first entry, but not until the 'entry' event listener is attached
    zipfile.on("entry", function(entry) { // So this always fire directly
      if (/\/$/.test(entry.fileName)) { // If file name ends with a '/', it means it's a directory
        var foldername = params.dataFolder + entry.fileName // CDN url + directory path
        Archive.makeDirAsync(foldername, function() { // The folder has been created
          if (err) throw err;
          zipfile.readEntry() // so we pop the next entry
        })
      } else { // If the file name doesn't end with a '/', it's a file
        zipfile.openReadStream(entry, function(err, readStream) { // Read on that file with a stream
          if (err) throw err
          var filename = params.dataFolder + entry.fileName
          var filter = new Transform()
          filter._transform = function(chunk, encoding, cb) {
            cb(null, chunk)
          }
          filter._flush = function(cb) { // We use the filter's flush event to drecremend the handle count
            cb() // see writeStream.on("close") below
            zipfile.readEntry()
          }
          var writeStream = fs.createWriteStream(filename) // Prepare to write on destination file
          incrementHandleCount() // Keep trace of the open stream
          writeStream.on("close", decrementHandleCount) // When stream is closed, release handle
          readStream.pipe(filter).pipe(writeStream) // Pipe the read stream to the write stream
        })
      }
    })

    function registerBook(bookParams) { // Called when unarchiving is over
      Author.findOne({ // We try to find an Author
        name: params.author // with the provided name
      }).exec(function(err, author){
        if (err) return res.serverError(err)
        if (!author) { // If we don't find one,
          Author.create({ // create it
            name: params.author, // with the supplied name...
            bio: "", // an empty biography...
            wrote: [] // and an empty array of Book.id, which we will update afterwards
          }).exec(function(err, newAuthor) {
            if (err) return res.serverError(err)
            bookParams.authors.push(newAuthor.id) // Update parameters with the new Author's id
            Book.create(bookParams).exec(function(err, records) { // Once the Book is created...
              if (err) return res.serverError(err)
              newAuthor.wrote.push(records.id) // ... we add it's id to the Author's array of Book.id
              newAuthor.save()
              cb(records) // Finally, we return the newly created Book as json
            })
          })
        } else { // We found an Author!
          bookParams.authors.push(author.id) // Same as above, but with the existing Author info
          Book.create(bookParams).exec(function(err, records) {
            if (err) return res.serverError(err)
            author.wrote.push(records.id)
            author.save()
            cb(records)
          })
        }
      })
    }
  }
}
