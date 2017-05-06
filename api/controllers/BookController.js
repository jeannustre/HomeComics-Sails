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

//TODO: http://usejsdoc.org

module.exports = {

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
      '<p>Title: </p><input type="text" name="title"><br>'+
      '<p>Author: </p><input type="text" name="author"><br>'+
      '<p>Year: </p><input type="text" name="year"><br>'+
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
      if (err) return res.serverError(err)
      if (files.length === 0) return res.badRequest('No file was uploaded')
      var archivePath = files[0].fd
      var extension = archivePath.substring(archivePath.length - 4, archivePath.length)
      var bookName = files[0].filename.substring(0, files[0].filename.length - 4)
      console.log("Uploaded book <" + bookName + "> with extension <" + extension + ">")
      if (!fs.existsSync(dataFolder)){
        console.log("Creating data folder : " + dataFolder)
        fs.mkdirSync(dataFolder)
      }
      var bookParams = {
        author: req.param('author'),
        year: req.param('year'),
        title: req.param('title'),
        path: archivePath,
        dataFolder: dataFolder
      }
      if (isZip(extension)) {
        Book.fromZip(bookParams, function(book) {
          return res.json(book)
        })
      } else if (isRar(extension)) {
        Book.fromRar(bookParams, function(book){
          return res.json(book)
        })
      } else {
        return res.json({
          error: "Wrong file extension - must be cbz, zip, cbr or rar"
        })
      }
    })
  }
}

function isRar(extension) {
  return extension.toLowerCase() === ".cbr" || extension.toLowerCase() === ".rar" ? true : false
}

function isZip(extension) {
  return extension.toLowerCase() === ".cbz" || extension.toLowerCase() === ".zip" ? true : false
}
