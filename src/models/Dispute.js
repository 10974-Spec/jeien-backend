const { pool } = require('../config/db');

const rowToDispute = (row) => {
    if (!row) return null;
    return {
        _id: row.id, id: row.id,
        order: row.order_id,
        user: row.user_id,
        vendor: row.vendor_id,
        reason: row.reason,
        description: row.description,
        status: row.status,
        resolution: row.resolution,
        evidence: row.evidence || [],
        messages: [],
        createdAt: row.created_at, updatedAt: row.updated_at,
    };
};

const Dispute = {
    async find(filter = {}) {
        let query = 'SELECT * FROM disputes WHERE 1=1';
        const values = [];
        if (filter.user) { values.push(filter.user); query += ` AND user_id = $${values.length}`; }
        if (filter.vendor) { values.push(filter.vendor); query += ` AND vendor_id = $${values.length}`; }
        query += ' ORDER BY created_at DESC';
        const { rows } = await pool.query(query, values);
        const disputes = rows.map(rowToDispute);
        // Attach messages
        if (disputes.length) {
            const ids = disputes.map(d => d._id);
            const { rows: msgs } = await pool.query(
                'SELECT * FROM dispute_messages WHERE dispute_id = ANY($1::uuid[]) ORDER BY created_at ASC',
                [ids]
            );
            const msgMap = {};
            msgs.forEach(m => {
                if (!msgMap[m.dispute_id]) msgMap[m.dispute_id] = [];
                msgMap[m.dispute_id].push({ _id: m.id, sender: m.sender_id, message: m.message, createdAt: m.created_at });
            });
            disputes.forEach(d => { d.messages = msgMap[d._id] || []; });
        }
        return disputes;
    },
    async findById(id) {
        const { rows } = await pool.query('SELECT * FROM disputes WHERE id = $1', [id]);
        if (!rows[0]) return null;
        const dispute = rowToDispute(rows[0]);
        const { rows: msgs } = await pool.query(
            'SELECT * FROM dispute_messages WHERE dispute_id = $1 ORDER BY created_at ASC', [id]
        );
        dispute.messages = msgs.map(m => ({ _id: m.id, sender: m.sender_id, message: m.message, createdAt: m.created_at }));
        return dispute;
    },
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO disputes (order_id, user_id, vendor_id, reason, description, evidence)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [data.order, data.user, data.vendor || null, data.reason, data.description, data.evidence || []]
        );
        const dispute = rowToDispute(rows[0]);
        dispute.messages = [];
        return dispute;
    },
    async save(dispute) {
        const { rows } = await pool.query(
            `UPDATE disputes SET status=$1, resolution=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
            [dispute.status, dispute.resolution || null, dispute._id]
        );
        const updated = rowToDispute(rows[0]);
        // If saving a new message
        if (dispute._newMessage) {
            await pool.query(
                'INSERT INTO dispute_messages (dispute_id, sender_id, message) VALUES ($1,$2,$3)',
                [dispute._id, dispute._newMessage.sender, dispute._newMessage.message]
            );
        }
        return this.findById(updated._id);
    },
};

module.exports = Dispute;
