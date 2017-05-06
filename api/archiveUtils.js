var fs = require('fs')
var path = require('path')

module.exports = {
  // All functions defined here are self-calling,
  // so they shouldn't be declared as module keys
  getContents: getContents,
  makeDirAsync: makeDirAsync,
  makeDirSync: makeDirSync
}

function getContents(dir, dataFolder) { // Returns an array of jpg or png files contained in a directory
  var results = [] // This array will store individual pages
  fs.readdirSync(dir).forEach(function(file) { // For each PROVIDED folder (not found recursively)
    file = dir + '/' + file // Get absolute name
    var stat = fs.statSync(file) // Get info about current file
    if (stat && stat.isDirectory()) { // If the file is a directory,
      results = results.concat(getContents(file, dataFolder)) // recursively call this function
    } else { // If this is a file,
      file = file.substring(dataFolder.length, file.length) // remove the CDN url from the path
      var extension = file.substring(file.length - 4, file.length) // isolate extension
      if (extension.toLowerCase() === ".jpg"
      || extension.toLowerCase() === "jpeg"
      || extension.toLowerCase() === ".png") { // If this is an image,
        results.push(file) // add it to the page array
      } else {
        console.log("Non-image file <" + file + "> not added to index")
      }
    }
  })
  return results
}

// TODO: These two functions seriously needs rework
function makeDirAsync(dir, cb) {
  if (dir === ".") return cb()
  var parent = path.dirname(dir)
  if (parent === "./UNARCHIVED") { // try to access dataFolder from here instead
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

function makeDirSync(dir) {
  if (dir === ".") return
  var parent = path.dirname(dir)
  if (parent === "./UNARCHIVED") {
    currentFolder = dir
  }
  if (!fs.existsSync(dir)){
    if (!fs.existsSync(parent)) {
      makeDirSync(parent)
    }
    fs.mkdirSync(dir)
  } else {
    console.log("MAKEDIRSYNC : folder " + dir + " already exists")
  }
}
