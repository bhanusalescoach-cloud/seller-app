const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./seller_app.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS enterprise_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        stock INTEGER DEFAULT 1,
        meesho_active INTEGER DEFAULT 0,
        meesho_price REAL DEFAULT 0,
        flipkart_active INTEGER DEFAULT 0,
        flipkart_price REAL DEFAULT 0,
        amazon_active INTEGER DEFAULT 0,
        amazon_price REAL DEFAULT 0,
        myntra_active INTEGER DEFAULT 0,
        myntra_price REAL DEFAULT 0
    )`);
});

function broadcast() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'REFRESH' }));
        }
    });
}

app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM enterprise_products ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ products: rows });
    });
});

app.get('/api/stats', (req, res) => {
    const query = `
        SELECT 
            COUNT(*) as totalProducts, 
            SUM(stock) as totalStock,
            SUM(
                (CASE WHEN meesho_active THEN meesho_price ELSE 0 END +
                 CASE WHEN flipkart_active THEN flipkart_price ELSE 0 END +
                 CASE WHEN amazon_active THEN amazon_price ELSE 0 END +
                 CASE WHEN myntra_active THEN myntra_price ELSE 0 END) * stock
            ) as totalValue
        FROM enterprise_products
    `;
    db.get(query, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            totalProducts: row.totalProducts || 0,
            totalStock: row.totalStock || 0,
            totalValue: row.totalValue || 0
        });
    });
});

app.post('/api/products', (req, res) => {
    const { 
        title, stock, 
        meesho_active, meesho_price,
        flipkart_active, flipkart_price,
        amazon_active, amazon_price,
        myntra_active, myntra_price 
    } = req.body;

    if (!title) return res.status(400).json({ error: "Product Title is required" });

    const sql = `INSERT INTO enterprise_products 
        (title, stock, meesho_active, meesho_price, flipkart_active, flipkart_price, amazon_active, amazon_price, myntra_active, myntra_price) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
        title, stock || 1,
        meesho_active ? 1 : 0, meesho_price || 0,
        flipkart_active ? 1 : 0, flipkart_price || 0,
        amazon_active ? 1 : 0, amazon_price || 0,
        myntra_active ? 1 : 0, myntra_price || 0
    ];

    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        broadcast();
        res.status(201).json({ message: "Product added!" });
    });
});

app.delete('/api/products/:id', (req, res) => {
    db.run("DELETE FROM enterprise_products WHERE id = ?", req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        broadcast();
        res.json({ message: "Deleted successfully!" });
    });
});

app.post('/api/ai/shriddhi-chat', (req, res) => {
    const { userMessage } = req.body;
    const msg = userMessage.toLowerCase();

    db.all("SELECT * FROM enterprise_products", [], (err, products) => {
        let aiReply = "Hello! I am Shriddhi AI, assistant for Ratnawat Enterprises. How can I assist with your business today?";

        if (msg.includes("price") || msg.includes("rate")) {
            const found = products.find(p => msg.includes(p.title.toLowerCase()));
            if (found) {
                aiReply = `${found.title} pricing - Meesho: ₹${found.meesho_price || 'N/A'}, Flipkart: ₹${found.flipkart_price || 'N/A'}, Amazon: ₹${found.amazon_price || 'N/A'}`;
            } else {
                aiReply = `Ratnawat Enterprises currently has ${products.length} products active in inventory.`;
            }
        } else if (msg.includes("stock") || msg.includes("inventory")) {
            const totalUnits = products.reduce((acc, p) => acc + p.stock, 0);
            aiReply = `Total active inventory stock across all channels for Ratnawat Enterprises is ${totalUnits} units.`;
        } else {
            aiReply = `Shriddhi AI active. Monitoring ${products.length} catalog items for Ratnawat Enterprises.`;
        }

        res.json({ reply: aiReply });
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Ratnawat Enterprises Hub Running on http://localhost:${PORT}`);
});
