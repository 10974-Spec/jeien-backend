const { pool } = require('../config/db');

const rowToMessage = (row) => {
    if (!row) return null;
    return {
        _id: row.id, id: row.id,
        sender: row.sender_id,
        recipient: row.recipient_id,
        order: row.order_id,
        subject: row.subject,
        content: row.content,
        isRead: row.is_read,
        createdAt: row.created_at, updatedAt: row.updated_at,
        // joined
        senderName: row.sender_name, senderRole: row.sender_role,
        recipientName: row.recipient_name, recipientRole: row.recipient_role,
    };
};

const Message = {
    async find(filter = {}) {
        let query = `SELECT m.*,
              s.name AS sender_name, s.role AS sender_role,
              r.name AS recipient_name, r.role AS recipient_role
             FROM messages m
             LEFT JOIN users s ON m.sender_id = s.id
             LEFT JOIN users r ON m.recipient_id = r.id
             WHERE 1=1`;
        const values = [];
        if (filter.recipient_id) {
            values.push(filter.recipient_id);
            query += ` AND m.recipient_id = $${values.length}`;
        }
        query += ` ORDER BY m.created_at DESC LIMIT ${filter.limit || 100}`;
        const { rows } = await pool.query(query, values);
        return rows.map(row => {
            const msg = rowToMessage(row);
            msg.sender = { _id: row.sender_id, id: row.sender_id, name: row.sender_name, role: row.sender_role };
            msg.recipient = { _id: row.recipient_id, id: row.recipient_id, name: row.recipient_name, role: row.recipient_role };
            return msg;
        });
    },
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO messages (sender_id, recipient_id, order_id, subject, content, is_read)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [data.sender, data.recipient, data.order || null, data.subject, data.content, data.isRead || false]
        );
        return rowToMessage(rows[0]);
    },
    async findByIdAndUpdate(id, data) {
        const { rows } = await pool.query(
            `UPDATE messages SET is_read=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
            [data.isRead !== undefined ? data.isRead : true, id]
        );
        return rowToMessage(rows[0]);
    },
};

module.exports = Message;
