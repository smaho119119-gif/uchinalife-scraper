// うちなーらいふスクレイパーの通知メール中継（Vercel 東京リージョン）。
// XServer SMTP は GitHub Actions の海外IPを 554 で拒否するため、ここから送る。
// 宛先は環境変数 ALERT_TO に固定し、呼び出し側からは変えられない（中継の悪用防止）。
const crypto = require("crypto");
const nodemailer = require("nodemailer");

function tokenOk(header) {
  const expected = process.env.RELAY_TOKEN || "";
  const given = (header || "").replace(/^Bearer\s+/i, "");
  if (!expected || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!tokenOk(req.headers.authorization)) return res.status(401).json({ error: "unauthorized" });

  const { subject, body } = req.body || {};
  if (typeof subject !== "string" || typeof body !== "string" || !subject || subject.length > 300 || body.length > 200000) {
    return res.status(400).json({ error: "subject/body required" });
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM_NAME ? { name: process.env.SMTP_FROM_NAME, address: from } : from,
      to: process.env.ALERT_TO,
      subject,
      text: body,
    });
    return res.status(200).json({ ok: true, messageId: info.messageId, region: process.env.VERCEL_REGION || null });
  } catch (e) {
    return res.status(502).json({ error: String(e && e.message || e).slice(0, 300) });
  }
};
