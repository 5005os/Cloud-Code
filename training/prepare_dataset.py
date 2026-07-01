#!/usr/bin/env python3
"""
AkylAi — сборка единого обучающего датасета.
Собирает все файлы из папки dataset/ в один файл training/akylai_dataset.jsonl
в формате instruction/input/output (alpaca-style).

Запуск:  python training/prepare_dataset.py
"""
import json, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET = os.path.join(ROOT, "dataset")
OUT = os.path.join(ROOT, "training", "akylai_dataset.jsonl")

rows = []

def add(instruction, output, inp=""):
    instruction = (instruction or "").strip()
    output = (output or "").strip()
    if instruction and output:
        rows.append({"instruction": instruction, "input": inp, "output": output})

def load_json(name):
    p = os.path.join(DATASET, name)
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)

def load_jsonl(name):
    p = os.path.join(DATASET, name)
    if not os.path.exists(p):
        return []
    out = []
    with open(p, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out

# 1) Готовые instruction/output JSONL
for name in ["qa.jsonl", "law_qa.jsonl", "traffic_rules.jsonl",
             "traffic_rules_ky.jsonl", "pdd_exam.jsonl", "pdd_top50.jsonl",
             "criminal_code_kr.jsonl", "tourism.jsonl", "culture.jsonl",
             "kyrgyzstan_facts.jsonl", "bishkek_places.jsonl"]:
    for r in load_jsonl(name):
        add(r.get("instruction"), r.get("output"), r.get("input", ""))

# 2) Переводы
tr = load_json("translations.json") or []
for r in tr:
    ru, ky = r.get("ru"), r.get("ky")
    if ru and ky:
        add(f"Переведи на кыргызский: «{ru}»", ky)
        add(f"Что значит по-русски «{ky}»?", ru)

# 3) Пословицы
for r in (load_json("proverbs.json") or []):
    if r.get("ky") and r.get("ru"):
        add("Скажи кыргызскую пословицу и её перевод.", f"{r['ky']} — {r['ru']}")
        add(f"Переведи пословицу: «{r['ky']}»", r["ru"])

# 4) Глаголы
for r in (load_json("verbs.json") or []):
    inf, ru = r.get("infinitive"), r.get("ru")
    pres = r.get("present", {})
    if inf and pres:
        forms = ", ".join(f"{k} {v}" for k, v in pres.items())
        add(f"Проспрягай глагол «{inf}» ({ru}) в настоящем времени.", forms)
    past = r.get("past", {})
    if inf and past:
        forms = ", ".join(f"{k} {v}" for k, v in past.items())
        add(f"Проспрягай глагол «{inf}» ({ru}) в прошедшем времени.", forms)

# 5) Диалоги
for d in (load_json("dialogues.json") or []):
    for line in d.get("lines", []):
        if line.get("ru") and line.get("ky"):
            add(f"Переведи на кыргызский: «{line['ru']}»", line["ky"])

# 6) Тексты и статьи
for name in ["texts.json", "articles.json"]:
    for r in (load_json(name) or []):
        title, ky, ru = r.get("title"), r.get("ky"), r.get("ru")
        if title and ky:
            add(f"Расскажи на кыргызском: {title}", ky)
        if title and ru:
            add(f"Расскажи о теме: {title}", ru)

# 7) Конституция
const = load_json("constitution.json") or {}
for k, v in (const.get("facts") or {}).items():
    add(f"{k} (Конституция Кыргызстана)?", v)

# Запись
os.makedirs(os.path.dirname(OUT), exist_ok=True)
# убираем дубликаты
seen, uniq = set(), []
for r in rows:
    key = (r["instruction"], r["output"])
    if key not in seen:
        seen.add(key); uniq.append(r)

with open(OUT, "w", encoding="utf-8") as f:
    for r in uniq:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")

print(f"Готово! Собрано примеров: {len(uniq)}")
print(f"Файл: {OUT}")
