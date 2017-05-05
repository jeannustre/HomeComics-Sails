/**
 * Author.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

module.exports = {

  attributes: {

    name : {
      type: 'string'
    },

    bio: {
      type: 'string' // Author description - facultative
    },

    wroteBook: {
      type: 'array' // array of Book.id
    },

    wroteSerie: {
      type: 'array' // array of Serie.id
    }

  }
};
