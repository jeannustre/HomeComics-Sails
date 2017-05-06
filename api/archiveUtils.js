var fs = require('fs')
var path = require('path')

module.exports = {

  getContents: function(dir, dataFolder) {
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
  },
  makeDirAsync: function(dir, cb) {
    if (dir === ".") return cb()
    var parent = path.dirname(dir)
    if (parent === "./UNARCHIVED") {
      // this is the book root directory
      console.log("ROOT FOLDER ::: " + dir)
      currentFolder = dir
      console.log("currentFolder :" + currentFolder)
    }
    fs.stat(dir, function(err) {
      if (err == null) return cb() // folder already exists
      makeDirAsync(parent, function() {
        process.stdout.write(dir.replace(/\/$/, "") + "/\n")
        fs.mkdir(dir, cb)
      })
    })
  }
}
