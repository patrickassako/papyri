/**
 * Helpers de réponse HTTP standardisés
 * Format unifié : { success, data } ou { success, error }
 */

/**
 * @param {import('express').Response} res
 * @param {*} data
 * @param {number} [statusCode=200]
 */
const sendSuccess = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ success: true, data });

/**
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [statusCode=500]
 * @param {string} [code]
 */
const sendError = (res, message, statusCode = 500, code = 'ERROR') =>
  res.status(statusCode).json({ success: false, error: { code, message } });

module.exports = { sendSuccess, sendError };
