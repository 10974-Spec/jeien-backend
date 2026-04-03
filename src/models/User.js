const { pool } = require('../config/db');

const rowToUser = (row) => {
    if (!row) return null;
    return {
        _id: row.id, id: row.id,
        name: row.name, email: row.email,
        password: row.password, phone: row.phone,
        profileImage: row.profile_image,
        role: row.role, isVerified: row.is_verified,
        storeName: row.store_name,
        storeDescription: row.store_description,
        storeLogo: row.store_logo, storeBanner: row.store_banner,
        followersCount: row.followers_count,
        idNumber: row.id_number, idImage: row.id_image,
        vendorStatus: row.vendor_status,
        passwordResetToken: row.password_reset_token,
        passwordResetExpires: row.password_reset_expires,
        passwordResetReason: row.password_reset_reason,
        wishlist: row.wishlist || [],
        createdAt: row.created_at, updatedAt: row.updated_at,
    };
};

const User = {
    async findById(id) {
        const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return rowToUser(rows[0]);
    },
    async findOne(filter) {
        const keys = Object.keys(filter);
        if (keys.length === 0) return null;

        // Special case: passwordResetToken + passwordResetExpires $gt
        if (filter.passwordResetToken && filter.passwordResetExpires?.$gt) {
            const { rows } = await pool.query(
                'SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > $2 LIMIT 1',
                [filter.passwordResetToken, new Date(filter.passwordResetExpires.$gt)]
            );
            return rowToUser(rows[0]);
        }

        const colMap = {
            email: 'email', phone: 'phone', role: 'role',
            vendorStatus: 'vendor_status',
        };
        const conditions = [];
        const values = [];
        for (const k of keys) {
            if (colMap[k]) {
                values.push(filter[k]);
                conditions.push(`${colMap[k]} = $${values.length}`);
            }
        }
        if (!conditions.length) return null;
        const { rows } = await pool.query(
            `SELECT * FROM users WHERE ${conditions.join(' AND ')} LIMIT 1`,
            values
        );
        return rowToUser(rows[0]);
    },
    async find(filter = {}) {
        let query = 'SELECT * FROM users WHERE 1=1';
        const values = [];
        const colMap = { role: 'role', vendorStatus: 'vendor_status' };
        for (const [k, v] of Object.entries(filter)) {
            if (k === '_id' && v?.$in) {
                values.push(v.$in);
                query += ` AND id = ANY($${values.length}::uuid[])`;
            } else if (k === 'role' && v?.$ne) {
                values.push(v.$ne);
                query += ` AND role != $${values.length}`;
            } else if (colMap[k]) {
                values.push(v);
                query += ` AND ${colMap[k]} = $${values.length}`;
            }
        }
        const { rows } = await pool.query(query, values);
        return rows.map(rowToUser);
    },
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO users (name, email, password, phone, profile_image, role, is_verified,
             store_name, store_description, store_logo, store_banner, id_number, id_image, vendor_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [
                data.name, data.email || null, data.password || null, data.phone || null,
                data.profileImage || '', data.role || 'user', data.isVerified || false,
                data.storeName || null, data.storeDescription || null,
                data.storeLogo || null, data.storeBanner || null,
                data.idNumber || null, data.idImage || null,
                data.vendorStatus || 'pending',
            ]
        );
        return rowToUser(rows[0]);
    },
    async save(user) {
        const { rows } = await pool.query(
            `UPDATE users SET name=$1, email=$2, password=$3, phone=$4, profile_image=$5,
             role=$6, is_verified=$7, store_name=$8, store_description=$9, store_logo=$10,
             store_banner=$11, id_number=$12, id_image=$13, vendor_status=$14,
             password_reset_token=$15, password_reset_expires=$16, password_reset_reason=$17,
             followers_count=$18, updated_at=NOW()
             WHERE id=$19 RETURNING *`,
            [
                user.name, user.email || null, user.password || null, user.phone || null,
                user.profileImage || '', user.role, user.isVerified || false,
                user.storeName || null, user.storeDescription || null,
                user.storeLogo || null, user.storeBanner || null,
                user.idNumber || null, user.idImage || null,
                user.vendorStatus || 'pending',
                user.passwordResetToken || null,
                user.passwordResetExpires || null,
                user.passwordResetReason || null,
                user.followersCount || 0,
                user._id,
            ]
        );
        return rowToUser(rows[0]);
    },
    async findByIdAndDelete(id) {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
    },
    async findByIdAndUpdate(id, data, opts = {}) {
        const colMap = {
            vendorStatus: 'vendor_status', isVerified: 'is_verified',
            name: 'name', email: 'email', phone: 'phone', role: 'role',
            storeName: 'store_name',
        };
        const sets = [];
        const values = [];
        for (const [k, v] of Object.entries(data)) {
            if (colMap[k]) {
                values.push(v);
                sets.push(`${colMap[k]} = $${values.length}`);
            }
        }
        values.push(id);
        const { rows } = await pool.query(
            `UPDATE users SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${values.length} RETURNING *`,
            values
        );
        return rowToUser(rows[0]);
    },
    async countDocuments(filter = {}) {
        let query = 'SELECT COUNT(*) FROM users WHERE 1=1';
        const values = [];
        const colMap = { role: 'role', vendorStatus: 'vendor_status' };
        for (const [k, v] of Object.entries(filter)) {
            if (colMap[k]) {
                values.push(v);
                query += ` AND ${colMap[k]} = $${values.length}`;
            }
        }
        const { rows } = await pool.query(query, values);
        return parseInt(rows[0].count, 10);
    },
    async deleteMany(filter) {
        if (filter._id?.$in && filter.role?.$ne) {
            await pool.query(
                `DELETE FROM users WHERE id = ANY($1::uuid[]) AND role != $2`,
                [filter._id.$in, filter.role.$ne]
            );
        }
    },
};

module.exports = User;
