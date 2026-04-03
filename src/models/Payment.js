const { pool } = require('../config/db');

const rowToPayment = (row) => {
    if (!row) return null;
    return {
        _id: row.id, id: row.id,
        order: row.order_id,
        user: row.user_id,
        amount: parseFloat(row.amount),
        phoneNumber: row.phone_number,
        checkoutRequestID: row.checkout_request_id,
        merchantRequestID: row.merchant_request_id,
        mpesaReceiptNumber: row.mpesa_receipt_number,
        status: row.status,
        resultDesc: row.result_desc,
        transactionDate: row.transaction_date,
        createdAt: row.created_at,
        // joined
        orderTotalPrice: row.order_total_price,
        orderStatus: row.order_status,
        orderCreatedAt: row.order_created_at,
        userName: row.user_name,
        userEmail: row.user_email,
        userPhone: row.user_phone,
    };
};

const Payment = {
    async findById(id) {
        const { rows } = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
        return rowToPayment(rows[0]);
    },
    async findOne(filter) {
        if (filter.checkoutRequestID) {
            const { rows } = await pool.query(
                'SELECT * FROM payments WHERE checkout_request_id = $1', [filter.checkoutRequestID]
            );
            return rowToPayment(rows[0]);
        }
        return null;
    },
    async find(filter = {}) {
        const { rows } = await pool.query(
            `SELECT p.*,
              o.total_price AS order_total_price, o.status AS order_status, o.created_at AS order_created_at,
              u.name AS user_name, u.email AS user_email, u.phone AS user_phone
             FROM payments p
             LEFT JOIN orders o ON p.order_id = o.id
             LEFT JOIN users u ON p.user_id = u.id
             ORDER BY p.created_at DESC`
        );
        return rows.map(row => {
            const pay = rowToPayment(row);
            pay.order = { _id: row.order_id, id: row.order_id, totalPrice: row.order_total_price, status: row.order_status, createdAt: row.order_created_at };
            pay.user = { _id: row.user_id, id: row.user_id, name: row.user_name, email: row.user_email, phone: row.user_phone };
            return pay;
        });
    },
    async create(data) {
        const { rows } = await pool.query(
            `INSERT INTO payments (order_id, user_id, amount, phone_number, checkout_request_id, merchant_request_id, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [data.order, data.user, data.amount, data.phoneNumber, data.checkoutRequestID, data.merchantRequestID, data.status || 'pending']
        );
        return rowToPayment(rows[0]);
    },
    async save(payment) {
        const { rows } = await pool.query(
            `UPDATE payments SET status=$1, mpesa_receipt_number=$2, transaction_date=$3, result_desc=$4
             WHERE id=$5 RETURNING *`,
            [payment.status, payment.mpesaReceiptNumber || null, payment.transactionDate || null, payment.resultDesc || null, payment._id]
        );
        return rowToPayment(rows[0]);
    },
};

module.exports = Payment;
