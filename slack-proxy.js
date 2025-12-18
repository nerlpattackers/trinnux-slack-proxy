import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

const app = express();

/* ======================
   Middleware
====================== */

// Allow localhost (dev) + Railway UAT
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://*.up.railway.app",
    ],
    methods: ["POST", "GET"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Parse JSON body
app.use(express.json());

/* ======================
   Rate Limiter (Anti-Spam)
====================== */
const contactLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: "Too many submissions. Please try again later.",
  },
});

/* ======================
   Health Check
====================== */
app.get("/", (req, res) => {
  res.send("✅ Trinnux Slack Proxy (UAT) is running");
});

/* ======================
   Slack – CTA Submit
====================== */
app.post("/contact-submit", contactLimiter, async (req, res) => {
  const { name, email, phone, company, message } = req.body;

  // Validate required fields
  if (!name || !email || !message) {
    return res.status(400).json({
      ok: false,
      error: "Missing required fields.",
    });
  }

  const payload = {
    channel: process.env.SLACK_CHANNEL_ID,
    text: "New Contact CTA Message",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📨 New Contact CTA Submission",
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Name:*\n${name}` },
          { type: "mrkdwn", text: `*Email:*\n${email}` },
          { type: "mrkdwn", text: `*Phone:*\n${phone || "—"}` },
          { type: "mrkdwn", text: `*Company:*\n${company || "—"}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Message:*\n${message}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `🌐 Source: *Contact CTA (UAT)* • ${new Date().toLocaleString()}`,
          },
        ],
      },
    ],
  };

  try {
    const slackResponse = await fetch(
      "https://slack.com/api/chat.postMessage",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await slackResponse.json();
    console.log("📨 Slack message result:", result);

    if (!result.ok) {
      return res.status(500).json({
        ok: false,
        error: "Slack message failed",
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Slack CTA Error:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

/* ======================
   Start Server (Railway)
====================== */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Slack proxy running on port ${PORT}`);
});
