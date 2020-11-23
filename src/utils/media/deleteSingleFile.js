const { Storage } = require('@google-cloud/storage')
const path = require('path')

const serviceKey = path.join(__dirname, '../../../keys/srf-media-key.json')

const storage = new Storage({
  keyFilename: serviceKey,
  projectId: 'sunny-river-farm'
})

const bucketName = 'srf-media-prod'

module.exports = async (name) => {
  const file = storage.bucket(bucketName).file(name)

  await file.delete()

  return true
}
