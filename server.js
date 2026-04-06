const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;
const DB_FILE = path.join(__dirname, 'db.json');

// --- DATABASE STRATEGY ---
let db = null;
const INTERNAL_DB_URL = 'postgresql://ledger_wvaw_user:TXprx4S69vzdHJmQ4ageu6bvwMQ11EEJ@dpg-d6vnm31r0fns73cd9k00-a/ledger_wvaw';
const EXTERNAL_DB_URL = 'postgresql://ledger_wvaw_user:TXprx4S69vzdHJmQ4ageu6bvwMQ11EEJ@d6vnm31r0fns73cd9k00-a.singapore-postgres.render.com/ledger_wvaw';

const connectionString = process.env.DATABASE_URL || INTERNAL_DB_URL;

async function tryConnect() {
  // Try Primary (Internal/Env)
  try {
    const pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });
    await pool.query('SELECT 1');
    db = pool;
    console.log('Connected to PostgreSQL (Primary/Internal).');
    return true;
  } catch (err) {
    console.log('Internal connection failed, trying External...');
    
    // Try External (Local Development)
    try {
      const pool = new Pool({
        connectionString: EXTERNAL_DB_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
      });
      await pool.query('SELECT 1');
      db = pool;
      console.log('Connected to PostgreSQL (External/Render.com).');
      return true;
    } catch (err2) {
      console.error('All PostgreSQL connections failed. Falling back to db.json.');
      return false;
    }
  }
}

let usePostgres = false;

// Initialize Database Strategy
async function init() {
  usePostgres = await tryConnect();
  
  if (!usePostgres) {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ transactions: [], approvals: [] }, null, 2));
    }
  } else {
    await initDB();
  }
}

init();

// Initialize Database Schema (Postgres only)
async function initDB() {
  if (!db) return;
  try {
    await db.query(`
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
    await db.query(`
      CREATE TABLE IF NOT EXISTS approvals (
        id SERIAL PRIMARY KEY,
        transaction_id BIGINT REFERENCES transactions(id) ON DELETE CASCADE,
        user_name VARCHAR(100) NOT NULL,
        approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(transaction_id, user_name)
      )
    `);
    console.log('PostgreSQL schema initialized.');
    await seedDB();
  } catch (err) {
    console.error('Error initializing Postgres:', err);
  }
}

async function seedDB() {
  try {
    const count = await db.query('SELECT COUNT(*) FROM transactions');
    if (count.rows[0].count === '0') {
      console.log('Seeding initial balances...');
      const now = new Date().toISOString().split('T')[0];
      // Insert Umanga owes Arya 2877
      await db.query(`
        INSERT INTO transactions (id, type, name, amount, date, person_payer, other_person, status)
        VALUES ($1, 'debt', 'Opening Balance (Migration)', 2877, $2, 'Arya Lamsal', 'Umanga Regmi', 'APPROVED')
      `, [Date.now(), now]);
      
      // Insert Gaurav owes Arya 1136
      await db.query(`
        INSERT INTO transactions (id, type, name, amount, date, person_payer, other_person, status)
        VALUES ($1, 'debt', 'Opening Balance (Migration)', 1136, $2, 'Arya Lamsal', 'Gaurav Laudari', 'APPROVED')
      `, [Date.now() + 1, now]);
      console.log('Initial data seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding database:', err);
  }
}

initDB();

// ═══════════════════════════════
//  API ENDPOINTS
// ═══════════════════════════════

app.get('/health', (req, res) => res.status(200).send('OK'));

// 1. Get All Transactions
app.get('/api/transactions', async (req, res) => {
  try {
    if (usePostgres) {
      const result = await db.query(`
        SELECT t.*, 
          array_agg(a.user_name) FILTER (WHERE a.user_name IS NOT NULL) as approved_by
        FROM transactions t
        LEFT JOIN approvals a ON t.id = a.transaction_id
        GROUP BY t.id
        ORDER BY t.date DESC, t.id DESC
      `);
      return res.json(result.rows);
    } else {
      const local = readLocalDB();
      const rows = local.transactions.map(t => ({
        ...t,
        approved_by: local.approvals.filter(a => a.transaction_id == t.id).map(a => a.user_name)
      })).sort((a,b) => new Date(b.date) - new Date(a.date) || b.id - a.id);
      res.json(rows);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Add New Transaction
app.post('/api/transactions', async (req, res) => {
  const { id, type, name, amount, date, paidBy, person, category, source, splitType, shares, from, to, other } = req.body;
  
  if (!name || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Valid name and positive amount are required.' });
  }

  try {
    let status = 'APPROVED'; 
    if (type === 'expense') {
      const gauravInvolved = (paidBy === 'Gaurav Laudari') || (shares && shares['Gaurav Laudari'] > 0);
      if (gauravInvolved) status = 'PENDING_APPROVAL';
    }

    if (usePostgres) {
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
      const result = await db.query(query, values);
      res.json({ ...result.rows[0], approved_by: [] });
    } else {
      const local = readLocalDB();
      const newTx = { 
        id, type, name, amount, date, 
        person_payer: (type === 'income' ? person : (type === 'debt' ? to : paidBy)),
        other_person: (type === 'debt' ? from : other),
        category_source: (type === 'income' ? source : category),
        split_type: splitType, shares, status 
      };
      local.transactions.push(newTx);
      writeLocalDB(local);
      res.json({ ...newTx, approved_by: [] });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Approve Transaction
app.put('/api/approve/:id', async (req, res) => {
  const { id } = req.params;
  const { userName } = req.body;

  try {
    if (usePostgres) {
      await db.query('INSERT INTO approvals (transaction_id, user_name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, userName]);
      const approvals = await db.query('SELECT user_name FROM approvals WHERE transaction_id = $1', [id]);
      const names = approvals.rows.map(r => r.user_name);
      if (names.includes('Umanga Regmi') && names.includes('Gaurav Laudari')) {
        await db.query('UPDATE transactions SET status = \'APPROVED\' WHERE id = $1', [id]);
      }
      res.json({ success: true, approved_by: names });
    } else {
      const local = readLocalDB();
      if (!local.approvals.some(a => a.transaction_id == id && a.user_name === userName)) {
        local.approvals.push({ transaction_id: id, user_name: userName });
      }
      const names = local.approvals.filter(a => a.transaction_id == id).map(a => a.user_name);
      if (names.includes('Umanga Regmi') && names.includes('Gaurav Laudari')) {
        const tx = local.transactions.find(t => t.id == id);
        if (tx) tx.status = 'APPROVED';
      }
      writeLocalDB(local);
      res.json({ success: true, approved_by: names });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Delete Transaction
app.delete('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (usePostgres) {
      await db.query('DELETE FROM transactions WHERE id = $1', [id]);
    } else {
      const local = readLocalDB();
      local.transactions = local.transactions.filter(t => t.id != id);
      local.approvals = local.approvals.filter(a => a.transaction_id != id);
      writeLocalDB(local);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


;


