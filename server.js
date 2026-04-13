const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
require('./config/db'); // Initialize DB connection

const transactionRoutes = require('./routes/transactionRoutes');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.send('OK'));

app.use('/api', transactionRoutes);

app.listen(port, () => console.log(`Server running on port ${port}`));
