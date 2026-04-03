const { pool } = require('../config/db');

const rowToLog = (row) => {
    if (!row) return null;
    return {
        _id: row.id, id: row.id,
        user: row.user_id,
        emailAttempted: row.email_attempted,
        action: row.action,
        ipAddress: row.ip_address,
        deviceInfo: row.device_info,
        status: row.status,
        failureReason: row.failure_reason,
        createdAt: row.created_at,
        // joined
        userName: row.user_name, userRole: row.user_role,
    };
};

const ActionLog = {
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO action_logs (user_id, email_attempted, action, ip_address, device_info, status, failure_reason)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [
                data.user || null, data.emailAttempted, data.action,
                data.ipAddress || '0.0.0.0', data.deviceInfo || 'Unknown Device',
                data.status, data.failureReason || null,
            ]
        );
        return rowToLog(rows[0]);
    },
    async find(filter = {}) {
        const { rows } = await pool.query(
            `SELECT al.*, u.name AS user_name, u.role AS user_role
             FROM action_logs al LEFT JOIN users u ON al.user_id = u.id
             ORDER BY al.created_at DESC LIMIT 100`
        );
        return rows.map(row => {
            const log = rowToLog(row);
            if (row.user_id) log.user = { _id: row.user_id, id: row.user_id, name: row.user_name, role: row.user_role };
            return log;
        });
    },
};

module.exports = ActionLog;
