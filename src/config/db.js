const { Pool } = require('@neondatabase/serverless');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const connectDB = async () => {
    try {
        await pool.query('SELECT 1');
        console.log('✅ Neon PostgreSQL connected');
    } catch (error) {
        console.error(`Neon DB connection error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = { connectDB, pool };
