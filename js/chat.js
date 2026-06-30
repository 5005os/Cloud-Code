/* ============ AI KYRGYZSTAN — универсальный чат ============ */
(function () {
  "use strict";

  // ---------- Хранилище настроек ----------
  const LS_KEY = "aikg_api_key";          // ключ выбранного провайдера
  const LS_PROVIDER = "aikg_provider";    // 'gemini' | 'claude'
  const getKey = () => localStorage.getItem(LS_KEY) || "";
  const getProvider = () => localStorage.getItem(LS_PROVIDER) || "gemini";

  // куда идти за ключом
  const KEY_LINKS = {
    gemini: 'Получить <b>бесплатный</b> ключ (без карты): <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">нажмите здесь</a>',
    claude: 'Получить премиум-ключ (платно): <a href="https://console.anthropic.com" target="_blank" rel="noopener">нажмите здесь</a>'
  };

  // ---------- Системный промпт ----------
  const SYSTEM_PROMPT =
    "Ты — AI Kyrgyzstan, универсальный ИИ-ассистент. Отвечай на любые вопросы дружелюбно, " +
    "понятно и по делу, на языке пользователя (русский или кыргызский). " +
    "Ты — отличный программист и помогаешь писать код на любых языках и платформах: " +
    "Swift, SwiftUI, UIKit, HTML, CSS, JavaScript, Python и других. " +
    "Когда даёшь код — приводи рабочий, чистый, полный пример и оформляй его в Markdown-блок " +
    "с указанием языка (например ```swift, ```python, ```html). Кратко поясняй ключевые места.";

  // ---------- Элементы ----------
  const chat = document.getElementById("chat");
  const messagesEl = document.getElementById("messages");
  const welcome = document.getElementById("welcome");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("send");
  const hint = document.getElementById("hint");

  const modal = document.getElementById("settingsModal");
  const openSettings = document.getElementById("openSettings");
  const closeSettings = document.getElementById("closeSettings");
  const saveSettings = document.getElementById("saveSettings");
  const apiKeyInput = document.getElementById("apiKey");
  const providerSelect = document.getElementById("providerSelect");
  const getKeyLink = document.getElementById("getKeyLink");
  const modalStatus = document.getElementById("modalStatus");
  const newChatBtn = document.getElementById("newChat");

  // история диалога: [{role:'user'|'assistant', content}]
  let history = [];

  if (window.marked) marked.setOptions({ breaks: true, gfm: true });

  // ---------- UI утилиты ----------
  function refreshHint() { hint.style.display = getKey() ? "none" : "block"; }
  function hideWelcome() { if (welcome) welcome.style.display = "none"; }
  function scrollDown() { chat.scrollTop = chat.scrollHeight; }
  function autoGrow() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 200) + "px"; }

  function enhanceCode(container) {
    container.querySelectorAll("pre > code").forEach((code) => {
      let lang = "code";
      code.classList.forEach((c) => { if (c.startsWith("language-")) lang = c.slice(9); });
      if (window.hljs) { try { hljs.highlightElement(code); } catch (e) {} }
      const pre = code.parentElement;
      const wrap = document.createElement("div");
      wrap.className = "code-wrap";
      const head = document.createElement("div");
      head.className = "code-head";
      head.innerHTML = '<span class="code-lang">' + lang + '</span>';
      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "Копировать";
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(code.textContent).then(() => {
          btn.textContent = "✓ Скопировано"; btn.classList.add("copied");
          setTimeout(() => { btn.textContent = "Копировать"; btn.classList.remove("copied"); }, 1500);
        });
      });
      head.appendChild(btn);
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(head); wrap.appendChild(pre);
    });
  }

  function addMessage(role, text) {
    hideWelcome();
    const msg = document.createElement("div");
    msg.className = "msg " + (role === "user" ? "user" : "bot");
    const avatar = document.createElement("div");
    avatar.className = "avatar"; avatar.textContent = role === "user" ? "Вы" : "AI";
    const body = document.createElement("div");
    body.className = "body";
    if (role === "user") body.textContent = text;
    else { body.innerHTML = window.marked ? marked.parse(text) : text; enhanceCode(body); }
    msg.appendChild(avatar); msg.appendChild(body);
    messagesEl.appendChild(msg); scrollDown();
    return body;
  }

  function addTyping() {
    hideWelcome();
    const msg = document.createElement("div");
    msg.className = "msg bot";
    msg.innerHTML = '<div class="avatar">AI</div><div class="body"><div class="typing"><span></span><span></span><span></span></div></div>';
    messagesEl.appendChild(msg); scrollDown();
    return msg;
  }

  // ---------- Провайдер: Google Gemini (бесплатно) ----------
  async function askGemini(key) {
    const model = "gemini-2.0-flash";
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
      model + ":generateContent?key=" + encodeURIComponent(key);

    const contents = history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: contents
      })
    });
    if (!res.ok) throw new Error("Gemini " + res.status + ": " + (await res.text()).slice(0, 300));
    const data = await res.json();
    const cand = data.candidates && data.candidates[0];
    return (cand && cand.content && cand.content.parts || [])
      .map((p) => p.text || "").join("").trim() || "(пустой ответ)";
  }

  // ---------- Провайдер: Claude (платно) ----------
  async function askClaude(key) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: history
      })
    });
    if (!res.ok) throw new Error("Claude " + res.status + ": " + (await res.text()).slice(0, 300));
    const data = await res.json();
    return (data.content || []).map((b) => b.text || "").join("").trim() || "(пустой ответ)";
  }

  async function askAI(userText) {
    history.push({ role: "user", content: userText });
    const key = getKey();
    const answer = getProvider() === "claude" ? await askClaude(key) : await askGemini(key);
    history.push({ role: "assistant", content: answer });
    return answer;
  }

  function offlineReply() {
    return "Чтобы я мог отвечать на любые вопросы и **писать код**, включите бесплатный режим в настройках ⚙️ вверху справа " +
      "и вставьте бесплатный ключ.";
  }

  // ---------- Отправка ----------
  let busy = false;
  async function handleSend(text) {
    if (busy || !text.trim()) return;
    busy = true; sendBtn.disabled = true;
    addMessage("user", text);
    input.value = ""; autoGrow();
    const typing = addTyping();
    try {
      let answer;
      if (getKey()) answer = await askAI(text);
      else { await new Promise((r) => setTimeout(r, 250)); answer = offlineReply(); }
      typing.remove(); addMessage("bot", answer);
    } catch (e) {
      typing.remove();
      addMessage("bot", "⚠️ Ошибка: " + e.message + "\n\nПроверьте ключ и выбранный провайдер в настройках ⚙️.");
    } finally {
      busy = false; sendBtn.disabled = false; input.focus();
    }
  }

  // ---------- События ----------
  form.addEventListener("submit", (e) => { e.preventDefault(); handleSend(input.value); });
  input.addEventListener("input", autoGrow);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(input.value); }
  });
  document.querySelectorAll("#welcome .chips button").forEach((b) => {
    b.addEventListener("click", () => handleSend(b.textContent));
  });
  newChatBtn.addEventListener("click", () => {
    history = []; messagesEl.innerHTML = "";
    if (welcome) welcome.style.display = ""; input.focus();
  });

  // ---------- Настройки ----------
  function updateKeyLink() { getKeyLink.innerHTML = KEY_LINKS[providerSelect.value] || ""; }
  function openModal() {
    apiKeyInput.value = "";
    providerSelect.value = getProvider();
    updateKeyLink();
    modalStatus.textContent = getKey() ? "✅ Ключ уже сохранён" : "";
    modal.hidden = false;
  }
  openSettings.addEventListener("click", openModal);
  closeSettings.addEventListener("click", () => { modal.hidden = true; });
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
  providerSelect.addEventListener("change", updateKeyLink);

  saveSettings.addEventListener("click", () => {
    localStorage.setItem(LS_PROVIDER, providerSelect.value);
    const val = apiKeyInput.value.trim();
    if (val) localStorage.setItem(LS_KEY, val);
    modalStatus.textContent = "✅ Сохранено!";
    refreshHint();
    setTimeout(() => { modal.hidden = true; }, 700);
  });

  // ---------- Старт ----------
  refreshHint(); autoGrow(); input.focus();
})();
