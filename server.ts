
import express from "express";
import { google } from "googleapis";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
