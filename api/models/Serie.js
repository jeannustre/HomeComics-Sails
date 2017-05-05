/**
 * Serie.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

module.exports = {

  attributes: {

    name: {
      type: 'string'
    },

    type: {
      type: 'string' // e.g. "Comic", "Manga", "Artbook"
    },

    books: {
      type: 'array' // array of Book.id
    }

  }
};
