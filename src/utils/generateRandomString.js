import crypto from 'crypto'

export default (length = 16) =>
  // eslint-disable-next-line implicit-arrow-linebreak
  new Promise((resolve) => {
    crypto.randomBytes(length, (err, buf) => {
      resolve(buf.toString('hex'))
    })
  })
