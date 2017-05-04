/**
 * BookController
 *
 * @description :: Server-side logic for managing books
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

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
      // 400MB
      maxBytes: 400000000
    }, function(err, files) {
      if (err)
        return res.serverError(err)
      if (files.length === 0)
        return res.badRequest('No file was uploaded')
      return res.json({
        message: files.length + ' file(s) uploaded successfully!',
        files: files
      })
    })
  }

};

module.exports = Book;
