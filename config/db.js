const { Pool } = require('pg');
require('dotenv').config();

const INTERNAL_URL = 'postgresql://ledger_wvaw_user:TXprx4S69vzdHJmQ4ageu6bvwMQ11EEJ@dpg-d6vnm31r0fns73cd9k00-a/ledger_wvaw';
const EXTERNAL_URL = 'postgresql://ledger_wvaw_user:TXprx4S69vzdHJmQ4ageu6bvwMQ11EEJ@d6vnm31r0fns73cd9k00-a.singapore-postgres.render.com/ledger_wvaw';

let pool;

function getPoolConfig(connectionString) {
    return {
        connectionString: connectionString,
        ssl: connectionString.includes('singapore-postgres.render.com') || !connectionString.includes('dpg-') 
             ? { rejectUnauthorized: false } 
             : false,
        connectionTimeoutMillis: 10000,
    };
}

const connectionString = process.env.DATABASE_URL || INTERNAL_URL;
pool = new Pool(getPoolConfig(connectionString));

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

async function initDB() {
    try {
        await pool.query('SELECT 1');
        console.log('Database connected successfully.');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id BIGINT PRIMARY KEY,
                type VARCHAR(20) NOT NULL,
                name VARCHAR(255) NOT NULL,
                amount DECIMAL(15, 2) NOT NULL,
                date DATE NOT NULL,
                person_payer VARCHAR(100),
                other_person VARCHAR(100),
                category_source VARCHAR(100),
                split_type VARCHAR(50),
                shares JSONB,
                status VARCHAR(20) DEFAULT 'APPROVED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS approvals (
                id SERIAL PRIMARY KEY,
                transaction_id BIGINT REFERENCES transactions(id) ON DELETE CASCADE,
                user_name VARCHAR(100) NOT NULL,
                approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(transaction_id, user_name)
            )
        `);
        
        // Seed if empty
        const res = await pool.query('SELECT COUNT(*) FROM transactions');
        if (res.rows[0].count === '0') {
            console.log('Seeding initial data...');
            const now = new Date().toISOString().split('T')[0];
            await pool.query(`INSERT INTO transactions (id, type, name, amount, date, person_payer, other_person, status) VALUES ($1, 'debt', 'Initial Balance', 2877, $2, 'Arya Lamsal', 'Umanga Regmi', 'APPROVED')`, [Date.now(), now]);
            await pool.query(`INSERT INTO transactions (id, type, name, amount, date, person_payer, other_person, status) VALUES ($1, 'debt', 'Initial Balance', 1136, $2, 'Arya Lamsal', 'Gaurav Laudari', 'APPROVED')`, [Date.now()+1, now]);
        }
    } catch (err) {
        console.error('DB Initialization failed. Switching to External URL...', err.message);
        // Fallback to external if internal fails
        pool = new Pool(getPoolConfig(EXTERNAL_URL));
    }
}

initDB();

module.exports = {
    getPool: () => pool
};
