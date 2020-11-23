const generateRandomString = require('../generateRandomString')

describe('Generate random string', () => {
  it('should produce a 32 character string', async () => {
    expect(await generateRandomString()).toHaveLength(32)
  })
})
