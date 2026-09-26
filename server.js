const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'ratnawat-secret-key';

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log('Connected to SQLite database.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    email TEXT UNIQUE,
    password TEXT,
    verified INTEGER DEFAULT 0,
    otp TEXT,
    otp_expires INTEGER
  )`, (err) => {
    if (err) console.error('Users table error:', err.message);
    else console.log('Users table ready.');
  });

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    stock INTEGER,
    meesho_active INTEGER, meesho_price REAL,
    flipkart_active INTEGER, flipkart_price REAL,
    amazon_active INTEGER, amazon_price REAL,
    myntra_active INTEGER, myntra_price REAL
  )`, (err) => {
    if (err) console.error('Products table error:', err.message);
    else console.log('Products table ready.');
  });
});

app.use((req, res, next) => {
  console.log(req.method + ' ' + req.url);
  next();
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/api/auth/register', async (req, res) => {
  const username = req.body.username;
  const email = req.body.email;
  const password = req.body.password;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000;
    db.run('INSERT INTO users (username, email, password, verified, otp, otp_expires) VALUES (?, ?, ?, 0, ?, ?)',
      [username, email, hashedPassword, otp, otpExpires], function (err) {
        if (err) {
          return res.status(400).json({ message: 'Registration failed: ' + err.message });
        }
        transporter.sendMail({
          from: GMAIL_USER,
          to: email,
          subject: 'RIVA - Aapka OTP',
          text: 'Namaste ' + username + ',\n\nAapka RIVA registration OTP hai: ' + otp + '\n\nYeh 10 minute me expire ho jayega.'
        }, function (mailErr) {
          if (mailErr) console.error('Mail error:', mailErr.message);
          else console.log('OTP mail bheja: ' + email);
        });
        return res.status(201).json({ message: 'Registered! OTP aapke email par bheja gaya hai.' });
      });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  const email = req.body.email;
  const otp = req.body.otp;
  if (!email || !otp) {
    return res.status(400).json({ message: 'Email aur OTP dono chahiye' });
  }
  db.get('SELECT * FROM users WHERE email = ?', [email], function (err, user) {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!user) return res.status(400).json({ message: 'User not found' });
    if (user.verified) return res.status(400).json({ message: 'Already verified hai, login kariye' });
    if (Date.now() > user.otp_expires) return res.status(400).json({ message: 'OTP expire ho gaya, dobara register karein' });
    if (user.otp !== otp) return res.status(400).json({ message: 'Galat OTP' });
    db.run('UPDATE users SET verified = 1, otp = NULL WHERE email = ?', [email], function (updErr) {
      if (updErr) return res.status(500).json({ message: 'Server error' });
      res.json({ message: 'Verified! Ab login kar sakte hain.' });
    });
  });
});

app.post('/api/auth/login', (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  db.get('SELECT * FROM users WHERE email = ?', [email], function (err, user) {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!user) return res.status(400).json({ message: 'User not found' });
    if (!user.verified) return res.status(400).json({ message: 'Pehle email OTP se verify karein' });
    bcrypt.compare(password, user.password, function (err2, match) {
      if (!match) return res.status(400).json({ message: 'Wrong password' });
      const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '7d' });
      res.json({ message: 'Login successful', token: token, username: user.username });
    });
  });
});

app.post('/api/products', (req, res) => {
  const p = req.body;
  if (!p.title) return res.status(400).json({ message: 'Title required' });
  const query = 'INSERT INTO products (title, stock, meesho_active, meesho_price, flipkart_active, flipkart_price, amazon_active, amazon_price, myntra_active, myntra_price) VALUES (?,?,?,?,?,?,?,?,?,?)';
  db.run(query, [
    p.title, p.stock || 0,
    p.meesho_active ? 1 : 0, p.meesho_price || 0,
    p.flipkart_active ? 1 : 0, p.flipkart_price || 0,
    p.amazon_active ? 1 : 0, p.amazon_price || 0,
    p.myntra_active ? 1 : 0, p.myntra_price || 0
  ], function (err) {
    if (err) return res.status(400).json({ message: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products', function (err, rows) {
    if (err) return res.status(500).json({ message: err.message });
    const products = rows.map(function (r) {
      return {
        id: r.id, title: r.title, stock: r.stock,
        meesho_active: !!r.meesho_active, meesho_price: r.meesho_price,
        flipkart_active: !!r.flipkart_active, flipkart_price: r.flipkart_price,
        amazon_active: !!r.amazon_active, amazon_price: r.amazon_price,
        myntra_active: !!r.myntra_active, myntra_price: r.myntra_price
      };
    });
    res.json({ products: products });
  });
});

app.get('/api/stats', (req, res) => {
  db.all('SELECT * FROM products', function (err, rows) {
    if (err) return res.status(500).json({ message: err.message });
    const totalProducts = rows.length;
    let totalStock = 0;
    let totalValue = 0;
    rows.forEach(function (r) {
      totalStock += r.stock || 0;
      const prices = [];
      if (r.meesho_active) prices.push(r.meesho_price);
      if (r.flipkart_active) prices.push(r.flipkart_price);
      if (r.amazon_active) prices.push(r.amazon_price);
      if (r.myntra_active) prices.push(r.myntra_price);
      let avg = 0;
      if (prices.length) {
        let sum = 0;
        prices.forEach(function (x) { sum += x; });
        avg = sum / prices.length;
      }
      totalValue += avg * (r.stock || 0);
    });
    res.json({ totalProducts: totalProducts, totalStock: totalStock, totalValue: totalValue });
  });
});

app.post('/api/chat', (req, res) => {
  const msg = ((req.body && req.body.message) || '').toLowerCase();
  db.all('SELECT * FROM products', function (err, rows) {
    if (err) return res.json({ reply: 'Kuch gadbad ho gayi, dobara try karein.' });
    if (msg.indexOf('stock') !== -1) {
      const low = rows.filter(function (r) { return r.stock < 5; });
      if (low.length) {
        const names = low.map(function (r) { return r.title; }).join(', ');
        return res.json({ reply: low.length + ' product(s) ka stock kam hai: ' + names });
      }
      return res.json({ reply: 'Sab products ka stock theek hai.' });
    }
    if (msg.indexOf('price') !== -1 || msg.indexOf('kimat') !== -1) {
      return res.json({ reply: 'Abhi ' + rows.length + ' products listed hain. Kisi specific product ka naam batayein.' });
    }
    res.json({ reply: 'Main abhi stock aur price se judi jaankari de sakti hoon. Kuch aur puchna ho to batayein.' });
  });
});

app.listen(PORT, '0.0.0.0', function () {
  console.log('Server running on http://localhost:' + PORT);
});
