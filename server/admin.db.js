const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'admin.db'));

// Initialize tables
function initDB() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS bans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT UNIQUE NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
}

// Admin functions
function createAdmin(username, password, cb) {
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return cb(err);
    db.run('INSERT INTO admins (username, password) VALUES (?, ?)', [username, hash], cb);
  });
}

function getAdminByUsername(username, cb) {
  db.get('SELECT * FROM admins WHERE username = ?', [username], cb);
}

function verifyAdmin(username, password, cb) {
  getAdminByUsername(username, (err, admin) => {
    if (err || !admin) return cb(err || new Error('User not found'));
    bcrypt.compare(password, admin.password, (err, res) => {
      if (err || !res) return cb(err || new Error('Invalid password'));
      cb(null, admin);
    });
  });
}

// Ban functions
function addBan(identifier, reason, cb) {
  db.run('INSERT OR IGNORE INTO bans (identifier, reason) VALUES (?, ?)', [identifier, reason], cb);
}

function removeBan(identifier, cb) {
  db.run('DELETE FROM bans WHERE identifier = ?', [identifier], cb);
}

function isBanned(identifier, cb) {
  db.get('SELECT * FROM bans WHERE identifier = ?', [identifier], (err, row) => {
    cb(err, !!row);
  });
}

function getAllBans(cb) {
  db.all('SELECT * FROM bans', cb);
}

module.exports = {
  initDB,
  createAdmin,
  getAdminByUsername,
  verifyAdmin,
  addBan,
  removeBan,
  isBanned,
  getAllBans,
  db
}; 