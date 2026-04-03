const { pool } = require('../config/db');

const rowToZone = (row) => {
    if (!row) return null;
    return {
        _id: row.id, id: row.id,
        name: row.name, areas: row.areas,
        baseRate: parseFloat(row.base_rate || 0),
        freeAbove: row.free_above ? parseFloat(row.free_above) : null,
        isActive: row.is_active,
        createdAt: row.created_at, updatedAt: row.updated_at,
    };
};

const ShippingZone = {
    async find(filter = {}) {
        const { rows } = await pool.query('SELECT * FROM shipping_zones ORDER BY name');
        return rows.map(rowToZone);
    },
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO shipping_zones (name, areas, base_rate, free_above, is_active)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [data.name, data.areas, data.baseRate || 0, data.freeAbove || null, data.isActive !== false]
        );
        return rowToZone(rows[0]);
    },
    async findByIdAndUpdate(id, data, opts = {}) {
        const colMap = { name: 'name', areas: 'areas', baseRate: 'base_rate', freeAbove: 'free_above', isActive: 'is_active' };
        const sets = [];
        const values = [];
        for (const [k, v] of Object.entries(data)) {
            if (colMap[k]) { values.push(v); sets.push(`${colMap[k]} = $${values.length}`); }
        }
        values.push(id);
        const { rows } = await pool.query(
            `UPDATE shipping_zones SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${values.length} RETURNING *`,
            values
        );
        return rowToZone(rows[0]);
    },
    async findByIdAndDelete(id) {
        await pool.query('DELETE FROM shipping_zones WHERE id = $1', [id]);
    },
};

module.exports = ShippingZone;
