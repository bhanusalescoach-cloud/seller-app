const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./seller_app.db');

const categories = ['Fashion', 'Electronics', 'Home & Kitchen', 'Books', 'Beauty'];
const items = ['Kurti', 'Saree', 'T-Shirt', 'Jeans', 'Headphones', 'Smart Watch', 'Water Bottle', 'Cookware', 'Bed Sheet', 'Sneakers'];

db.serialize(() => {
    console.log("Adding 100 Demo Stocks...");
    const stmt = db.prepare("INSERT INTO products (title, price, sku, category, stock) VALUES (?, ?, ?, ?, ?)");

    for (let i = 1; i <= 100; i++) {
        const item = items[Math.floor(Math.random() * items.length)];
        const title = `${item} Grade-${i}`;
        const price = Math.floor(Math.random() * 1500) + 199;
        const sku = `MEESHO-SKU-${1000 + i}`;
        const category = categories[Math.floor(Math.random() * categories.length)];
        const stock = Math.floor(Math.random() * 80) + 1; // 1 to 80 stock quantity

        stmt.run(title, price, sku, category, stock);
    }

    stmt.finalize(() => {
        console.log("✅ 100 Stocks Successfully Added!");
        db.close();
    });
});
