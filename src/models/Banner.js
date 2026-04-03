const { pool } = require('../config/db');

const rowToBanner = (row) => {
    if (!row) return null;
    return {
        _id: row.id, id: row.id,
        imageUrl: row.image_url,
        subtitle: row.subtitle,
        title: row.title,
        description: row.description,
        linkUrl: row.link_url,
        linkLabel: row.link_label,
        bgColor: row.bg_color,
        order: row.order,
        isActive: row.is_active,
        createdAt: row.created_at, updatedAt: row.updated_at,
    };
};

const Banner = {
    async find(filter = {}) {
        let query = 'SELECT * FROM banners WHERE 1=1';
        const values = [];
        if (filter.isActive !== undefined) {
            values.push(filter.isActive);
            query += ` AND is_active = $${values.length}`;
        }
        query += ' ORDER BY "order" ASC';
        const { rows } = await pool.query(query, values);
        return rows.map(rowToBanner);
    },
    async findById(id) {
        const { rows } = await pool.query('SELECT * FROM banners WHERE id = $1', [id]);
        return rowToBanner(rows[0]);
    },
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO banners (image_url, subtitle, title, description, link_url, link_label, bg_color, "order", is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [
                data.imageUrl, data.subtitle || '', data.title, data.description || '',
                data.linkUrl || '/', data.linkLabel || 'Shop Now',
                data.bgColor || 'bg-navy', data.order || 0, data.isActive !== false,
            ]
        );
        return rowToBanner(rows[0]);
    },
    async findByIdAndUpdate(id, data, opts = {}) {
        const sets = [];
        const values = [];
        const colMap = {
            imageUrl: 'image_url', subtitle: 'subtitle', title: 'title',
            description: 'description', linkUrl: 'link_url', linkLabel: 'link_label',
            bgColor: 'bg_color', order: '"order"', isActive: 'is_active',
        };
        for (const [k, v] of Object.entries(data)) {
            if (colMap[k]) { values.push(v); sets.push(`${colMap[k]} = $${values.length}`); }
        }
        values.push(id);
        const { rows } = await pool.query(
            `UPDATE banners SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${values.length} RETURNING *`,
            values
        );
        return rowToBanner(rows[0]);
    },
    async findByIdAndDelete(id) {
        await pool.query('DELETE FROM banners WHERE id = $1', [id]);
    },
};

module.exports = Banner;
