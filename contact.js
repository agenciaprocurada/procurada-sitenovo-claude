/* ===========================================================
   PROCURADA — Modal de contato
   Abre via [data-contact-open], mascara o WhatsApp no input
   e envia apenas dígitos para a função serverless (Resend + n8n).
   =========================================================== */
(function () {
  "use strict";

  // Endpoint serverless (Vercel). Relativo = mesmo domínio do site.
  // Se o site ficar em outro host (ex.: GitHub Pages), troque pela URL
  // absoluta do deploy no Vercel: "https://seu-projeto.vercel.app/api/orcamento".
  const WEBHOOK_URL = "/api/orcamento";

  const modal = document.getElementById("contact-modal");
  const form = document.getElementById("contact-form");
  if (!modal || !form) return;

  const panel = modal.querySelector(".modal__panel");
  const nomeInput = form.elements["nome"];
  const phoneInput = form.elements["cf-whatsapp"] || document.getElementById("cf-whatsapp");
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

    // validação
    let ok = true;
    if (!nome) { setError(nomeInput.closest(".field")); ok = false; }
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setError(phoneInput.closest(".field")); ok = false;
    }
    if (servicos.length === 0) {
      setError(form.querySelector(".field--services")); ok = false;
    }
    if (!ok) return;

    // payload — telefone apenas com números
    const payload = {
      nome: nome,
      whatsapp: phoneDigits,
      servicos: servicos,
      origem: "procurada-landing",
      enviado_em: new Date().toISOString(),
    };

    submitBtn.disabled = true;
    const originalLabel = submitLabel.textContent;
    submitLabel.textContent = "Enviando...";

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);

      setStatus("Recebemos seu contato! Em breve falamos pelo WhatsApp. ✅", "is-ok");
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
