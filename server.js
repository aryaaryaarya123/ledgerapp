const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// --- DATABASE CONFIGURATION ---
// Use environment variable if available (Render default), otherwise fallback to hardcoded
const connectionString = process.env.DATABASE_URL || 'postgresql://ledger_wvaw_user:TXprx4S69vzdHJmQ4ageu6bvwMQ11EEJ@dpg-d6vnm31r0fns73cd9k00-a/ledger_wvaw';

const pool = new Pool({
  connectionString: connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Request Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Initialize Database Schema
async function initDB() {
  try {
    // 1. Transactions Table
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

    // 2. Approvals Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS approvals (
        id SERIAL PRIMARY KEY,
        transaction_id BIGINT REFERENCES transactions(id) ON DELETE CASCADE,
        user_name VARCHAR(100) NOT NULL,
        approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(transaction_id, user_name)
      )
    `);
    
    console.log('Database schema verified.');
    await seedDB();
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

async function seedDB() {
  try {
    const count = await pool.query('SELECT COUNT(*) FROM transactions');
    if (count.rows[0].count === '0') {
      console.log('Seeding initial balances...');
      const now = new Date().toISOString().split('T')[0];
      await pool.query(`
        INSERT INTO transactions (id, type, name, amount, date, person_payer, other_person, status)
        VALUES ($1, 'debt', 'Opening Balance (Migration)', 2877, $2, 'Arya Lamsal', 'Umanga Regmi', 'APPROVED')
      `, [Date.now(), now]);
      await pool.query(`
        INSERT INTO transactions (id, type, name, amount, date, person_payer, other_person, status)
        VALUES ($1, 'debt', 'Opening Balance (Migration)', 1136, $2, 'Arya Lamsal', 'Gaurav Laudari', 'APPROVED')
      `, [Date.now() + 1, now]);
      console.log('Seeding complete.');
    }
  } catch (err) {
    console.error('Seeding error:', err);
  }
}

initDB();

// ═══════════════════════════════
//  API ENDPOINTS
// ═══════════════════════════════

app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/api/transactions', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, 
        array_agg(a.user_name) FILTER (WHERE a.user_name IS NOT NULL) as approved_by
      FROM transactions t
      LEFT JOIN approvals a ON t.id = a.transaction_id
      GROUP BY t.id
      ORDER BY t.date DESC, t.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  const { id, type, name, amount, date, paidBy, person, category, source, splitType, shares, from, to, other } = req.body;
  if (!name || isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Valid name and amount required.' });

  try {
    let status = 'APPROVED'; 
    if (type === 'expense') {
      const gauravInvolved = (paidBy === 'Gaurav Laudari') || (shares && shares['Gaurav Laudari'] > 0);
      if (gauravInvolved) status = 'PENDING_APPROVAL';
    }

    const query = `
      INSERT INTO transactions (id, type, name, amount, date, person_payer, other_person, category_source, split_type, shares, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const values = [
      id, type, name, amount, date, 
      (type === 'income' ? person : (type === 'debt' ? to : paidBy)),
      (type === 'debt' ? from : other),
      (type === 'income' ? source : category), 
      splitType, JSON.stringify(shares), status
    ];
    const result = await pool.query(query, values);
    res.json({ ...result.rows[0], approved_by: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/approve/:id', async (req, res) => {
  const { id } = req.params;
  const { userName } = req.body;
  try {
    await pool.query('INSERT INTO approvals (transaction_id, user_name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, userName]);
    const approvals = await pool.query('SELECT user_name FROM approvals WHERE transaction_id = $1', [id]);
    const names = approvals.rows.map(r => r.user_name);
    if (names.includes('Umanga Regmi') && names.includes('Gaurav Laudari')) {
      await pool.query('UPDATE transactions SET status = \'APPROVED\' WHERE id = $1', [id]);
    }
    res.json({ success: true, approved_by: names });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM transactions WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Server Error');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
