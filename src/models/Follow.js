const { pool } = require('../config/db');

const rowToFollow = (row) => {
    if (!row) return null;
    return {
        _id: row.id, id: row.id,
        follower: row.follower_id,
        vendor: row.vendor_id,
        createdAt: row.created_at,
        // joined
        followerName: row.follower_name,
        followerEmail: row.follower_email,
        followerProfileImage: row.follower_profile_image,
    };
};

const Follow = {
    async findOne(filter) {
        const { rows } = await pool.query(
            'SELECT * FROM follows WHERE follower_id = $1 AND vendor_id = $2 LIMIT 1',
            [filter.follower, filter.vendor]
        );
        return rowToFollow(rows[0]);
    },
    async find(filter = {}) {
        let query = `SELECT f.*, u.name AS follower_name, u.email AS follower_email, u.profile_image AS follower_profile_image
                     FROM follows f LEFT JOIN users u ON f.follower_id = u.id WHERE 1=1`;
        const values = [];
        if (filter.vendor) {
            values.push(filter.vendor);
            query += ` AND f.vendor_id = $${values.length}`;
        }
        query += ' ORDER BY f.created_at DESC';
        const { rows } = await pool.query(query, values);
        return rows.map(row => {
            const f = rowToFollow(row);
            f.follower = { _id: row.follower_id, id: row.follower_id, name: row.follower_name, email: row.follower_email, profileImage: row.follower_profile_image };
            return f;
        });
    },
    async create(data) {
        const { rows } = await pool.query(
            'INSERT INTO follows (follower_id, vendor_id) VALUES ($1,$2) RETURNING *',
            [data.follower, data.vendor]
        );
        return rowToFollow(rows[0]);
    },
    async findByIdAndDelete(id) {
        await pool.query('DELETE FROM follows WHERE id = $1', [id]);
    },
};

module.exports = Follow;
