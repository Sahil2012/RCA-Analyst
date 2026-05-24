const axios = require("axios");
const logger = require("../logger");

/**
 * Generic API fetcher with error handling
 */
async function fetchAPI(url, params = {}, headers = {}) {
  try {
    const response = await axios.get(url, { params, headers, timeout: 10000 });
    return { success: true, data: response.data };
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.message;
    logger.error("API fetch failed", {
      url,
      status,
      message,
    });
    return { success: false, error: message, status };
  }
}

module.exports = { fetchAPI };
