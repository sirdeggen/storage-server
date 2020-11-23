// TODO: Need to figure out if we want to deal in seconds or ms
module.exports = (numberBytes, seconds) => {
  const costPerGBPerMonth = process.env.STORAGE_PRICE_PER_GB_PER_MONTH

  const numGBStored = numberBytes / 1000000000
  const numMonthsStored = seconds / 2628000

  return costPerGBPerMonth * numGBStored * numMonthsStored
}
