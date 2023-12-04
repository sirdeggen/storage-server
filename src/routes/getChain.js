const { Ninja } = require('ninja-base')
const {
  SERVER_PRIVATE_KEY,
  DOJO_URL
} = process.env

module.exports = {
  type: 'get',
  path: '/getChain',
  summary: 'Use this route to confirm the chain this service is configured to run on.',
  parameters: {
  },
  exampleResponse: {
    status: 'success',
    chain: 'test' | 'main'
  },
  errors: [
  ],
  func: async (req, res) => {
    try {
      console.log('processing getChain...')

      const ninja = new Ninja({
        privateKey: SERVER_PRIVATE_KEY,
        config: {
          dojoURL: DOJO_URL
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
}
