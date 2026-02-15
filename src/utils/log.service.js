const SystemLog = require('../modules/logs/system-log.model');

/**
 * Log a system event to database
 * @param {string} level - Log level (INFO, WARN, ERROR, DEBUG)
 * @param {string} category - Log category (PAYMENT, ORDER, SYSTEM, AUTH)
 * @param {string} message - Log message
 * @param {object} metadata - Additional data to log
 */
const logEvent = async (level, category, message, metadata = {}) => {
    try {
        // Also log to console for immediate visibility
        const consoleMsg = `[${level}] [${category}] ${message}`;
        if (level === 'ERROR') {
            console.error(consoleMsg, metadata);
        } else if (level === 'WARN') {
            console.warn(consoleMsg, metadata);
        } else {
            console.log(consoleMsg, metadata);
        }

        // Save to database
        await SystemLog.create({
            level,
            category,
            message,
            metadata: metadata || {}
        });
    } catch (error) {
        console.error('FAILED TO LOG TO DB:', error);
    }
};

module.exports = {
    info: (category, message, metadata) => logEvent('INFO', category, message, metadata),
    warn: (category, message, metadata) => logEvent('WARN', category, message, metadata),
    error: (category, message, metadata) => logEvent('ERROR', category, message, metadata),
    debug: (category, message, metadata) => logEvent('DEBUG', category, message, metadata),
};
