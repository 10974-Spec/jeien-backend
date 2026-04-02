/**
 * keepAlive.js
 *
 * Prevents Render.com free-tier spin-down by pinging the server's own
 * health-check endpoint every 14 minutes (Render idles after ~15 min).
 *
 * Only runs in production so it doesn't interfere with local dev.
 */

const https = require('https');
const http  = require('http');

const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

function pingServer(url) {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
        console.log(`[KeepAlive] Ping → ${url} — HTTP ${res.statusCode}`);
        res.resume(); // drain body so socket is released
    });

    req.on('error', (err) => {
        console.warn(`[KeepAlive] Ping error: ${err.message}`);
    });

    req.setTimeout(10_000, () => {
        req.destroy();
        console.warn('[KeepAlive] Ping timed out (10s)');
    });
}

/**
 * Start the keep-alive loop.
 * Renders injects RENDER_EXTERNAL_URL automatically in its environment.
 */
function startKeepAlive() {
    if (process.env.NODE_ENV !== 'production') {
        console.log('[KeepAlive] Skipped — not in production.');
        return;
    }

    const base = (process.env.RENDER_EXTERNAL_URL || 'https://jeien-backend.onrender.com')
        .replace(/\/$/, '');
    const url = `${base}/`;

    console.log(`[KeepAlive] Started — pinging every ${PING_INTERVAL_MS / 60_000} min`);

    // Immediate ping on boot to warm the DB connection pool fast
    pingServer(url);

    setInterval(() => pingServer(url), PING_INTERVAL_MS);
}

module.exports = { startKeepAlive };
