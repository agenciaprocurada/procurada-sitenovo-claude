import { Resend } from "resend";

/* ===========================================================
   PROCURADA — Endpoint de orçamento/contato (Vercel Serverless)
   Recebe o form, envia e-mail via Resend e repassa ao n8n.
   A API key vive em process.env.RESEND_API_KEY (NUNCA no código).
   =========================================================== */

const resend = new Resend(process.env.RESEND_API_KEY);

// Configuráveis por variável de ambiente (com defaults seguros).
const TO_EMAIL = process.env.CONTATO_EMAIL || "vinicius.kolling@gmail.com";
const FROM_EMAIL = process.env.RESEND_FROM || "Procurada <onboarding@resend.dev>";
const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "https://n8n-n8n.uzj3vo.easypanel.host/webhook/procurada-contatos";

const onlyDigits = (v) => String(v || "").replace(/\D/g, "");
function formatPhone(digits) {
  const d = onlyDigits(digits).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
const escapeHtml = (s) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

export default async function handler(req, res) {
  // ---- CORS (permite chamar de qualquer origem; ajuste se quiser travar) ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "Method not allowed" });

  // ---- parse do corpo (Vercel já entrega objeto p/ application/json) ----
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const nome = String(body.nome || "").trim();
  const whatsappDigits = onlyDigits(body.whatsapp);
  const servicos = Array.isArray(body.servicos) ? body.servicos : [];

  // ---- validação server-side ----
  if (!nome || whatsappDigits.length < 10 || whatsappDigits.length > 11) {
    return res.status(400).json({ ok: false, error: "Dados inválidos." });
  }

  const enviadoEm = new Date().toISOString();
  const servicosList = servicos.length
    ? servicos.map((s) => `<li>${escapeHtml(s)}</li>`).join("")
    : "<li><em>nenhum selecionado</em></li>";

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;background:#0d070c;color:#f7f2f5;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.1)">
      <div style="background:linear-gradient(135deg,#ff1e6b,#d3024e);padding:22px 28px">
        <h1 style="margin:0;font-size:18px;color:#fff">Novo contato — Procurada</h1>
      </div>
      <div style="padding:26px 28px;line-height:1.6">
        <p style="margin:0 0 6px"><strong>Nome:</strong> ${escapeHtml(nome)}</p>
        <p style="margin:0 0 6px"><strong>WhatsApp:</strong>
          <a href="https://wa.me/55${whatsappDigits}" style="color:#ff5b95">${formatPhone(whatsappDigits)}</a>
          &nbsp;<span style="color:#9182898f">(${whatsappDigits})</span>
        </p>
        <p style="margin:14px 0 6px"><strong>Serviços de interesse:</strong></p>
        <ul style="margin:0 0 10px 18px;padding:0;color:#cdc2c8">${servicosList}</ul>
        <p style="margin:14px 0 0;font-size:12px;color:#8d7a83">Origem: procurada-landing · ${enviadoEm}</p>
      </div>
    </div>`;

  try {
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ ok: false, error: "RESEND_API_KEY não configurada." });
    }

    // 1) envia o e-mail
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      replyTo: TO_EMAIL,
      subject: `Novo contato — ${nome}`,
      html,
    });
    if (error) throw new Error(error.message || "Falha no envio Resend");

    // 2) repassa ao n8n (server-side, sem CORS). Best-effort: não derruba a resposta.
    try {
      await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          whatsapp: whatsappDigits,
          servicos,
          origem: "procurada-landing",
          enviado_em: enviadoEm,
        }),
      });
    } catch (e) {
      console.error("Falha ao repassar p/ n8n:", e);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Erro no envio:", err);
    return res.status(502).json({ ok: false, error: "Não foi possível enviar." });
  }
}
