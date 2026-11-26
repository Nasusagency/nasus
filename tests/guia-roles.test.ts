import test from "node:test";
import assert from "node:assert/strict";
import { classifyVisitor, rolIA } from "@/lib/guia/classify";

test("agentes de usuario se distinguen de rastreadores de IA", () => {
  const user = classifyVisitor("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot");
  assert.equal(user.tipo, "agente_ia");
  assert.equal(rolIA(user.tipo, user.agente), "agente_usuario");

  const crawler = classifyVisitor("Mozilla/5.0 AppleWebKit/537.36; compatible; GPTBot/1.2; +https://openai.com/gptbot");
  assert.equal(rolIA(crawler.tipo, crawler.agente), "rastreador_ia");

  const search = classifyVisitor("Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)");
  assert.equal(rolIA(search.tipo, search.agente), "rastreador_ia");
});

test("GoogleOther ya no cuenta como agente de IA y los navegadores no tienen rol de IA", () => {
  const g = classifyVisitor("Mozilla/5.0 (compatible; GoogleOther)");
  assert.equal(g.tipo, "buscador");
  assert.equal(rolIA(g.tipo, g.agente), null);
  const b = classifyVisitor("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36");
  assert.equal(rolIA(b.tipo, b.agente), null);
});
