/* ===========================================================
   PROCURADA — Modal de contato
   Abre via [data-contact-open], mascara o WhatsApp no input
   e envia o lead para a Edge Function do Supabase (fetch puro).
   =========================================================== */
(function () {
  "use strict";

  // CRM — Supabase Edge Function. A anon key é pública (pode ficar no site).
  const CRM_URL =
    "https://xwjiimhbnancmnzahnrp.supabase.co/functions/v1/leads";
  const CRM_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3amlpbWhibmFuY21uemFobnJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzIxODQsImV4cCI6MjA4ODA0ODE4NH0.sPW8qsTz5_J4Np_2EWblDxtMTKtm7oIIrMw4C3IF_pA";

  const modal = document.getElementById("contact-modal");
  const form = document.getElementById("contact-form");
  if (!modal || !form) return;

  const panel = modal.querySelector(".modal__panel");
  const nomeInput = form.elements["nome"];
  const phoneInput = form.elements["cf-whatsapp"] || document.getElementById("cf-whatsapp");
  const honeypot = form.elements["website"];
  const submitBtn = form.querySelector(".modal__submit");
  const submitLabel = form.querySelector(".modal__submit-label");
  const statusEl = form.querySelector("[data-status]");

  let lastFocused = null;

  /* ---------- máscara de telefone: (DD) NNNNN-NNNN ---------- */
  const onlyDigits = (v) => (v || "").replace(/\D/g, "");
  function formatPhone(value) {
    const d = onlyDigits(value).slice(0, 11);
    if (d.length === 0) return "";
    if (d.length <= 2) return "(" + d;
    if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10)
      return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }
  phoneInput.addEventListener("input", () => {
    phoneInput.value = formatPhone(phoneInput.value);
    clearError(phoneInput.closest(".field"));
  });

  /* ---------- abrir / fechar ---------- */
  const DEFAULT_SUBMIT_LABEL = submitLabel.textContent;
  function openModal() {
    lastFocused = document.activeElement;
    setStatus("", null);
    submitLabel.textContent = DEFAULT_SUBMIT_LABEL;
    submitBtn.disabled = false;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    // força reflow p/ a transição rodar
    void modal.offsetWidth;
    modal.classList.add("is-open");
    setTimeout(() => nomeInput && nomeInput.focus(), 60);
    document.addEventListener("keydown", onKeydown);
  }
  function closeModal() {
    modal.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    document.removeEventListener("keydown", onKeydown);
    const done = () => {
      modal.hidden = true;
      panel.removeEventListener("transitionend", done);
    };
    panel.addEventListener("transitionend", done);
    // fallback caso transitionend não dispare
    setTimeout(() => { if (modal.classList.contains("is-open") === false) modal.hidden = true; }, 450);
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }
  function onKeydown(e) {
    if (e.key === "Escape") closeModal();
  }

  document.querySelectorAll("[data-contact-open]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    });
  });
  modal.querySelectorAll("[data-contact-close]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  /* ---------- validação ---------- */
  function clearError(field) {
    if (field) field.classList.remove("has-error");
  }
  function setError(field) {
    if (field) field.classList.add("has-error");
  }
  nomeInput.addEventListener("input", () => clearError(nomeInput.closest(".field")));
  form.querySelectorAll('input[name="servicos"]').forEach((c) =>
    c.addEventListener("change", () =>
      clearError(form.querySelector(".field--services"))
    )
  );

  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.classList.remove("is-ok", "is-err");
    if (kind) statusEl.classList.add(kind);
    statusEl.hidden = !msg;
  }

  /* ---------- envio ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("", null);

    const nome = nomeInput.value.trim();
    const phoneDigits = onlyDigits(phoneInput.value);
    const servicos = Array.from(
      form.querySelectorAll('input[name="servicos"]:checked')
    ).map((c) => c.value);

    // validação: apenas o nome é obrigatório (contrato do CRM)
    if (!nome) {
      setError(nomeInput.closest(".field"));
      nomeInput.focus();
      return; // não dispara o fetch
    }

    // payload — contrato da Edge Function (telefone só com dígitos)
    const payload = {
      name: nome,
      phone: phoneDigits,
      services: servicos,
      message: "",
      website: honeypot ? honeypot.value : "", // honeypot anti-bot
    };

    submitBtn.disabled = true;
    const originalLabel = submitLabel.textContent;
    submitLabel.textContent = "Enviando...";

    try {
      const res = await fetch(CRM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: CRM_ANON_KEY,
          Authorization: "Bearer " + CRM_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });

      // Regra do contrato: se o JSON tiver a chave "error", é falha.
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok || (data && data.error)) {
        throw new Error(data.error || "HTTP " + res.status);
      }

      setStatus("Contato enviado! Retornamos pelo WhatsApp em breve. ✅", "is-ok");
      form.reset();
      submitLabel.textContent = "Enviado";
      setTimeout(closeModal, 1800);
    } catch (err) {
      console.error("Falha ao enviar contato:", err);
      setStatus(
        "Não foi possível enviar agora. Tente novamente em instantes.",
        "is-err"
      );
      submitLabel.textContent = originalLabel;
    } finally {
      submitBtn.disabled = false;
      if (submitLabel.textContent === "Enviando...") submitLabel.textContent = originalLabel;
    }
  });
})();
