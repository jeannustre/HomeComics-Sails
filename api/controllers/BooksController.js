/**
 * BooksController
 *
 * @description :: Server-side logic for managing books
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

var Books = {

	all: function(req, res) {
		return Book.query('SELECT book.title, book.author, book.pages, book.year, book.id, book.location, book.cover FROM book', function (err, result){
			if (err) {
    		return res.serverError(err);
  		}
  		return res.json(result.rows);
		});
	}

};

module.exports = Books;
