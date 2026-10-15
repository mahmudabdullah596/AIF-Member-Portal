
import express from "express";
import { google } from "googleapis";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import webpush from "web-push";
import { getMonthlySavingsNotification, getDailyNotification } from "./notificationMessages";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Web Push Setup for Background & Scheduled Notifications ---
const VAPID_FILE = path.join(__dirname, "vapid-keys.json");
let vapidKeys: { publicKey: string; privateKey: string };

try {
  if (fs.existsSync(VAPID_FILE)) {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, "utf-8"));
  } else {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
  }
} catch (e) {
  vapidKeys = webpush.generateVAPIDKeys();
}

webpush.setVapidDetails(
  "mailto:support@al-ittehad.local",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Push Subscriptions storage
const SUBS_FILE = path.join(__dirname, "push-subscriptions.json");
interface StoredSubscription {
  subscription: webpush.PushSubscription;
  memberInfo?: { name?: string; role?: string; id?: string };
  createdAt: string;
}

let subscriptions: StoredSubscription[] = [];
try {
  if (fs.existsSync(SUBS_FILE)) {
    subscriptions = JSON.parse(fs.readFileSync(SUBS_FILE, "utf-8"));
  }
} catch (e) {
  subscriptions = [];
}

function saveSubscriptions() {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2));
  } catch (err) {
    console.error("Failed to save subscriptions to disk:", err);
  }
}

async function sendPushToSubscribers(payload: { title: string; body: string; icon?: string; badge?: string; tag?: string; data?: any }) {
  const deadEndpoints: string[] = [];
  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const personalPayload = { ...payload };
      if (sub.memberInfo?.name && payload.body.includes("[সদস্যের নাম]")) {
        personalPayload.body = payload.body.replace("[সদস্যের নাম]", sub.memberInfo.name);
      }
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(personalPayload));
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          deadEndpoints.push(sub.subscription.endpoint);
        }
        throw err;
      }
    })
  );

  if (deadEndpoints.length > 0) {
    subscriptions = subscriptions.filter(s => !deadEndpoints.includes(s.subscription.endpoint));
    saveSubscriptions();
  }

  return results;
}

// Initialize Gemini client on server with recommended telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

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

// --- Gemini Digital Assistance / AI Support ---
app.post("/api/gemini/support", async (req, res) => {
  try {
    const { prompt, memberContext } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "অনুগ্রহ করে আপনার প্রশ্নটি লিখুন।" });
    }

    // Sanitize context to prevent bloat or base64 avatar images in prompt
    const safeContext = memberContext ? {
      name: memberContext.name,
      id: memberContext.id,
      role: memberContext.role,
      totalSaved: memberContext.totalSaved,
      monthlySavings: memberContext.monthlySavings,
      totalDue: memberContext.totalDue,
      profitShare: memberContext.profitShare,
      joiningDate: memberContext.joiningDate,
      email: memberContext.email,
      phone: memberContext.phone,
    } : null;

    const contextStr = safeContext ? JSON.stringify(safeContext) : "সাধারণ সদস্য বা ভিজিটর";
    const systemInstruction = `
      You are an AI assistant for "আল ইত্তেহাদ ফোরাম" (Al-Ittehad Forum), a trusted community savings and welfare organization of 50 members.
      Each member saves money monthly, which is invested in halal businesses such as Super Shops, Agro/Agriculture, and Community Enterprises.
      The current user's profile and financial context is: ${contextStr}.
      Respond in clear, respectful, polite, and helpful Bengali language (বাংলা).
      Explain savings, due amounts, profit share, deposit submission procedure, notice updates, and investment progress accurately based on the context.
      Keep the formatting clean, elegant, concise, and easy to read.
    `;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });
    } catch (primaryErr) {
      console.warn("Primary model gemini-3.5-flash failed, falling back to gemini-3.5-flash-lite:", primaryErr);
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });
    }

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API server error:", error);
    res.status(500).json({ 
      error: error.message || "Failed to generate AI response",
      text: "দুঃখিত, এই মুহূর্তে এআই সার্ভিসে সংযোগে সমস্যা হচ্ছে। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।"
    });
  }
});

// --- Push Notification Endpoints & Background Scheduler ---

// 1. Get VAPID public key
app.get("/api/notifications/vapid-public-key", (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// 2. Subscribe device to Web Push
app.post("/api/notifications/subscribe", (req, res) => {
  try {
    const { subscription, memberInfo } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Invalid subscription payload" });
    }

    const existingIndex = subscriptions.findIndex(s => s.subscription.endpoint === subscription.endpoint);
    if (existingIndex >= 0) {
      subscriptions[existingIndex] = {
        subscription,
        memberInfo: memberInfo || subscriptions[existingIndex].memberInfo,
        createdAt: subscriptions[existingIndex].createdAt
      };
    } else {
      subscriptions.push({
        subscription,
        memberInfo,
        createdAt: new Date().toISOString()
      });
    }

    saveSubscriptions();
    res.json({ success: true, subscriberCount: subscriptions.length });
  } catch (err: any) {
    console.error("Error subscribing device:", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Get notification status & today's preview
app.get("/api/notifications/today", (req, res) => {
  const now = new Date();
  const todayNotification = getDailyNotification(now);
  const monthlyNotification = getMonthlySavingsNotification();

  res.json({
    subscriberCount: subscriptions.length,
    todayNotification,
    monthlyNotification,
    dateStr: now.toISOString().slice(0, 10),
    isFirstDayOfMonth: now.getDate() === 1
  });
});

// 4. Test trigger for Monthly 1st notification
app.post("/api/notifications/test-monthly", async (req, res) => {
  try {
    const { memberName } = req.body;
    const notif = getMonthlySavingsNotification(memberName);
    const results = await sendPushToSubscribers({
      title: notif.title,
      body: notif.body,
      icon: "/pwa-192x192.png",
      badge: "/favicon.ico",
      tag: `test-monthly-${Date.now()}`,
      data: { url: "/" }
    });

    res.json({ success: true, count: results.length, notification: notif });
  } catch (err: any) {
    console.error("Error triggering test monthly notification:", err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Test trigger for Daily notification
app.post("/api/notifications/test-daily", async (req, res) => {
  try {
    const { memberName } = req.body;
    const notif = getDailyNotification(new Date(), memberName);
    const results = await sendPushToSubscribers({
      title: notif.title,
      body: notif.body,
      icon: "/pwa-192x192.png",
      badge: "/favicon.ico",
      tag: `test-daily-${Date.now()}`,
      data: { url: "/" }
    });

    res.json({ success: true, count: results.length, notification: notif });
  } catch (err: any) {
    console.error("Error triggering test daily notification:", err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Admin custom broadcast
app.post("/api/notifications/broadcast", async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required" });
    }

    const results = await sendPushToSubscribers({
      title,
      body,
      icon: "/pwa-192x192.png",
      badge: "/favicon.ico",
      tag: `broadcast-${Date.now()}`,
      data: { url: "/" }
    });

    res.json({ success: true, deliveredCount: results.length });
  } catch (err: any) {
    console.error("Broadcast notification error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Background notification scheduler (runs every 10 minutes)
let lastMonthlySentMonth = "";
let lastDailySentDate = "";

async function runScheduledNotificationCheck() {
  try {
    if (subscriptions.length === 0) return;

    const now = new Date();
    // Dhaka time zone (UTC+6)
    const dhakaDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }); // "YYYY-MM-DD"
    const [year, month, day] = dhakaDateStr.split("-").map(Number);
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    // 1. Check if 1st day of month -> Send monthly savings notification
    if (day === 1 && lastMonthlySentMonth !== monthKey) {
      console.log(`[Push Scheduler] Sending 1st of month savings reminder for ${monthKey}`);
      for (const sub of subscriptions) {
        const memberName = sub.memberInfo?.name || "সম্মানিত সদস্য";
        const notif = getMonthlySavingsNotification(memberName);
        try {
          await webpush.sendNotification(
            sub.subscription,
            JSON.stringify({
              title: notif.title,
              body: notif.body,
              icon: "/pwa-192x192.png",
              badge: "/favicon.ico",
              tag: `monthly-savings-${monthKey}`,
              data: { url: "/" }
            })
          );
        } catch (err) {
          // silently handle individual failed pushes
        }
      }
      lastMonthlySentMonth = monthKey;
    }

    // 2. Check Daily notification (once per day)
    if (lastDailySentDate !== dhakaDateStr) {
      console.log(`[Push Scheduler] Sending daily notification for ${dhakaDateStr}`);
      const daily = getDailyNotification(now);
      // On day 1, monthly was prioritized, so on day !== 1 send daily
      if (day !== 1) {
        await sendPushToSubscribers({
          title: daily.title,
          body: daily.body,
          icon: "/pwa-192x192.png",
          badge: "/favicon.ico",
          tag: `daily-ittehad-${dhakaDateStr}`,
          data: { url: "/" }
        });
      }
      lastDailySentDate = dhakaDateStr;
    }
  } catch (err) {
    console.error("Scheduled push notification error:", err);
  }
}

// Run schedule check every 10 minutes
setInterval(runScheduledNotificationCheck, 10 * 60 * 1000);
// Also trigger a safe check 5 seconds after server start
setTimeout(runScheduledNotificationCheck, 5000);

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      hmr: false
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

export default app;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
