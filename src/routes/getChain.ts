import { Ninja } from 'ninja-base'
import { Request, Response } from 'express'

const {
  SERVER_PRIVATE_KEY,
  DOJO_URL
} = process.env

interface GetChainResponse {
  status: 'success' | 'error'
  chain?: 'test' | 'main'
  code?: string
  description?: string
}

const getChainHandler = async (req: Request, res: Response<GetChainResponse>) => {
    try {
      console.log('processing getChain...')

      const ninja = new Ninja({
        privateKey: SERVER_PRIVATE_KEY as string,
        config: {
          dojoURL: DOJO_URL as string
        }
      })

      const chain = await ninja.getChain()

      // Return the required info to the sender
      return res.status(200).json({
        status: 'success',
        chain
      })
    } catch (e) {
      console.error(e)
      return res.status(500).json({
        status: 'error',
        code: 'ERR_INTERNAL_PROCESSING_GETCHAIN',
        description: 'An internal error has occurred while processing getChain.'
      })
    }
  }

export default {
  type: 'get',
  path: '/getChain',
  summary: 'Use this route to confirm the chain this service is configured to run on.',
  parameters: {
  },
  exampleResponse: {
    status: 'success',
    chain: 'test'
  },
  errors: [
  ],
  func: getChainHandler
}