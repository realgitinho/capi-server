require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const app = express();
const PORT = 3000;

const allowedOrigins = [
  'http://127.0.0.1:5500',
  'https://trygutreset.store',
  'https://www.trygutreset.store'
  'https://go.trygutreset.store'
];

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
    max: 30
});

app.use('/track-event', limiter);

app.get('/', (req, res) => {
    console.log('Someone hit the homepage!');
    res.send('Hello, your server is alive!');
});

app.post('/track-event', async (req, res) => {
    console.log('Received event:', req.body);

    const { event_name, event_id, event_time, page_url } = req.body;

    const payload = {
        data: [
            {
                event_name: event_name,
                event_time: event_time,
                event_id: event_id,
                event_source_url: page_url,
                action_source: 'website',
                user_data: {
                    client_ip_address: req.ip,
                    client_user_agent: req.headers['user-agent']
                }
            }
        ]
    };

    const metaUrl = `https://graph.facebook.com/v20.0/${process.env.META_PIXEL_ID}/events?access_token=${process.env.META_ACCESS_TOKEN}`;

    try {
        const metaResponse = await fetch(metaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const metaResult = await metaResponse.json();
        console.log('Meta response:', metaResult);

        res.send('Event forwarded to Meta');
    } catch (error) {
        console.error('Error sending to Meta:', error);
        res.status(500).send('Failed to forward event');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
