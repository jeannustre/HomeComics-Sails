/**
 * Book.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

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

  }

};
