const axios = require('axios');

async function sendGAEvent({ measurementId, apiSecret, clientId, eventName, params }) {
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
  const body = {
    client_id: clientId, // Should be a unique identifier per user/session
    events: [
      {
        name: eventName,
        params: params || {}
      }
    ]
  };
  try {
    await axios.post(url, body);
  } catch (err) {
    console.error('GA4 event error:', err.response?.data || err.message);
  }
}

module.exports = sendGAEvent;