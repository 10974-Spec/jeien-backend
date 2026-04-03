const { pool } = require('../config/db');

// Value is stored as JSONB — we serialize/deserialize transparent to the rest of the code
const rowToSetting = (row) => {
    if (!row) return null;
    let val = row.value;
    // JSONB comes back already parsed by node-postgres
    // But we stored strings wrapped in quotes, so unwrap if needed
    if (row.type === 'string' && typeof val === 'string') val = val;
    else if (row.type === 'number' && typeof val === 'number') val = val;
    else if (row.type === 'boolean' && typeof val === 'boolean') val = val;
    // json/array stay as-is
    return {
        _id: row.id, id: row.id,
        key: row.key, value: val, type: row.type,
        category: row.category, isPublic: row.is_public,
        description: row.description,
        createdAt: row.created_at, updatedAt: row.updated_at,
    };
};

const toJsonb = (value) => JSON.stringify(value);

const Setting = {
    async find(filter = {}) {
        let query = 'SELECT * FROM settings WHERE 1=1';
        const values = [];
        if (filter.isPublic !== undefined) { values.push(filter.isPublic); query += ` AND is_public = $${values.length}`; }
        if (filter.key?.$regex) {
            // Convert regex like '^coupon_' to LIKE 'coupon_%'
            const pattern = filter.key.$regex.replace(/^\^/, '').replace(/\.\*$/, '%');
            values.push(`${pattern}%`);
            query += ` AND key LIKE $${values.length}`;
        }
        const { rows } = await pool.query(query, values);
        return rows.map(rowToSetting);
    },
    async findOne(filter) {
        if (filter.key) {
            const { rows } = await pool.query('SELECT * FROM settings WHERE key = $1', [filter.key]);
            return rowToSetting(rows[0]);
        }
        return null;
    },
    async findById(id) {
        const { rows } = await pool.query('SELECT * FROM settings WHERE id = $1', [id]);
        return rowToSetting(rows[0]);
    },
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO settings (key, value, type, category, is_public, description)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [data.key, toJsonb(data.value), data.type, data.category, data.isPublic || false, data.description || null]
        );
        return rowToSetting(rows[0]);
    },
    // Upsert — INSERT if not exists, UPDATE if exists
    async updateOne(filter, update, opts = {}) {
        const key = filter.key;
        if (opts.upsert) {
            if (update.$setOnInsert) {
                // Only insert if doesn't exist
                const s = update.$setOnInsert;
                await pool.query(
                    `INSERT INTO settings (key, value, type, category, is_public, description)
                     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (key) DO NOTHING`,
                    [s.key, toJsonb(s.value), s.type, s.category, s.isPublic || false, s.description || null]
                );
            } else if (update.value !== undefined) {
                await pool.query(
                    `INSERT INTO settings (key, value, type, category, is_public, description)
                     VALUES ($1,$2,'string','General Settings',false,null)
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                    [key, toJsonb(update.value)]
                );
            }
        }
    },
    async findOneAndUpdate(filter, update, opts = {}) {
        const key = filter.key;
        const value = update.value;
        const type = update.type || 'string';
        const category = update.category || 'General Settings';
        if (opts.upsert) {
            const { rows } = await pool.query(
                `INSERT INTO settings (key, value, type, category)
                 VALUES ($1,$2,$3,$4)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                 RETURNING *`,
                [key, toJsonb(value), type, category]
            );
            return rowToSetting(rows[0]);
        }
        const { rows } = await pool.query(
            `UPDATE settings SET value=$1, updated_at=NOW() WHERE key=$2 RETURNING *`,
            [toJsonb(value), key]
        );
        return rowToSetting(rows[0]);
    },
};

module.exports = Setting;
