const ejs = require('ejs')
const fs = require('fs')
require('dotenv').config()

ejs.renderFile('src/templates/hash-brown.ejs', process.env, {}, (err, res) => {
  if (err) {
    throw err
  }
  console.log('Generating well-known configuration...')
  console.log(res)
  fs.writeFileSync('public/.well-known/cwi-secret-server', res)
})
