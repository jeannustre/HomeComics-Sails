/**
 * AuthorController
 *
 * @description :: Server-side logic for managing authors
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {

	books: function(req, res) {
		Book.find({
			where: {
				authors: {'contains' : req.param('aid')}
			},
			select: ['title', 'authors', 'pages', 'year', 'location', 'cover', 'id']
    }).exec(function(err, books) {
      if (err) {
        return res.serverError(err)
      }
			console.log("OMG OMG OMG")
      return res.json(books);
		})
	}


};
