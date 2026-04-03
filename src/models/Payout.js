const { pool } = require('../config/db');

const rowToPayout = (row) => {
    if (!row) return null;
    return {
        _id: row.id, id: row.id,
        vendor: row.vendor_id,
        orderItem: row.order_id,
        amount: parseFloat(row.amount),
        commission: parseFloat(row.commission),
        status: row.status,
        transactionId: row.transaction_id,
        paidAt: row.paid_at,
        createdAt: row.created_at,
    };
};

const Payout = {
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO payouts (vendor_id, order_id, amount, commission, status)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [data.vendor, data.orderItem, data.amount, data.commission, data.status || 'pending']
        );
        return rowToPayout(rows[0]);
    },
    async find(filter = {}) {
        let query = 'SELECT * FROM payouts WHERE 1=1';
        const values = [];
        if (filter.vendor) { values.push(filter.vendor); query += ` AND vendor_id = $${values.length}`; }
        if (filter.status) { values.push(filter.status); query += ` AND status = $${values.length}`; }
        query += ' ORDER BY created_at DESC';
        const { rows } = await pool.query(query, values);
        return rows.map(rowToPayout);
    },
    async findById(id) {
        const { rows } = await pool.query('SELECT * FROM payouts WHERE id = $1', [id]);
        return rowToPayout(rows[0]);
    },
    async save(payout) {
        const { rows } = await pool.query(
            `UPDATE payouts SET status=$1, transaction_id=$2, paid_at=$3 WHERE id=$4 RETURNING *`,
            [payout.status, payout.transactionId || null, payout.paidAt || null, payout._id]
        );
        return rowToPayout(rows[0]);
    },
};

module.exports = Payout;
