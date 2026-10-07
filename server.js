require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
    'http://127.0.0.1:5500',
    'https://trygutreset.store',
    'https://www.trygutreset.store',
    'https://go.trygutreset.store'
];

// Render sits behind a proxy, so the visitor's real IP is the first address in X-Forwarded-For
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.ip;
}

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

app.use(express.json());

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: getClientIp,
    validate: { xForwardedForHeader: false }
});

app.use('/track-event', limiter);

app.get('/', (req, res) => {
    console.log('Someone hit the homepage!');
    res.send('Hello, your server is alive!');
});

app.get('/health', (req, res) => {
    res.send('ok');
});

app.post('/track-event', async (req, res) => {
    console.log('Received event:', req.body);

    const { event_name, event_id, event_time, page_url, event_data, fbp, fbc } = req.body;

    const userData = {
        client_ip_address: getClientIp(req),
        client_user_agent: req.headers['user-agent']
    };
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;

    const event = {
        event_name: event_name,
        event_time: event_time,
        event_id: event_id,
        event_source_url: page_url,
        action_source: 'website',
        user_data: userData
    };
    if (event_data && typeof event_data === 'object') {
        event.custom_data = event_data;
    }

    const payload = { data: [event] };

    const metaUrl = `https://graph.facebook.com/v25.0/${process.env.META_PIXEL_ID}/events?access_token=${process.env.META_ACCESS_TOKEN}`;

    try {
        const metaResponse = await fetch(metaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const metaResult = await metaResponse.json();
        console.log('Meta response:', metaResult);

        if (!metaResponse.ok) {
            return res.status(502).send('Meta rejected the event');
        }

        res.send('Event forwarded to Meta');
    } catch (error) {
        console.error('Error sending to Meta:', error);
        res.status(500).send('Failed to forward event');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});