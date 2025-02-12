import { Storage } from '@google-cloud/storage'
import path from 'path'

const { NODE_ENV, GCP_BUCKET_NAME, GCP_PROJECT_ID } = process.env

interface UploadParams {
  size: Number
  objectIdentifier: String
}

interface UploadResponse {
  uploadURL: string
}

const devUploadFunction = (): UploadResponse => {
  console.log('[DEV] Returning pretend upload URL http://localhost:8080/upload')
  return { uploadURL: 'http://localhost:8080/upload'}
}

const prodUploadFunction = async ({ size, objectIdentifier }: UploadParams): Promise<UploadResponse> => {
  if (!GCP_BUCKET_NAME || !GCP_PROJECT_ID) {
    throw new Error('Missing required Google Cloud Storage eviornment variables.')
  }
  const serviceKey = path.join(__dirname, '../../storage-creds.json')
  const storage = new Storage({
    keyFilename: serviceKey,
    projectId: GCP_PROJECT_ID
  })

  const bucket = storage.bucket(GCP_BUCKET_NAME)
  const bucketFile = bucket.file(`cdn/${objectIdentifier}`)

  const uploadURL = await (bucketFile.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 604000 * 1000, // 1 week
    extensionHeaders: {
      'content-length': size.toString()
    }
  })).toString()
  return { uploadURL }
}

const getUploadURL = NODE_ENV === 'development' ? devUploadFunction : prodUploadFunction
export default getUploadURL