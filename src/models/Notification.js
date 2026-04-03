const { pool } = require('../config/db');

const rowToNotification = (row) => {
    if (!row) return null;
    return {
        _id: row.id, id: row.id,
        type: row.type, title: row.title,
        message: row.message, data: row.data || {},
        isRead: row.is_read, forAdmin: row.for_admin,
        createdAt: row.created_at, updatedAt: row.updated_at,
    };
};

const Notification = {
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO notifications (type, title, message, data, is_read, for_admin)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [data.type, data.title, data.message, JSON.stringify(data.data || {}), false, data.forAdmin !== false]
        );
        return rowToNotification(rows[0]);
    },
    async find(filter = {}) {
        let query = 'SELECT * FROM notifications WHERE 1=1';
        const values = [];
        if (filter.isRead !== undefined) { values.push(filter.isRead); query += ` AND is_read = $${values.length}`; }
        if (filter.forAdmin !== undefined) { values.push(filter.forAdmin); query += ` AND for_admin = $${values.length}`; }
        query += ' ORDER BY created_at DESC';
        const { rows } = await pool.query(query, values);
        return rows.map(rowToNotification);
    },
    async findByIdAndUpdate(id, data) {
        const { rows } = await pool.query(
            `UPDATE notifications SET is_read=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
            [data.isRead !== undefined ? data.isRead : true, id]
        );
        return rowToNotification(rows[0]);
    },
    async countDocuments(filter = {}) {
        let query = 'SELECT COUNT(*) FROM notifications WHERE 1=1';
        const values = [];
        if (filter.isRead !== undefined) { values.push(filter.isRead); query += ` AND is_read = $${values.length}`; }
        const { rows } = await pool.query(query, values);
        return parseInt(rows[0].count, 10);
    },
};

module.exports = Notification;
