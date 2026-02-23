import express from "express";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/milestone", async (req, res) => {
    const { email, name, streak } = req.body;

    if (!resend) {
      console.warn("RESEND_API_KEY not set. Skipping email.");
      return res.json({ success: true, message: "Email skipped (no API key)" });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: "SocialTrackr <onboarding@resend.dev>",
        to: [email],
        subject: `🔥 You're on Fire! ${streak}-Day Streak Milestone`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #0F172A;">
            <h1 style="color: #6C5CE7;">Amazing work, ${name}!</h1>
            <p>You've just hit a <strong>${streak}-day streak</strong> on SocialTrackr.</p>
            <p>Consistency is the key to growth. Keep showing up and the results will follow.</p>
            <div style="margin-top: 30px; padding: 20px; background: #F7F8FC; border-radius: 12px;">
              <p style="margin: 0; font-weight: bold;">Current Goal: Awareness</p>
              <p style="margin: 5px 0 0 0; color: #64748B;">Next milestone: ${streak + 3} days</p>
            </div>
            <p style="margin-top: 30px; font-size: 12px; color: #94A3B8;">
              SocialTrackr · AI Growth OS
            </p>
          </div>
        `,
      });

      if (error) {
        console.error("Resend Error:", error);
        return res.status(500).json({ error: error.message });
      }

      res.json({ success: true, data });
    } catch (err: any) {
      console.error("Server Error:", err);
      res.status(500).json({ error: err.message });
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
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
