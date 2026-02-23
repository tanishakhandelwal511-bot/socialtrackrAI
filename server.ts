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
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey || apiKey === "MY_RESEND_API_KEY") {
      console.error("RESEND_API_KEY is missing or invalid.");
      return res.status(500).json({ 
        success: false, 
        error: "Email service not configured. Please set a valid RESEND_API_KEY in environment variables." 
      });
    }

    try {
      const resendClient = new Resend(apiKey);
      const { data, error } = await resendClient.emails.send({
        from: "SocialTrackr <onboarding@resend.dev>",
        to: [email],
        subject: `🔥 You're on Fire! ${streak}-Day Streak Milestone`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #0F172A; max-width: 600px; margin: auto; border: 1px solid #E2E8F0; border-radius: 16px;">
            <h1 style="color: #6C5CE7; margin-top: 0;">Amazing work, ${name}!</h1>
            <p style="font-size: 16px; line-height: 1.5;">You've just hit a <strong>${streak}-day streak</strong> on SocialTrackr.</p>
            <p style="font-size: 16px; line-height: 1.5;">Consistency is the key to growth. Every post you make builds your digital leverage. Keep showing up!</p>
            
            <div style="margin: 30px 0; padding: 24px; background: #F8FAFC; border-radius: 12px; border: 1px dashed #CBD5E1;">
              <h3 style="margin: 0 0 10px 0; color: #1E293B;">Milestone Stats</h3>
              <p style="margin: 5px 0; color: #64748B;">Current Streak: <strong>${streak} Days</strong></p>
              <p style="margin: 5px 0; color: #64748B;">Next milestone: <strong>${streak + 3} days</strong></p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.APP_URL || '#'}" style="background: #6C5CE7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Open Dashboard</a>
            </div>

            <hr style="margin: 40px 0 20px 0; border: 0; border-top: 1px solid #F1F5F9;" />
            <p style="font-size: 12px; color: #94A3B8; text-align: center;">
              SocialTrackr · The AI Growth OS for Creators<br/>
              Sent via Resend
            </p>
          </div>
        `,
      });

      if (error) {
        console.error("Resend API Error:", error);
        return res.status(400).json({ success: false, error: error.message });
      }

      console.log(`Email sent successfully to ${email} for ${streak}-day streak.`);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("Server Exception:", err);
      res.status(500).json({ success: false, error: err.message });
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
