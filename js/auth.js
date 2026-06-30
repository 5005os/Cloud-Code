/* ============ AI KYRGYZSTAN — вход по почте (Supabase) ============
 * Если SUPABASE_URL / SUPABASE_ANON_KEY не заданы в config.js —
 * вход выключен, чат открыт всем. Как только заполнишь — включается
 * обязательная регистрация/вход по почте с кодом.
 */
(function () {
  "use strict";

  const CFG = window.AIKG_CONFIG || {};
  const gate = document.getElementById("authGate");
  const logoutBtn = document.getElementById("logoutBtn");

  const stepEmail = document.getElementById("stepEmail");
  const stepCode = document.getElementById("stepCode");
  const emailInput = document.getElementById("authEmail");
  const codeInput = document.getElementById("authCode");
  const sendCodeBtn = document.getElementById("sendCode");
  const verifyBtn = document.getElementById("verifyCode");
  const backBtn = document.getElementById("backEmail");
  const emailShown = document.getElementById("emailShown");
  const msg = document.getElementById("authMsg");

  // ---- Вход выключен (нет настроек) → чат открыт всем ----
  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || !window.supabase) {
    if (gate) gate.hidden = true;
    return;
  }

  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  let currentEmail = "";

  function showGate(show) {
    gate.hidden = !show;
    logoutBtn.hidden = show; // кнопка «Выйти» видна только когда вошёл
  }

  function setMsg(text, ok) {
    msg.textContent = text || "";
    msg.style.color = ok ? "#1a9e54" : "var(--red)";
  }

  // Проверяем, вошёл ли уже пользователь
  sb.auth.getSession().then(({ data }) => {
    showGate(!(data && data.session));
  });

  // Реакция на вход/выход
  sb.auth.onAuthStateChange((_event, session) => {
    showGate(!session);
  });

  // ---- Шаг 1: отправить код на почту ----
  sendCodeBtn.addEventListener("click", async () => {
    const email = (emailInput.value || "").trim();
    if (!email || !email.includes("@")) { setMsg("Введите правильную почту."); return; }
    sendCodeBtn.disabled = true; setMsg("Отправляю код…", true);
    try {
      const { error } = await sb.auth.signInWithOtp({
        email: email,
        options: { shouldCreateUser: true } // регистрация при первом входе
      });
      if (error) throw error;
      currentEmail = email;
      emailShown.textContent = email;
      stepEmail.hidden = true;
      stepCode.hidden = false;
      setMsg("Код отправлен! Проверьте почту.", true);
    } catch (e) {
      setMsg("Ошибка: " + (e.message || e));
    } finally {
      sendCodeBtn.disabled = false;
    }
  });

  // ---- Шаг 2: проверить код ----
  verifyBtn.addEventListener("click", async () => {
    const token = (codeInput.value || "").trim();
    if (!token) { setMsg("Введите код из письма."); return; }
    verifyBtn.disabled = true; setMsg("Проверяю код…", true);
    try {
      const { error } = await sb.auth.verifyOtp({
        email: currentEmail,
        token: token,
        type: "email"
      });
      if (error) throw error;
      setMsg("");
      // onAuthStateChange сам закроет окно входа
    } catch (e) {
      setMsg("Неверный код. Попробуйте ещё раз.");
    } finally {
      verifyBtn.disabled = false;
    }
  });

  backBtn.addEventListener("click", () => {
    stepCode.hidden = true; stepEmail.hidden = false;
    codeInput.value = ""; setMsg("");
  });

  // Enter в полях
  emailInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendCodeBtn.click(); });
  codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") verifyBtn.click(); });

  // ---- Выход ----
  logoutBtn.addEventListener("click", async () => {
    await sb.auth.signOut();
    stepCode.hidden = true; stepEmail.hidden = false;
    emailInput.value = ""; codeInput.value = ""; setMsg("");
  });
})();
