
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, 'forum.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    joiningDate TEXT,
    monthlySavings REAL DEFAULT 0,
    totalSaved REAL DEFAULT 0,
    totalDue REAL DEFAULT 0,
    profitShare REAL DEFAULT 0,
    avatar TEXT,
    role TEXT DEFAULT 'member'
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    memberId TEXT,
    amount REAL,
    date TEXT,
    type TEXT,
    description TEXT,
    FOREIGN KEY (memberId) REFERENCES members(id)
  );

  CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    date TEXT,
    author TEXT,
    priority TEXT
  );

  CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    investmentAmount REAL,
    status TEXT,
    imageUrl TEXT
  );
`);

export default db;
