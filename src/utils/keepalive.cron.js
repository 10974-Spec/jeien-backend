const axios = require('axios');
const mongoose = require('mongoose');

// Keep-alive configuration
const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutes
const API_URL = process.env.API_URL || 'http://localhost:5000';
const HEALTH_ENDPOINT = `${API_URL}/api/health`;

let keepAliveTimer = null;
let pingCount = 0;
let lastPingTime = null;
let consecutiveFailures = 0;

/**
 * Ping the health endpoint to keep the server awake
 */
const pingServer = async () => {
    try {
        const startTime = Date.now();
        const response = await axios.get(HEALTH_ENDPOINT, {
            timeout: 30000, // 30 second timeout
            headers: {
                'User-Agent': 'KeepAlive-Cron/1.0'
            }
        });

        const responseTime = Date.now() - startTime;
        pingCount++;
        lastPingTime = new Date();
        consecutiveFailures = 0;

        console.log(`[KeepAlive] Ping #${pingCount} successful (${responseTime}ms)`);
        console.log(`[KeepAlive] Status: ${response.data.status}`);
        console.log(`[KeepAlive] Uptime: ${Math.floor(response.data.uptime / 60)} minutes`);

        // Check database connection
        const dbState = mongoose.connection.readyState;
        const dbStatus = dbState === 1 ? 'Connected' : dbState === 2 ? 'Connecting' : 'Disconnected';
        console.log(`[KeepAlive] Database: ${dbStatus}`);

        // Log memory usage
        const memUsage = process.memoryUsage();
        console.log(`[KeepAlive] Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);

        return true;
    } catch (error) {
        consecutiveFailures++;
        console.error(`[KeepAlive] Ping #${pingCount + 1} failed:`, error.message);
        console.error(`[KeepAlive] Consecutive failures: ${consecutiveFailures}`);

        if (consecutiveFailures >= 3) {
            console.error('[KeepAlive] WARNING: Multiple consecutive failures detected!');
        }

        return false;
    }
};

/**
 * Check and maintain database connection
 */
const checkDatabaseConnection = async () => {
    try {
        const dbState = mongoose.connection.readyState;

        if (dbState !== 1) {
            console.log('[KeepAlive] Database disconnected, attempting to reconnect...');
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('[KeepAlive] Database reconnected successfully');
        }

        // Perform a simple query to keep connection alive
        await mongoose.connection.db.admin().ping();
        console.log('[KeepAlive] Database ping successful');

        return true;
    } catch (error) {
        console.error('[KeepAlive] Database check failed:', error.message);
        return false;
    }
};

/**
 * Combined keep-alive routine
 */
const keepAliveRoutine = async () => {
    console.log('\n[KeepAlive] Running keep-alive routine...');
    console.log(`[KeepAlive] Time: ${new Date().toISOString()}`);

    // Ping server
    await pingServer();

    // Check database
    await checkDatabaseConnection();

    console.log('[KeepAlive] Routine completed\n');
};

/**
 * Start the keep-alive cron job
 */
const startKeepAlive = () => {
    if (keepAliveTimer) {
        console.log('[KeepAlive] Already running');
        return;
    }

    console.log('[KeepAlive] Starting keep-alive cron job');
    console.log(`[KeepAlive] Interval: ${KEEP_ALIVE_INTERVAL / 1000 / 60} minutes`);
    console.log(`[KeepAlive] Target: ${HEALTH_ENDPOINT}`);

    // Run immediately on start
    keepAliveRoutine();

    // Then run on interval
    keepAliveTimer = setInterval(keepAliveRoutine, KEEP_ALIVE_INTERVAL);

    console.log('[KeepAlive] Cron job started successfully');
};

/**
 * Stop the keep-alive cron job
 */
const stopKeepAlive = () => {
    if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
        console.log('[KeepAlive] Cron job stopped');
    }
};

/**
 * Get keep-alive statistics
 */
const getStats = () => {
    return {
        isRunning: keepAliveTimer !== null,
        pingCount,
        lastPingTime,
        consecutiveFailures,
        interval: KEEP_ALIVE_INTERVAL,
        targetUrl: HEALTH_ENDPOINT
    };
};

module.exports = {
    startKeepAlive,
    stopKeepAlive,
    getStats,
    pingServer,
    checkDatabaseConnection
};
