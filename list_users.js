const Database = require('better-sqlite3');
const db = new Database('./server/database.sqlite');

const users = db.prepare('SELECT * FROM users').all();
console.table(users);
