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
      if (item.keys.some(key => q.includes(key))) { lastTopic = item; return item.answer; }
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

    // Ничего не нашли в базе — вернём null, чтобы подключился Qwen (запасной мозг)
    return null;
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

  // ---- Память диалога ----
  let lastArticle = null;   // последняя обсуждаемая статья УК
  let lastTopic = null;     // последняя обсуждаемая тема (item из базы знаний)

  // ---- Долгая память: сохраняем историю чата в браузере (переживает перезагрузку) ----
  const HISTORY_KEY = "akylai_history";
  const HISTORY_LIMIT = 200; // максимум сообщений в памяти

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function persistMessage(text, who) {
    const h = loadHistory();
    h.push({ text: text, who: who });
    while (h.length > HISTORY_LIMIT) h.shift();
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch (e) {}
  }
  function clearHistory() {
    try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
    lastArticle = null;
    lastTopic = null;
  }

  // ---- Память имени пользователя (обращаемся по имени) ----
  const NAME_KEY = "akylai_username";
  function getUserName() {
    try { return localStorage.getItem(NAME_KEY) || null; } catch (e) { return null; }
  }
  function setUserName(n) {
    try { localStorage.setItem(NAME_KEY, n); } catch (e) {}
  }
  function forgetUserName() {
    try { localStorage.removeItem(NAME_KEY); } catch (e) {}
  }

  // Распознаём знакомство и вопрос «как меня зовут»
  function nameMemory(question) {
    const q = question.trim();
    // Сначала — вопрос об имени («как меня зовут», «менин атым ким»)
    if (/(как меня зовут|мо[её] имя\??$|помн.*(им[яею])|менин атым ким)/i.test(q)) {
      const n = getUserName();
      return n
        ? "Конечно помню — вас зовут " + n + ". 🙂"
        : "Пока не знаю вашего имени. Напишите «меня зовут …» — и я запомню.";
    }
    // Затем — знакомство: «меня зовут Айбек», «моё имя Айбек», «менин атым Айбек»
    const m = q.match(/(?:меня зовут|мо[её] имя|менин атым|мени)\s+([A-Za-zА-Яа-яЁёҢңӨөҮүІі]{2,20})/i);
    if (m) {
      const raw = m[1];
      // «ким», «кто» — это вопросительные слова, а не имя
      if (/^(ким|кто|эмне)$/i.test(raw)) {
        const n = getUserName();
        return n ? "Вас зовут " + n + ". 🙂" : "Пока не знаю вашего имени. Напишите «меня зовут …» — запомню.";
      }
      const name = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      setUserName(name);
      return "Абдан жакшы, " + name + "! 😊 (Приятно познакомиться!) Буду обращаться по имени. Чем помочь?";
    }
    return null;
  }
  // Восстановить прошлый диалог при загрузке страницы
  function restoreHistory() {
    const h = loadHistory();
    if (!h.length || !chatWindow) return;
    h.forEach(function (m) { addMessage(m.text, m.who); });
  }

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
    if (!num) {
      // Нет статьи — но помним последнюю тему разговора
      if (lastTopic) return "Напомню по теме:\n\n" + lastTopic.answer +
        "\n\nЕсли нужно про конкретную статью УК — напишите её номер (например «122»).";
      return "О чём подробнее? 🙂 Сначала спросите про статью или тему, потом напишите «подробнее».";
    }
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
    if (/(^|\s)(салам|ассалам|привет|здравств|саламатсыз)/.test(q)) {
      const nm = getUserName();
      const hi = nm ? "Салам, " + nm + "! 👋 " : "Салам! 👋 ";
      return hi + "Мен AkylAi — кыргыз ассистентмин. Спросите про статью УК, кыргызский язык, ПДД, историю или Конституцию КР. Чем помочь?";
    }
    if (/(рахмат|спасибо|чоң рахмат)/.test(q))
      return "Арзыбайт! 😊 (Не за что!) Обращайтесь ещё — рад помочь.";
    if (/(как дела|как ты|как настроение|кандайсы|кандайсыз)/.test(q))
      return "Жакшы, рахмат! 😊 Я готов помочь. О чём расскажу?";
    if (/(кто ты|ты кто|сен ким|что ты такое|тво[её] имя|как теб[яе] зов|как т[яе] зов|как т[яе] зав|как звать|как теб[яе] звать|атың ким|сенин ат)/.test(q))
      return "Мени AkylAi деп аташат. 🇰🇬 (Меня зовут AkylAi.) Я кыргызский ИИ-ассистент. Отвечаю по своей базе: статьи УК КР, кыргызский язык, ПДД, Конституция, история, культура и туризм Кыргызстана.";
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
    "- НИКОГДА не выдумывай номера статей законов. Если не знаешь точную статью КР — скажи: «уточните, я отвечу по базе».\n" +
    "Надёжный кыргызский разговорник (используй его):\n" +
    "Салам / Саламатсызбы — Здравствуйте; Кандайсың? / Кандайсызбы? — Как дела?; " +
    "Жакшы — хорошо; Рахмат — спасибо; Чоң рахмат — большое спасибо; " +
    "Кечиресиз — извините; Ооба — да; Жок — нет; Кош болуңуз — до свидания; " +
    "Менин атым… — Меня зовут…; Сиздин атыңыз ким? — Как вас зовут?; " +
    "Сабаа — нет (разг.); Сурап коёюнчу — позвольте спросить.\n" +
    "Сандар (числа): бир(1), эки(2), үч(3), төрт(4), беш(5), алты(6), жети(7), сегиз(8), тогуз(9), он(10).\n" +
    "Отвечай дружелюбно и понятно.";
  const DEFAULT_AI_MODEL = "openai"; // модель по умолчанию (запасной мозг)
  const convo = []; // история диалога для контекста

  // Какая модель выбрана в списке на странице
  function selectedModel() {
    const el = document.getElementById("modelSelect");
    return (el && el.value) || DEFAULT_AI_MODEL;
  }

  // Один запрос к конкретной модели
  async function callModel(model, messages) {
    const res = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: model, messages: messages, referrer: "akylai" })
    });
    if (!res.ok) throw new Error("сервис занят (" + res.status + ")");
    const data = await res.json();
    const m = data && data.choices && data.choices[0] && data.choices[0].message;
    const answer = (m && m.content || "").trim();
    if (!answer) throw new Error("пустой ответ");
    return answer;
  }

  async function askFreeAI(question) {
    // последние 6 реплик как контекст (чтобы модель помнила разговор, но не перегружать)
    const recent = convo.slice(-6);
    const messages = [{ role: "system", content: SYSTEM_PROMPT }]
      .concat(recent, [{ role: "user", content: question }]);

    // Пробуем выбранную модель, затем надёжные запасные — чтобы ответ был всегда
    const tryModels = [selectedModel(), "openai", "mistral"]
      .filter(function (v, i, a) { return a.indexOf(v) === i; });

    let lastErr = "нет ответа";
    for (const model of tryModels) {
      try {
        const answer = await callModel(model, messages);
        convo.push({ role: "user", content: question });
        convo.push({ role: "assistant", content: answer });
        return answer;
      } catch (e) {
        lastErr = e.message;
      }
    }
    throw new Error(lastErr);
  }

  // Команда очистки памяти: «забудь», «очисти историю», «начни заново»
  function isClearCommand(question) {
    return /(забудь( всё| все)?|очисти( историю| чат)?|начни заново|стереть историю|clear)/.test(question.toLowerCase().trim());
  }

  async function handleAsk(question) {
    addMessage(question, "user");
    persistMessage(question, "user");

    // Очистка истории по просьбе пользователя
    if (isClearCommand(question)) {
      clearHistory();
      forgetUserName();
      const bye = "Готово — историю и имя очистил. Начинаем с чистого листа. 🙂";
      addMessage(bye, "bot");
      // после очистки заново сохраняем только это подтверждение
      persistMessage(question, "user");
      persistMessage(bye, "bot");
      return;
    }

    const typing = addTyping();
    try {
      // 1) Сначала — точная база проекта (законы КР, факты, память). Это приоритет.
      await new Promise(function (r) { setTimeout(r, 200); });
      let answer = nameMemory(question) || detailRequest(question) || lookupLaw(question) || smallTalk(question) || offlineAnswer(question);

      // 2) Если в базе ответа нет — подключаем Qwen (запасной мозг для свободных вопросов).
      if (!answer) {
        try {
          answer = await askFreeAI(question);
        } catch (e) {
          answer = "Я отвечаю по своей базе (законы КР, кыргызский язык, ПДД, Конституция, история, культура, туризм). " +
            "Сейчас не смог подключить модель «" + selectedModel() + "» для свободного ответа (" + e.message + "). " +
            "Попробуйте ещё раз, выберите другую модель или спросите по этим темам.";
        }
      }

      typing.remove();
      addMessage(answer, "bot");
      persistMessage(answer, "bot");
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
  // Запоминаем выбранную модель между визитами
  (function initModelSelect() {
    const el = document.getElementById("modelSelect");
    if (!el) return;
    const saved = localStorage.getItem("akylai_model");
    if (saved) {
      const ok = Array.prototype.some.call(el.options, function (o) { return o.value === saved; });
      if (ok) el.value = saved;
    }
    el.addEventListener("change", function () {
      try { localStorage.setItem("akylai_model", el.value); } catch (e) {}
    });
  })();

  renderHistory();
  renderForecasts();
  renderSources();
  refreshKeyStatus();
  restoreHistory(); // вернуть прошлый диалог (память между визитами)
})();
