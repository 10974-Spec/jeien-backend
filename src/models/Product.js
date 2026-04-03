const { pool } = require('../config/db');

const rowToProduct = (row) => {
    if (!row) return null;
    return {
        _id: row.id, id: row.id,
        vendor: row.vendor_id,
        name: row.name, description: row.description,
        price: parseFloat(row.price),
        originalPrice: row.original_price ? parseFloat(row.original_price) : undefined,
        category: row.category,
        stock: row.stock,
        images: row.images || [],
        colors: row.colors || [],
        sizes: row.sizes || [],
        tags: row.tags || [],
        salesType: row.sales_type,
        wholesalePrice: row.wholesale_price ? parseFloat(row.wholesale_price) : undefined,
        wholesaleMinQty: row.wholesale_min_qty,
        isActive: row.is_active,
        isApproved: row.is_approved,
        isFeatured: row.is_featured,
        rating: parseFloat(row.rating || 0),
        reviewsCount: row.reviews_count,
        createdAt: row.created_at, updatedAt: row.updated_at,
        // vendor join fields (if populated)
        vendorName: row.vendor_name,
        vendorStoreName: row.vendor_store_name,
        vendorStoreLogo: row.vendor_store_logo,
        vendorProfileImage: row.vendor_profile_image,
        vendorFollowersCount: row.vendor_followers_count,
    };
};

// Build a full product object with vendor data embedded (like .populate('vendor'))
const rowToProductWithVendor = (row, vendorFields = 'name storeName') => {
    const p = rowToProduct(row);
    if (!p) return null;
    const selectAll = !vendorFields || vendorFields === 'name storeName storeLogo profileImage followersCount';
    p.vendor = {
        _id: row.vendor_id, id: row.vendor_id,
        name: row.vendor_name,
        storeName: row.vendor_store_name,
        ...(selectAll || vendorFields.includes('email') ? { email: row.vendor_email } : {}),
        ...(selectAll || vendorFields.includes('storeLogo') ? { storeLogo: row.vendor_store_logo } : {}),
        ...(selectAll || vendorFields.includes('profileImage') ? { profileImage: row.vendor_profile_image } : {}),
        ...(selectAll || vendorFields.includes('followersCount') ? { followersCount: row.vendor_followers_count } : {}),
    };
    return p;
};

const Product = {
    async findById(id, populate = false) {
        if (populate) {
            const { rows } = await pool.query(
                `SELECT p.*, u.name AS vendor_name, u.store_name AS vendor_store_name,
                  u.store_logo AS vendor_store_logo, u.profile_image AS vendor_profile_image,
                  u.followers_count AS vendor_followers_count, u.email AS vendor_email
                 FROM products p LEFT JOIN users u ON p.vendor_id = u.id
                 WHERE p.id = $1`, [id]
            );
            return rows[0] ? rowToProductWithVendor(rows[0]) : null;
        }
        const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        return rowToProduct(rows[0]);
    },
    async find(filter = {}, opts = {}) {
        let query = `SELECT p.*, u.name AS vendor_name, u.store_name AS vendor_store_name,
                      u.store_logo AS vendor_store_logo, u.profile_image AS vendor_profile_image,
                      u.followers_count AS vendor_followers_count, u.email AS vendor_email
                     FROM products p LEFT JOIN users u ON p.vendor_id = u.id WHERE 1=1`;
        const values = [];

        if (filter.isApproved !== undefined) {
            values.push(filter.isApproved);
            query += ` AND p.is_approved = $${values.length}`;
        }
        if (filter.isActive !== undefined) {
            values.push(filter.isActive);
            query += ` AND p.is_active = $${values.length}`;
        }
        if (filter.vendor || filter.vendor_id) {
            values.push(filter.vendor || filter.vendor_id);
            query += ` AND p.vendor_id = $${values.length}`;
        }
        if (filter.category) {
            values.push(filter.category);
            query += ` AND p.category = $${values.length}`;
        }
        if (filter.salesType) {
            if (typeof filter.salesType === 'object' && filter.salesType.$in) {
                values.push(filter.salesType.$in);
                query += ` AND p.sales_type = ANY($${values.length}::text[])`;
            } else {
                values.push(filter.salesType);
                query += ` AND p.sales_type = $${values.length}`;
            }
        }
        if (filter.$or) {
            // Full-text search
            const term = filter.$or[0]?.name?.$regex;
            if (term) {
                values.push(`%${term}%`);
                const idx = values.length;
                query += ` AND (p.name ILIKE $${idx} OR p.description ILIKE $${idx} OR p.category ILIKE $${idx} OR $${idx} ILIKE ANY(p.tags))`;
            }
        }

        query += ` ORDER BY p.created_at DESC`;
        if (opts.limit) {
            values.push(opts.limit);
            query += ` LIMIT $${values.length}`;
        }
        if (opts.skip) {
            values.push(opts.skip);
            query += ` OFFSET $${values.length}`;
        }
        const { rows } = await pool.query(query, values);
        return rows.map(r => rowToProductWithVendor(r));
    },
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO products (vendor_id, name, description, price, original_price, category,
             stock, images, colors, sizes, tags, sales_type, wholesale_price, wholesale_min_qty,
             is_active, is_approved, is_featured)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
            [
                data.vendor, data.name, data.description, data.price,
                data.originalPrice || null, data.category, data.stock || 0,
                data.images || [], data.colors || [], data.sizes || [], data.tags || [],
                data.salesType || 'retail', data.wholesalePrice || null,
                data.wholesaleMinQty || 5, data.isActive !== false,
                data.isApproved || false, data.isFeatured || false,
            ]
        );
        return rowToProduct(rows[0]);
    },
    async save(product) {
        const { rows } = await pool.query(
            `UPDATE products SET name=$1, description=$2, price=$3, original_price=$4,
             category=$5, stock=$6, images=$7, colors=$8, sizes=$9, tags=$10, sales_type=$11,
             wholesale_price=$12, wholesale_min_qty=$13, is_active=$14, is_approved=$15,
             is_featured=$16, updated_at=NOW()
             WHERE id=$17 RETURNING *`,
            [
                product.name, product.description, product.price, product.originalPrice || null,
                product.category, product.stock, product.images || [], product.colors || [],
                product.sizes || [], product.tags || [], product.salesType || 'retail',
                product.wholesalePrice || null, product.wholesaleMinQty || 5,
                product.isActive !== false, product.isApproved || false,
                product.isFeatured || false, product._id,
            ]
        );
        return rowToProduct(rows[0]);
    },
    async deleteOne(filter) {
        if (filter._id) {
            await pool.query('DELETE FROM products WHERE id = $1', [filter._id]);
        }
    },
    async findByIdAndDelete(id) {
        await pool.query('DELETE FROM products WHERE id = $1', [id]);
    },
    async countDocuments(filter = {}) {
        let query = 'SELECT COUNT(*) FROM products WHERE 1=1';
        const values = [];
        if (filter.isApproved !== undefined) {
            values.push(filter.isApproved);
            query += ` AND is_approved = $${values.length}`;
        }
        if (filter.isActive !== undefined) {
            values.push(filter.isActive);
            query += ` AND is_active = $${values.length}`;
        }
        if (filter.vendor) {
            values.push(filter.vendor);
            query += ` AND vendor_id = $${values.length}`;
        }
        const { rows } = await pool.query(query, values);
        return parseInt(rows[0].count, 10);
    },
};

module.exports = Product;
