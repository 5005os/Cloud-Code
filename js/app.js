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
  // ---- Память диалога: последняя обсуждаемая статья ----
  let lastArticle = null;

  // ---- Точный поиск статьи Уголовного кодекса КР ----
  function formatLaw(num) {
    return "📘 Статья " + num + " Уголовного кодекса Кыргызской Республики:\n\n" +
      window.LAWS_UK_KR[num] + "\n\n(Источник: УК КР, 2021 г.)";
  }
  // ---- Запрос подробностей: «подробнее», «все пункты», «статья 122 подробнее» ----
  function detailRequest(question) {
    const q = question.toLowerCase().trim();
    const wantsDetail = /(подробн|все пункт|всё пункт|полн|детал|по частям|весь текст|дальше|больше|ещё|еще)/.test(q);
    if (!wantsDetail) return null;
    const m = question.match(/\b(\d{1,3})(-\d)?\b/);
    const num = m ? m[1] : lastArticle;
    if (!num) return "О чём подробнее? 🙂 Сначала спросите про статью или тему, потом напишите «подробнее».";
    lastArticle = num;
    if (window.LAWS_FULL && window.LAWS_FULL[num])
      return "📖 Статья " + num + " — подробно:\n\n" + window.LAWS_FULL[num] + "\n\n(Источник: УК КР, 2021 г.)";
    if (window.LAWS_UK_KR && window.LAWS_UK_KR[num])
      return formatLaw(num) + "\n\nПолного текста по частям пока нет в базе — могу добавить, если пришлёте.";
    return "По статье " + num + " пока нет данных в базе. Пришлите текст — добавлю. 🙂";
  }

  function lookupLaw(question) {
    const laws = window.LAWS_UK_KR;
    if (!laws) return null;
    const q = question.toLowerCase();
    const isLaw = /(стать|ук|уголовн|кодекс|наказан|преступл)/.test(q);
    const bare = question.trim().match(/^(\d{1,3})(-\d)?$/); // просто «122»

    // 1) по номеру статьи ("122", "статья 122", "122 статья")
    const m = question.match(/\b(\d{1,3})(-\d)?\b/);
    if (bare || (m && isLaw)) {
      const num = bare ? bare[1] : m[1];
      if (laws[num]) { lastArticle = num; return formatLaw(num) + "\n\n💡 Напишите «подробнее» — покажу полный текст."; }
      return "В базе AkylAi пока нет статьи " + num + " УК КР. Пришлите её текст — добавлю точно. 🙂";
    }

    // 2) по названию преступления ("убийство какая статья")
    const idx = window.LAWS_INDEX || {};
    for (const kw in idx) {
      if (q.includes(kw)) {
        const num = idx[kw];
        if (laws[num]) { lastArticle = num; return "Это статья " + num + " УК КР.\n\n" + formatLaw(num) + "\n\n💡 Напишите «подробнее» — покажу полный текст."; }
      }
    }
    return null;
  }

  // ---- Живое общение (приветствие, благодарность, кто ты) ----
  function smallTalk(question) {
    const q = question.toLowerCase().trim();
    if (/(^|\s)(салам|ассалам|привет|здравств|саламатсыз)/.test(q))
      return "Салам! 👋 Мен AkylAi — кыргыз ассистентмин. Спросите про статью УК, кыргызский язык, ПДД, историю или Конституцию КР. Чем помочь?";
    if (/(рахмат|спасибо|чоң рахмат)/.test(q))
      return "Арзыбайт! 😊 (Не за что!) Обращайтесь ещё — рад помочь.";
    if (/(как дела|кандайсы|кандайсыз)/.test(q))
      return "Жакшы, рахмат! 😊 Я готов помочь. О чём расскажу?";
    if (/(кто ты|ты кто|сен ким|что ты такое|твоё имя|твое имя)/.test(q))
      return "Я AkylAi 🇰🇬 — кыргызский ИИ-ассистент. Отвечаю по своей базе: статьи Уголовного кодекса КР, кыргызский язык, ПДД, Конституция, история и культура Кыргызстана.";
    if (/(что умеешь|что можешь|чем поможешь|помоги|что знаешь)/.test(q))
      return "Я умею:\n• ⚖️ Статьи УК КР (например: «статья 122», «убийство какая статья»)\n• 🇰🇬 Кыргызский язык (переводы, слова, грамматика)\n• 🚦 ПДД Кыргызстана\n• 🏛️ Конституция и госустройство\n• 📜 История и культура КР\nСпросите что-нибудь!";
    if (/(пока|до свидан|кош бол)/.test(q))
      return "Кош болуңуз! 👋 Хорошего дня!";
    return null;
  }

  const SYSTEM_PROMPT =
    "Ты — AkylAi, дружелюбный кыргызский ИИ-ассистент Кыргызстана (КР). " +
    "ВАЖНО: на вопросы о законах, кодексах и статьях отвечай ТОЛЬКО про Кыргызскую Республику (КР), " +
    "никогда про Россию (РФ) или другие страны. Если не знаешь точного текста статьи КР — честно скажи об этом. " +
    "Ты хорошо знаешь кыргызский язык. " +
    "Правила:\n" +
    "- Если пользователь пишет на кыргызском — отвечай на кыргызском.\n" +
    "- Если пишет на русском — отвечай на русском, но при просьбе переводи и учи кыргызскому.\n" +
    "- Помогай переводить русский ⇄ кыргызский и объясняй кыргызские слова и грамматику.\n" +
    "- Будь точным: не выдумывай кыргызские слова, если не уверен — скажи об этом.\n" +
    "Надёжный кыргызский разговорник (используй его):\n" +
    "Салам / Саламатсызбы — Здравствуйте; Кандайсың? / Кандайсызбы? — Как дела?; " +
    "Жакшы — хорошо; Рахмат — спасибо; Чоң рахмат — большое спасибо; " +
    "Кечиресиз — извините; Ооба — да; Жок — нет; Кош болуңуз — до свидания; " +
    "Менин атым… — Меня зовут…; Сиздин атыңыз ким? — Как вас зовут?; " +
    "Сабаа — нет (разг.); Сурап коёюнчу — позвольте спросить.\n" +
    "Сандар (числа): бир(1), эки(2), үч(3), төрт(4), беш(5), алты(6), жети(7), сегиз(8), тогуз(9), он(10).\n" +
    "Отвечай дружелюбно и понятно.";
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
      // AkylAi отвечает ТОЛЬКО из базы знаний проекта (без внешнего ИИ).
      await new Promise(function (r) { setTimeout(r, 250); });
      let answer = detailRequest(question) || lookupLaw(question) || smallTalk(question) || offlineAnswer(question);
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
