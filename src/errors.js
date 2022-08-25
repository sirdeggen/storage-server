module.exports = {
  ERR_PAYMAIL_NOT_FOUND: 'This paymail was not found on this server.',
  ERR_INTERNAL: 'An internal server error has occurred.',
  ERR_UNAUTHORIZED: 'Access is denied due to an authorization error.',
  ERR_INVALID_REFERENCE: 'The transaction reference is invalid.',
  ERR_INVALID_TRANSACTION_STATUS: stat => `The status of this transaction is ${stat}, which is not compatible with this operation. The transaction was not broadcasted by the recipient.`,
  ERR_REQUEST_EXPIRED: 'The reference you have provided is expired. The transaction was not broadcasted by the recipient.',
  ERR_PAYMAIL_MISMATCH: 'This paymail is not the same one used to create the request. The transaction was not broadcasted by the recipient.',
  ERR_TRANSACTION_REJECTED: 'This transaction was rejected and was not broadcasted by the recipient. Ensure that all specified output scripts are present with the correct amounts assigned to each.',
  ERR_SENDER_SIGNATURE_CHECK: 'The signature you provided to authenticate this Paymail sender is not valid.',
  ERR_PAYMAIL_UNAVAILABLE: 'This Paymail handle is unavailable for registration by this server.',
  ERR_INVALID_PAYMAIL_DOMAIN: 'This server is not accepting registrations for new Paymail handles under the specified domain name.',
  ERR_NOT_SUFFICIENT_FUNDS: 'There are not sufficient funds for this operation.',
  ERR_BAD_REQUEST: 'The request is invalid.',
  ERR_INVALID_OUTPOINT: 'The outpoint (txid and vout combination) does not belong to a transaction known by this user of the server.',
  ERR_MISSING_PARAMETER: (name, type) => `The ${name} parameter is missing, but it must be ${type}.`,
  ERR_TRANSACTION_NOT_FOUND: 'The transaction cannot be found linked with your user account.',
  ERR_LABEL_NOT_FOUND: 'The label cannot be found linked with your user account.'
}
