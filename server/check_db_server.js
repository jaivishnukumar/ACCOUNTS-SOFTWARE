const Database = require('better-sqlite3');
const path = require('path');
// Check the SERVER database
const dbPath = path.join(__dirname, 'sales_app.db');
const db = new Database(dbPath);

try {
    console.log('Checking DB at:', dbPath);
    const users = db.prepare('SELECT * FROM users').all();
    console.log('Users found:', users);
} catch (error) {
    console.error('Error reading DB:', error.message);
}
