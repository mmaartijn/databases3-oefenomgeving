// Valideert alle topic-bestanden: node scripts/validate.mjs [topicId]
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js", "db3.js"), "utf8"), ctx);

const only = process.argv[2];
const dir = path.join(root, "data", "topics");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js") && (!only || f === `${only}.js`));
let errors = 0;
const err = (id, msg) => { errors++; console.error(`  ✗ [${id}] ${msg}`); };

for (const f of files) {
  try {
    vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), ctx, { filename: f });
  } catch (e) {
    err(f, `Syntaxfout / runtimefout: ${e.message}`);
  }
}

const str = (v) => typeof v === "string" && v.trim().length > 0;
for (const t of ctx.DB3.topics) {
  const id = t.id;
  if (!ctx.DB3.catalog.find((c) => c.id === id)) err(id, "id staat niet in DB3.catalog");
  if (!str(t.intro)) err(id, "intro ontbreekt");
  if (!Array.isArray(t.sections) || t.sections.length < 3) err(id, "minimaal 3 sections");
  (t.sections || []).forEach((s, i) => { if (!str(s.title) || !str(s.body)) err(id, `section ${i} mist title/body`); });
  if (!Array.isArray(t.keyPoints) || t.keyPoints.length < 5) err(id, "minimaal 5 keyPoints");
  if (!Array.isArray(t.pitfalls) || t.pitfalls.length < 4) err(id, "minimaal 4 pitfalls");
  (t.pitfalls || []).forEach((p, i) => { if (!str(p.wrong) || !str(p.right)) err(id, `pitfall ${i} mist wrong/right`); });
  if (!Array.isArray(t.flashcards) || t.flashcards.length < 8) err(id, "minimaal 8 flashcards");
  (t.flashcards || []).forEach((c, i) => { if (!str(c.front) || !str(c.back)) err(id, `flashcard ${i} mist front/back`); });
  if (!Array.isArray(t.quiz) || t.quiz.length < 10) err(id, "minimaal 10 quizvragen");
  (t.quiz || []).forEach((q, i) => {
    if (!str(q.q)) err(id, `quiz ${i}: q ontbreekt`);
    if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(str)) err(id, `quiz ${i}: precies 4 niet-lege options nodig`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) err(id, `quiz ${i}: answer moet 0-3 zijn`);
    if (!str(q.explain)) err(id, `quiz ${i}: explain ontbreekt`);
    if (q.code !== undefined && !str(q.code)) err(id, `quiz ${i}: code is leeg`);
    if (new Set(q.options || []).size !== (q.options || []).length) err(id, `quiz ${i}: dubbele options`);
  });
  const dist = [0, 0, 0, 0];
  (t.quiz || []).forEach((q) => dist[q.answer]++);
  console.log(`✓ ${id.padEnd(13)} sections:${t.sections?.length} keyPoints:${t.keyPoints?.length} pitfalls:${t.pitfalls?.length} flashcards:${t.flashcards?.length} quiz:${t.quiz?.length} answerDist:${dist.join("/")}`);
}

console.log(`\n${ctx.DB3.topics.length} topics geladen, ${errors} fout(en).`);
process.exit(errors ? 1 : 0);
