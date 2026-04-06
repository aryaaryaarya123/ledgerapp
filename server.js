const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

const INTERNAL_URL = 'postgresql://ledger_wvaw_user:TXprx4S69vzdHJmQ4ageu6bvwMQ11EEJ@dpg-d6vnm31r0fns73cd9k00-a/ledger_wvaw';
const EXTERNAL_URL = 'postgresql://ledger_wvaw_user:TXprx4S69vzdHJmQ4ageu6bvwMQ11EEJ@d6vnm31r0fns73cd9k00-a.singapore-postgres.render.com/ledger_wvaw';

let pool;

function connect() {
    // If Render provides a URL, use it first
    const connectionString = process.env.DATABASE_URL || INTERNAL_URL;
    
    // Internal URLs often don't need SSL, but External ones DO.
    // We'll try with SSL first as it's safer for Render.
    console.log('Attempting DB connection...');
    
    pool = new Pool({
        connectionString: connectionString,
        ssl: connectionString.includes('singapore-postgres.render.com') || !connectionString.includes('dpg-') 
             ? { rejectUnauthorized: false } 
             : false,
        connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
    });
}

connect();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB
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
        console.error('DB Initialization failed. Switching to External URL...');
        // Fallback to external if internal fails
        pool = new Pool({
            connectionString: EXTERNAL_URL,
            ssl: { rejectUnauthorized: false }
        });
    }
}

initDB();

app.get('/health', (req, res) => res.send('OK'));

app.get('/api/transactions', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, array_agg(a.user_name) FILTER (WHERE a.user_name IS NOT NULL) as approved_by
            FROM transactions t LEFT JOIN approvals a ON t.id = a.transaction_id
            GROUP BY t.id ORDER BY t.date DESC, t.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions', async (req, res) => {
    const { id, type, name, amount, date, paidBy, person, category, source, splitType, shares, from, to, other } = req.body;
    try {
        let status = (type === 'expense' && (paidBy === 'Gaurav Laudari' || (shares && shares['Gaurav Laudari'] > 0))) ? 'PENDING_APPROVAL' : 'APPROVED';
        await pool.query(`
            INSERT INTO transactions (id, type, name, amount, date, person_payer, other_person, category_source, split_type, shares, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [id, type, name, amount, date, (type === 'income' ? person : (type === 'debt' ? to : paidBy)), (type === 'debt' ? from : other), (type === 'income' ? source : category), splitType, JSON.stringify(shares), status]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/approve/:id', async (req, res) => {
    try {
        await pool.query('INSERT INTO approvals (transaction_id, user_name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, req.body.userName]);
        const apps = await pool.query('SELECT user_name FROM approvals WHERE transaction_id = $1', [req.params.id]);
        const names = apps.rows.map(r => r.user_name);
        if (names.includes('Umanga Regmi') && names.includes('Gaurav Laudari')) {
            await pool.query('UPDATE transactions SET status = \'APPROVED\' WHERE id = $1', [req.params.id]);
        }
        res.json({ success: true, approved_by: names });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/transactions/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
