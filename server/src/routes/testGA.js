const express = require('express');
const router = express.Router();
const sendGAEvent = require('../utils/sendGAEvent');

router.get('/test-ga', async (req, res) => {
    try {
        await sendGAEvent({
            measurementId: process.env.GOOGLE_ANALYTICS_ID,
            apiSecret: process.env.GA_API_SECRET,
            clientId: 'test-client-' + Date.now(),
            eventName: 'test_event',
            params: {
                test_param: 'debugging'
            }
        });
        res.send('GA4 test event sent!');
    } catch (err) {
        console.error('Test-GA Route Error:', err);
        res.status(500).send('GA4 test event failed');
    }
});

module.exports = router;