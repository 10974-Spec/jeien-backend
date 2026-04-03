const { pool } = require('../config/db');

const rowToCategory = (row) => {
    if (!row) return null;
    return {
        _id: row.id, id: row.id,
        name: row.name, slug: row.slug, image: row.image,
        isActive: row.is_active,
        parentCategory: row.parent_category_id,
        createdAt: row.created_at, updatedAt: row.updated_at,
    };
};

const Category = {
    async find(filter = {}) {
        let query = 'SELECT * FROM categories WHERE 1=1';
        const values = [];
        if (filter.isActive !== undefined) {
            values.push(filter.isActive);
            query += ` AND is_active = $${values.length}`;
        }
        query += ' ORDER BY name';
        const { rows } = await pool.query(query, values);
        return rows.map(rowToCategory);
    },
    async findById(id) {
        const { rows } = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
        return rowToCategory(rows[0]);
    },
    async findOne(filter) {
        if (filter.slug) {
            const { rows } = await pool.query('SELECT * FROM categories WHERE slug = $1', [filter.slug]);
            return rowToCategory(rows[0]);
        }
        if (filter.name) {
            const { rows } = await pool.query('SELECT * FROM categories WHERE name = $1', [filter.name]);
            return rowToCategory(rows[0]);
        }
        return null;
    },
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO categories (name, slug, image, is_active, parent_category_id)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [data.name, data.slug, data.image || '', data.isActive !== false, data.parentCategory || null]
        );
        return rowToCategory(rows[0]);
    },
    async findByIdAndUpdate(id, data, opts = {}) {
        const sets = [];
        const values = [];
        const colMap = { name: 'name', slug: 'slug', image: 'image', isActive: 'is_active' };
        for (const [k, v] of Object.entries(data)) {
            if (colMap[k]) { values.push(v); sets.push(`${colMap[k]} = $${values.length}`); }
        }
        values.push(id);
        const { rows } = await pool.query(
            `UPDATE categories SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${values.length} RETURNING *`,
            values
        );
        return rowToCategory(rows[0]);
    },
    async findByIdAndDelete(id) {
        await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    },
};

module.exports = Category;
