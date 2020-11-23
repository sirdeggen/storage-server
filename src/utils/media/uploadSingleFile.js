const { Storage } = require('@google-cloud/storage')
const path = require('path')

const serviceKey = path.join(__dirname, '../../../keys/srf-media-key.json')

const storage = new Storage({
  keyFilename: serviceKey,
  projectId: 'sunny-river-farm'
})

const bucketName = 'srf-media-prod'

const acceptedTypes = [
  {
    name: 'image',
    regex: /image/
  },
  {
    name: 'video',
    regex: /video/
  }
]

module.exports = (file) =>
  new Promise((resolve, reject) => {
    const { originalname, buffer, mimetype } = file
    let fileType
    let typeAccepted = false
    // Determine if we accept the type of file
    acceptedTypes.forEach((type) => {
      if (type.regex.test(mimetype)) {
        fileType = type.name
        typeAccepted = true
      }
    })
    if (!typeAccepted) {
      reject(new Error('File type rejected'))
    }

    const bucket = storage.bucket(bucketName)

    const blob = bucket.file(
      Date.now().toString().slice(-5) +
        originalname.replace(/ /g, '_').slice(0, 15)
    )
    const blobStream = blob.createWriteStream({
      resumable: false
    })

    blobStream
      .on('finish', () => {
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`

        resolve({ publicUrl, name: blob.name, type: fileType })
      })
      .on('error', (e) => {
        console.log('ERROR', e)
      })
      .end(buffer)
  })
