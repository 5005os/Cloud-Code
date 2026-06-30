/* ============ AI KYRGYZSTAN — логика приложения ============ */
(function () {
  "use strict";

  const K = window.KNOWLEDGE || {};

  // ---------------------------------------------------------------
  // 1. РЕНДЕР РАЗДЕЛОВ ИЗ БАЗЫ ЗНАНИЙ
  // ---------------------------------------------------------------
  function renderHistory() {
    const el = document.getElementById("timeline");
    if (!el || !K.history) return;
    el.innerHTML = K.history.map(h => `
      <div class="tl-item">
        <div class="tl-period">${h.period}</div>
        <div class="tl-title">${h.title}</div>
        <div class="tl-text">${h.text}</div>
      </div>`).join("");
  }

  function renderForecasts() {
    const el = document.getElementById("forecastCards");
    if (!el || !K.forecasts) return;
    el.innerHTML = K.forecasts.map(f => `
      <div class="fcard">
        <div class="icon">${f.icon}</div>
        <div class="cat">${f.category}</div>
        <h3>${f.title}</h3>
        <p>${f.text}</p>
        <span class="horizon">📅 ${f.horizon}</span>
      </div>`).join("");
  }

  function renderSources() {
    const el = document.getElementById("sourcesGrid");
    if (!el || !K.sources) return;
    el.innerHTML = K.sources.map(s => `
      <a class="source-item" href="${s.url}" target="_blank" rel="noopener">
        <span class="stype">${s.type}</span>
        <span class="sname">${s.name}</span>
        <span class="surl">${s.url.replace(/^https?:\/\//, "")}</span>
      </a>`).join("");
  }

  // ---------------------------------------------------------------
  // 2. ОФЛАЙН-ИИ: поиск ответа в базе знаний
  // ---------------------------------------------------------------
  function offlineAnswer(question) {
    const q = question.toLowerCase();

    // Поиск по парам «вопрос-ответ»
    for (const item of (K.qa || [])) {
      if (item.keys.some(key => q.includes(key))) return item.answer;
    }

    // История по ключевым словам
    if (q.includes("истори") || q.includes("кратко")) {
      const top = (K.history || []).slice(0, 5)
        .map(h => `• ${h.period} — ${h.title}`).join("\n");
      return "Краткая история Кыргызстана:\n" + top + "\n\nСпросите про конкретный период подробнее.";
    }

    // Прогнозы
    if (q.includes("прогноз") || q.includes("будущ") || q.includes("развит")) {
      const top = (K.forecasts || []).slice(0, 4)
        .map(f => `${f.icon} ${f.title} (${f.horizon}): ${f.text}`).join("\n\n");
      return "Прогнозы развития Кыргызстана:\n\n" + top;
    }

    // Общие факты
    if (q.includes("факт") || q.includes("расскажи о") || q.includes("о кыргызстан")) {
      const f = K.facts || {};
      return `Кыргызстан — страна в Центральной Азии.\n` +
        `🏙️ Столица: ${f.capital}\n👥 Население: ${f.population}\n` +
        `📐 Площадь: ${f.area}\n🗣️ Языки: ${f.languages}\n` +
        `💵 Валюта: ${f.currency}\n🎉 Независимость: ${f.independence}\n` +
        `🏔️ Высшая точка: ${f.highestPoint}`;
    }

    // Приветствия
    if (q.includes("салам") || q.includes("привет") || q.includes("здрав") || q.includes("ассалам")) {
      return "Салам! 👋 Рад помочь. Спросите меня про историю, географию, прогнозы или культуру Кыргызстана.";
    }

    return "Я пока знаю ограниченный набор тем (история, Иссык-Куль, Манас, экономика, прогнозы Кыргызстана). " +
      "Попробуйте переформулировать вопрос или спросите про одну из этих тем.";
  }

  // ---------------------------------------------------------------
  // 3. ОНЛАЙН-ИИ: запрос к Claude API (если есть ключ)
  // ---------------------------------------------------------------
  async function onlineAnswer(question) {
    const key = localStorage.getItem("aikg_api_key");
    if (!key) return null;

    const systemPrompt =
      "Ты — национальный ИИ-ассистент Кыргызстана. Отвечай точно, дружелюбно, " +
      "на русском или кыргызском языке (как спросили). Специализируешься на истории, " +
      "географии, культуре, экономике и прогнозах развития Кыргызстана.";

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
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: question }]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error("API " + res.status + ": " + err.slice(0, 200));
    }
    const data = await res.json();
    return (data.content && data.content[0] && data.content[0].text) || "(пустой ответ)";
  }

  // ---------------------------------------------------------------
  // 4. ИНТЕРФЕЙС ЧАТА
  // ---------------------------------------------------------------
  const chatWindow = document.getElementById("chatWindow");
  const chatForm = document.getElementById("chatForm");
  const chatText = document.getElementById("chatText");

  function addMessage(text, who) {
    const msg = document.createElement("div");
    msg.className = "msg " + who;
    msg.innerHTML =
      `<div class="avatar">${who === "user" ? "Вы" : "AI"}</div>` +
      `<div class="bubble"></div>`;
    msg.querySelector(".bubble").textContent = text;
    chatWindow.appendChild(msg);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return msg;
  }

  function addTyping() {
    const msg = document.createElement("div");
    msg.className = "msg bot";
    msg.innerHTML = `<div class="avatar">AI</div><div class="bubble typing">печатает…</div>`;
    chatWindow.appendChild(msg);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return msg;
  }

  // ---- Бесплатный ИИ без ключа (отвечает на любые вопросы) ----
  const SYSTEM_PROMPT =
    "Ты — AkylAi, дружелюбный и умный ассистент. Отвечай понятно и по делу на языке " +
    "пользователя (русский или кыргызский). Помогай с любыми вопросами.";
  const convo = []; // история диалога для контекста

  async function askFreeAI(question) {
    const messages = [{ role: "system", content: SYSTEM_PROMPT }]
      .concat(convo, [{ role: "user", content: question }]);
    const res = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "openai", messages: messages })
    });
    if (!res.ok) throw new Error("сервис занят (" + res.status + ")");
    const data = await res.json();
    const m = data && data.choices && data.choices[0] && data.choices[0].message;
    const answer = (m && m.content || "").trim();
    if (!answer) throw new Error("пустой ответ");
    convo.push({ role: "user", content: question });
    convo.push({ role: "assistant", content: answer });
    return answer;
  }

  async function handleAsk(question) {
    addMessage(question, "user");
    const typing = addTyping();
    try {
      let answer;
      try {
        // основной режим — бесплатный ИИ (отвечает на всё)
        answer = await askFreeAI(question);
      } catch (e) {
        // если интернет/сервис недоступен — отвечаем из встроенной базы знаний
        answer = offlineAnswer(question);
      }
      typing.remove();
      addMessage(answer, "bot");
    } catch (e) {
      typing.remove();
      addMessage("Произошла ошибка: " + e.message, "bot");
    }
  }

  if (chatForm) {
    chatForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const q = chatText.value.trim();
      if (!q) return;
      chatText.value = "";
      handleAsk(q);
    });
  }

  // Кнопки-подсказки
  document.querySelectorAll("#suggestions button").forEach(btn => {
    btn.addEventListener("click", () => handleAsk(btn.textContent));
  });

  // ---------------------------------------------------------------
  // 5. СОХРАНЕНИЕ API-КЛЮЧА
  // ---------------------------------------------------------------
  const saveKeyBtn = document.getElementById("saveKey");
  const apiKeyInput = document.getElementById("apiKey");
  const keyStatus = document.getElementById("keyStatus");

  function refreshKeyStatus() {
    if (!keyStatus) return;
    const has = !!localStorage.getItem("aikg_api_key");
    keyStatus.textContent = has ? "✅ Ключ сохранён" : "";
    keyStatus.style.color = "var(--red)";
  }

  if (saveKeyBtn) {
    saveKeyBtn.addEventListener("click", () => {
      const val = apiKeyInput.value.trim();
      if (val) {
        localStorage.setItem("aikg_api_key", val);
        apiKeyInput.value = "";
      } else {
        localStorage.removeItem("aikg_api_key");
      }
      refreshKeyStatus();
    });
  }

  // ---------------------------------------------------------------
  // ИНИЦИАЛИЗАЦИЯ
  // ---------------------------------------------------------------
  renderHistory();
  renderForecasts();
  renderSources();
  refreshKeyStatus();
})();
