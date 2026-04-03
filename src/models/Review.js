const { pool } = require('../config/db');

const rowToReview = (row) => {
    if (!row) return null;
    return {
        _id: row.id, id: row.id,
        user: row.user_id,
        product: row.product_id,
        vendor: row.vendor_id,
        rating: row.rating,
        comment: row.comment,
        status: row.status,
        flags: row.flags,
        createdAt: row.created_at,
        // joined
        userName: row.user_name, userEmail: row.user_email,
        productName: row.product_name,
        vendorStoreName: row.vendor_store_name,
    };
};

const Review = {
    async find(filter = {}) {
        const { rows } = await pool.query(
            `SELECT r.*,
              u.name AS user_name, u.email AS user_email,
              p.name AS product_name, p.vendor_id AS product_vendor_id,
              v.store_name AS vendor_store_name
             FROM reviews r
             LEFT JOIN users u ON r.user_id = u.id
             LEFT JOIN products p ON r.product_id = p.id
             LEFT JOIN users v ON p.vendor_id = v.id
             ORDER BY r.created_at DESC`
        );
        return rows.map(row => {
            const rv = rowToReview(row);
            rv.user = { _id: row.user_id, id: row.user_id, name: row.user_name, email: row.user_email };
            rv.product = {
                _id: row.product_id, id: row.product_id, name: row.product_name,
                vendor: { _id: row.product_vendor_id, id: row.product_vendor_id, storeName: row.vendor_store_name }
            };
            return rv;
        });
    },
    async findById(id) {
        const { rows } = await pool.query('SELECT * FROM reviews WHERE id = $1', [id]);
        return rowToReview(rows[0]);
    },
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO reviews (user_id, product_id, vendor_id, rating, comment, status, flags)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [data.user, data.product, data.vendor, data.rating, data.comment, data.status || 'Pending', data.flags || 0]
        );
        return rowToReview(rows[0]);
    },
    async save(review) {
        const { rows } = await pool.query(
            `UPDATE reviews SET status=$1, flags=$2 WHERE id=$3 RETURNING *`,
            [review.status, review.flags || 0, review._id]
        );
        return rowToReview(rows[0]);
    },
    async findByIdAndDelete(id) {
        await pool.query('DELETE FROM reviews WHERE id = $1', [id]);
    },
};

module.exports = Review;
