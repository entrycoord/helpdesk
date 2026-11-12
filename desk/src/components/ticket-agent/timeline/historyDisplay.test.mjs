import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { parse, compileTemplate } from "@vue/compiler-sfc";

async function loadTs(name) {
  const source = readFileSync(new URL(name, import.meta.url), "utf8");
  const js = ts.transpile(source, {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
  );
}

test("only controlled field values are translated, without changing records", async () => {
  const { displayHistoryValue } = await loadTs("./historyDisplay.ts");
  const translate = (s) => ({ Open: "Nyitott", Closed: "Lezárt" }[s] ?? s);
  const row = { fieldname: "status", from: "Open", to: "Closed" };
  assert.equal(
    displayHistoryValue(row.fieldname, row.from, translate),
    "Nyitott"
  );
  assert.equal(displayHistoryValue(row.fieldname, row.to, translate), "Lezárt");
  assert.deepEqual(row, { fieldname: "status", from: "Open", to: "Closed" });
  assert.equal(displayHistoryValue("agent_group", "Open", translate), "Open");
  assert.equal(displayHistoryValue("sla", "Open", translate), "Open");
  assert.equal(displayHistoryValue("description", "Open", translate), "Open");
  assert.equal(
    displayHistoryValue("status", "Custom status", translate),
    "Custom status"
  );
  assert.equal(displayHistoryValue("status", undefined, translate), undefined);
});

test("tag translations preserve names and reject unrelated text", async () => {
  const { translateTagActivity } = await loadTs("./historyDisplay.ts");
  const labels = {
    both: (a, b, c) => `${a}|${b}|${c}`,
    added: (a, b) => `${a}+${b}`,
    removed: (a, b) => `${a}-${b}`,
  };
  assert.equal(
    translateTagActivity(
      "Alex added tags One, Two & removed tag Three",
      "Alex",
      labels
    ),
    "Alex|One, Two|Three"
  );
  assert.equal(
    translateTagActivity("Alex added tag Open", "Alex", labels),
    "Alex+Open"
  );
  assert.equal(
    translateTagActivity("Alex removed tag Open", "Alex", labels),
    "Alex-Open"
  );
  for (const text of [
    "Alex wrote a note",
    "Someone added tag Open",
    "Alex added tag A & B",
  ])
    assert.equal(translateTagActivity(text, "Alex", labels), text);
});

test("copied formatting helpers preserve characters and parse timestamps", async () => {
  const { splitBold, truncate, timeValue } = await loadTs("./historyUtils.ts");
  const input = "Ann (A+B) assigned Ann.";
  const segments = splitBold(input, ["Ann", "A+B"]);
  assert.equal(segments.map((s) => s.text).join(""), input);
  assert.deepEqual(
    segments.filter((s) => s.bold).map((s) => s.text),
    ["Ann", "A+B", "Ann"]
  );
  assert.deepEqual(truncate("abcdef", 3), { text: "abc…", title: "abcdef" });
  assert.equal(timeValue("bad"), 0);
  assert.equal(
    timeValue("2026-01-02 03:04:05"),
    timeValue("2026-01-02T03:04:05")
  );
});

test("changed timeline templates compile and scripts parse", () => {
  for (const file of [
    "TicketTimeline.vue",
    "TimelineCommentRow.vue",
    "TimelineVersionRow.vue",
    "TimelineLogRow.vue",
    "TimeAgo.vue",
    "ValueChange.vue",
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    const parsed = parse(source, { filename: file });
    assert.deepEqual(parsed.errors, [], file);
    for (const script of [
      parsed.descriptor.script,
      parsed.descriptor.scriptSetup,
    ]) {
      if (!script) continue;
      const result = ts.transpileModule(script.content, {
        reportDiagnostics: true,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      });
      assert.deepEqual(result.diagnostics, [], file);
    }
    const template = compileTemplate({
      source: parsed.descriptor.template.content,
      filename: file,
      id: file,
    });
    assert.deepEqual(template.errors, [], file);
  }
});
