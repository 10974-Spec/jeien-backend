const https = require('https');

const keepAlive = (url) => {
    if (!url) return;

    setInterval(() => {
        https.get(url, (res) => {
            console.log(`Keep-Alive Ping: ${res.statusCode}`);
        }).on('error', (e) => {
            console.error(`Keep-Alive Error: ${e.message}`);
        });
    }, 14 * 60 * 1000); // Every 14 minutes
};

module.exports = keepAlive;
