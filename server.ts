
import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.ts";
import { members, transactions, notices, businesses } from "./mockData.ts";

dotenv.config();

// Seed database if empty
const memberCount = db.prepare("SELECT COUNT(*) as count FROM members").get() as any;
if (memberCount.count === 0) {
  console.log("Seeding database...");
  const insertMember = db.prepare(`
    INSERT INTO members (id, name, email, phone, joiningDate, monthlySavings, totalSaved, totalDue, profitShare, avatar, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  members.forEach(m => insertMember.run(m.id, m.name, m.email, m.phone, m.joiningDate, m.monthlySavings, m.totalSaved, m.totalDue, m.profitShare, m.avatar, m.role));

  const insertTx = db.prepare(`
    INSERT INTO transactions (id, memberId, amount, date, type, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  transactions.forEach(t => insertTx.run(t.id, t.memberId, t.amount, t.date, t.type, t.description));

  const insertNotice = db.prepare(`
    INSERT INTO notices (id, title, content, date, author, priority)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  notices.forEach(n => insertNotice.run(n.id, n.title, n.content, n.date, n.author, n.priority));

  const insertBusiness = db.prepare(`
    INSERT INTO businesses (id, title, description, investmentAmount, status, imageUrl)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  businesses.forEach(b => insertBusiness.run(b.id, b.title, b.description, b.investmentAmount, b.status, b.imageUrl));
  console.log("Database seeded.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// --- Database API Endpoints ---

// Members
app.get("/api/members", (req, res) => {
  const members = db.prepare("SELECT * FROM members").all();
  res.json(members);
});

app.post("/api/members", (req, res) => {
  const { id, name, email, phone, joiningDate, monthlySavings, totalSaved, totalDue, profitShare, avatar, role } = req.body;
  const stmt = db.prepare(`
    INSERT INTO members (id, name, email, phone, joiningDate, monthlySavings, totalSaved, totalDue, profitShare, avatar, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, name, email, phone, joiningDate, monthlySavings, totalSaved, totalDue, profitShare, avatar, role);
  res.json({ success: true });
});

app.put("/api/members/:id", (req, res) => {
  const { name, totalSaved, monthlySavings, totalDue, profitShare, avatar } = req.body;
  const stmt = db.prepare(`
    UPDATE members 
    SET name = ?, totalSaved = ?, monthlySavings = ?, totalDue = ?, profitShare = ?, avatar = ?
    WHERE id = ?
  `);
  stmt.run(name, totalSaved, monthlySavings, totalDue, profitShare, avatar, req.params.id);
  res.json({ success: true });
});

app.delete("/api/members/:id", (req, res) => {
  db.prepare("DELETE FROM members WHERE id = ?").run(req.params.id);
  db.prepare("DELETE FROM transactions WHERE memberId = ?").run(req.params.id);
  res.json({ success: true });
});

// Transactions
app.get("/api/transactions", (req, res) => {
  const txs = db.prepare("SELECT * FROM transactions ORDER BY date DESC").all();
  res.json(txs);
});

app.post("/api/transactions", (req, res) => {
  const { id, memberId, amount, date, type, description } = req.body;
  const stmt = db.prepare(`
    INSERT INTO transactions (id, memberId, amount, date, type, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, memberId, amount, date, type, description);
  
  // Update member total saved if it's a deposit
  if (type === 'deposit') {
    db.prepare("UPDATE members SET totalSaved = totalSaved + ? WHERE id = ?").run(amount, memberId);
  }
  
  res.json({ success: true });
});

// Notices
app.get("/api/notices", (req, res) => {
  const notices = db.prepare("SELECT * FROM notices ORDER BY date DESC").all();
  res.json(notices);
});

app.post("/api/notices", (req, res) => {
  const { id, title, content, date, author, priority } = req.body;
  const stmt = db.prepare(`
    INSERT INTO notices (id, title, content, date, author, priority)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, title, content, date, author, priority);
  res.json({ success: true });
});

app.delete("/api/notices/:id", (req, res) => {
  db.prepare("DELETE FROM notices WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Businesses
app.get("/api/businesses", (req, res) => {
  const businesses = db.prepare("SELECT * FROM businesses").all();
  res.json(businesses);
});

app.post("/api/businesses", (req, res) => {
  const { id, title, description, investmentAmount, status, imageUrl } = req.body;
  const stmt = db.prepare(`
    INSERT INTO businesses (id, title, description, investmentAmount, status, imageUrl)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, title, description, investmentAmount, status, imageUrl);
  res.json({ success: true });
});

app.put("/api/businesses/:id", (req, res) => {
  const { title, description, investmentAmount, status, imageUrl } = req.body;
  const stmt = db.prepare(`
    UPDATE businesses 
    SET title = ?, description = ?, investmentAmount = ?, status = ?, imageUrl = ?
    WHERE id = ?
  `);
  stmt.run(title, description, investmentAmount, status, imageUrl, req.params.id);
  res.json({ success: true });
});

app.delete("/api/businesses/:id", (req, res) => {
  db.prepare("DELETE FROM businesses WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// --- Google Sheets API ---
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL || 'http://localhost:3000'}/auth/google/callback`
);

app.get("/api/auth/google/url", (req, res) => {
  const scopes = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  res.json({ url });
});

app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    // In a real app, you'd store this in a database or a secure session
    // For this demo, we'll send it back to the client via a cookie or just postMessage
    
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'GOOGLE_AUTH_SUCCESS', 
                tokens: ${JSON.stringify(tokens)} 
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error getting tokens:", error);
    res.status(500).send("Authentication failed");
  }
});

app.post("/api/gsheets/data", async (req, res) => {
  const { tokens, spreadsheetId, range } = req.body;
  if (!tokens || !spreadsheetId) {
    return res.status(400).json({ error: "Missing tokens or spreadsheetId" });
  }

  try {
    oauth2Client.setCredentials(tokens);
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: range || "Sheet1!A:Z",
    });

    res.json({ values: response.data.values });
  } catch (error: any) {
    console.error("Error fetching sheet data:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
