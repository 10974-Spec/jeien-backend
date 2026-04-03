const { pool } = require('../config/db');

const rowToOrder = (row) => {
    if (!row) return null;
    return {
        _id: row.id, id: row.id,
        user: row.user_id,
        orderItems: [],
        shippingAddress: row.shipping_address || {},
        paymentMethod: row.payment_method,
        paymentResult: row.payment_result || {},
        totalPrice: parseFloat(row.total_price || 0),
        isPaid: row.is_paid,
        paidAt: row.paid_at,
        status: row.status,
        createdAt: row.created_at, updatedAt: row.updated_at,
        // joined user fields
        userName: row.user_name,
        userEmail: row.user_email,
        userPhone: row.user_phone,
    };
};

const rowToItem = (row) => ({
    _id: row.id, id: row.id,
    product: row.product_id,
    vendor: row.vendor_id,
    name: row.name,
    quantity: row.quantity,
    price: parseFloat(row.price),
    image: row.image,
    status: row.status,
    // populated
    productName: row.product_name,
    productImages: row.product_images,
    vendorName: row.vendor_name,
    vendorStoreName: row.vendor_store_name,
    // full product object if populated
    ...(row.product_name ? {
        product: {
            _id: row.product_id, id: row.product_id,
            name: row.product_name, images: row.product_images || [],
            price: parseFloat(row.product_price || 0),
        }
    } : {}),
});

async function attachItems(orders, populateProduct = false, populateVendor = false) {
    if (!orders.length) return orders;
    const ids = orders.map(o => o._id);
    let itemQuery = `
        SELECT oi.*,
          p.name AS product_name, p.images AS product_images, p.price AS product_price,
          u.name AS vendor_name, u.store_name AS vendor_store_name
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN users u ON oi.vendor_id = u.id
        WHERE oi.order_id = ANY($1::uuid[])`;
    const { rows: items } = await pool.query(itemQuery, [ids]);
    const itemMap = {};
    items.forEach(i => {
        if (!itemMap[i.order_id]) itemMap[i.order_id] = [];
        itemMap[i.order_id].push(rowToItem(i));
    });
    orders.forEach(o => { o.orderItems = itemMap[o._id] || []; });
    return orders;
}

const Order = {
    async findById(id, opts = {}) {
        const { rows } = await pool.query(
            `SELECT o.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
             FROM orders o LEFT JOIN users u ON o.user_id = u.id
             WHERE o.id = $1`, [id]
        );
        if (!rows[0]) return null;
        const order = rowToOrder(rows[0]);
        if (order.userName) {
            order.user = { _id: rows[0].user_id, id: rows[0].user_id, name: order.userName, email: order.userEmail, phone: order.userPhone };
        }
        const [withItems] = await attachItems([order]);
        return withItems;
    },
    async find(filter = {}) {
        let query = `SELECT o.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
                     FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE 1=1`;
        const values = [];
        if (filter.user || filter.user_id) {
            values.push(filter.user || filter.user_id);
            query += ` AND o.user_id = $${values.length}`;
        }
        if (filter['orderItems.vendor']) {
            // Find orders that have items from this vendor
            values.push(filter['orderItems.vendor']);
            query += ` AND o.id IN (SELECT order_id FROM order_items WHERE vendor_id = $${values.length})`;
        }
        if (filter.isPaid !== undefined) {
            values.push(filter.isPaid);
            query += ` AND o.is_paid = $${values.length}`;
        }
        query += ` ORDER BY o.created_at DESC`;
        const { rows } = await pool.query(query, values);
        const orders = rows.map(row => {
            const o = rowToOrder(row);
            o.user = { _id: row.user_id, id: row.user_id, name: row.user_name, email: row.user_email, phone: row.user_phone };
            return o;
        });
        return attachItems(orders);
    },
    async create(data) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { rows } = await client.query(
                `INSERT INTO orders (user_id, shipping_address, payment_method, total_price, status)
                 VALUES ($1,$2,$3,$4,$5) RETURNING *`,
                [
                    data.user, JSON.stringify(data.shippingAddress || {}),
                    data.paymentMethod || 'M-Pesa',
                    data.totalPrice || 0, 'pending',
                ]
            );
            const order = rowToOrder(rows[0]);
            const items = data.orderItems || [];
            for (const item of items) {
                await client.query(
                    `INSERT INTO order_items (order_id, product_id, vendor_id, name, quantity, price, image, status)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                    [order._id, item.product, item.vendor, item.name || '', item.quantity, item.price, item.image || '', item.status || 'pending']
                );
            }
            await client.query('COMMIT');
            return this.findById(order._id);
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    },
    async save(order) {
        const { rows } = await pool.query(
            `UPDATE orders SET payment_method=$1, payment_result=$2, total_price=$3,
             is_paid=$4, paid_at=$5, status=$6, updated_at=NOW()
             WHERE id=$7 RETURNING *`,
            [
                order.paymentMethod, JSON.stringify(order.paymentResult || {}),
                order.totalPrice, order.isPaid || false, order.paidAt || null,
                order.status, order._id,
            ]
        );
        const updated = rowToOrder(rows[0]);
        const [withItems] = await attachItems([updated]);
        return withItems;
    },
    async countDocuments(filter = {}) {
        let query = 'SELECT COUNT(*) FROM orders WHERE 1=1';
        const values = [];
        if (filter.isPaid !== undefined) {
            values.push(filter.isPaid);
            query += ` AND is_paid = $${values.length}`;
        }
        const { rows } = await pool.query(query, values);
        return parseInt(rows[0].count, 10);
    },
    // replaces Order.aggregate for stats
    async sumPaidTotalPrice() {
        const { rows } = await pool.query(`SELECT COALESCE(SUM(total_price),0) AS total FROM orders WHERE is_paid = true`);
        return parseFloat(rows[0].total);
    },
    async monthlyRevenue(sinceDate) {
        const { rows } = await pool.query(
            `SELECT EXTRACT(YEAR FROM created_at) AS year, EXTRACT(MONTH FROM created_at) AS month,
             SUM(total_price) AS total, COUNT(*) AS count
             FROM orders WHERE is_paid = true AND created_at >= $1
             GROUP BY year, month ORDER BY year, month`,
            [sinceDate]
        );
        return rows.map(r => ({ _id: { year: r.year, month: r.month }, total: parseFloat(r.total), count: parseInt(r.count) }));
    },
    async topCategories() {
        const { rows } = await pool.query(
            `SELECT p.category AS name, SUM(oi.price * oi.quantity) AS sales
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN products p ON oi.product_id = p.id
             WHERE o.is_paid = true
             GROUP BY p.category ORDER BY sales DESC LIMIT 4`
        );
        return rows.map(r => ({ name: r.name, sales: parseFloat(r.sales) }));
    },
    // Update a single order item's status
    async updateItemStatus(orderId, itemId, status) {
        const { rows } = await pool.query(
            `UPDATE order_items SET status=$1 WHERE id=$2 AND order_id=$3 RETURNING *`,
            [status, itemId, orderId]
        );
        return rows[0];
    },
    toObject() { return this; },
};

module.exports = Order;
