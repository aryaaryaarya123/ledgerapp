const db = require('../config/db');

exports.getTransactions = async (req, res) => {
    try {
        const pool = db.getPool();
        const result = await pool.query(`
            SELECT t.*, array_agg(a.user_name) FILTER (WHERE a.user_name IS NOT NULL) as approved_by
            FROM transactions t LEFT JOIN approvals a ON t.id = a.transaction_id
            GROUP BY t.id ORDER BY t.date DESC, t.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createTransaction = async (req, res) => {
    const { id, type, name, amount, date, paidBy, person, category, source, splitType, shares, from, to, other } = req.body;
    try {
        const pool = db.getPool();
        let status = (type === 'expense' && (paidBy === 'Gaurav Laudari' || (shares && shares['Gaurav Laudari'] > 0))) ? 'PENDING_APPROVAL' : 'APPROVED';
        await pool.query(`
            INSERT INTO transactions (id, type, name, amount, date, person_payer, other_person, category_source, split_type, shares, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [id, type, name, amount, date, (type === 'income' ? person : (type === 'debt' ? to : paidBy)), (type === 'debt' ? from : other), (type === 'income' ? source : category), splitType, JSON.stringify(shares), status]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.approveTransaction = async (req, res) => {
    try {
        const pool = db.getPool();
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
};

exports.deleteTransaction = async (req, res) => {
    try {
        const pool = db.getPool();
        await pool.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
