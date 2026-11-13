import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

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

const SVG = "/assets/platform_customize/images/apps";
// what platform_customize's get_apps returns (original order, Rendszer appended)
const api = [
  {
    name: "erpnext",
    title: "ERP",
    logo: `${SVG}/erpnext.svg`,
    route: "/desk/erpnext",
  },
  {
    name: "helpdesk",
    title: "Ügyfélszolgálat",
    logo: `${SVG}/helpdesk.svg`,
    route: "/helpdesk",
  },
  { name: "crm", title: "CRM", logo: `${SVG}/crm.svg`, route: "/crm" },
  {
    name: "frappe",
    title: "Rendszer",
    logo: `${SVG}/frappe.svg`,
    route: "/desk",
  },
];

test("uses the API entries: current app left out, Rendszer last with route /desk", async () => {
  const { buildApps } = await loadTs("./appsList.ts");
  const apps = buildApps(api, "System");
  assert.deepEqual(
    apps.map((a) => a.name),
    ["erpnext", "crm", "frappe"]
  );
  const system = apps.at(-1);
  assert.equal(system.route, "/desk");
  assert.equal(system.title, "Rendszer");
  assert.equal(system.logo, `${SVG}/frappe.svg`);
  assert.equal(apps[0].title, "ERP");
  assert.equal(apps[0].logo, `${SVG}/erpnext.svg`);
});

test("falls back to a /desk Rendszer entry when the API has none (no platform_customize)", async () => {
  const { buildApps } = await loadTs("./appsList.ts");
  const apps = buildApps(
    [
      {
        name: "crm",
        title: "Frappe CRM",
        logo: "/assets/crm/x.svg",
        route: "/crm",
      },
      {
        name: "erpnext",
        title: "ERPNext",
        logo: "/assets/erpnext/e.svg",
        route: "/desk/erpnext",
      },
    ],
    "Rendszer"
  );
  assert.deepEqual(
    apps.map((a) => a.name),
    ["erpnext", "crm", "frappe"]
  );
  assert.equal(apps[0].title, "ERP");
  assert.equal(apps[1].title, "CRM");
  assert.deepEqual(apps.at(-1), {
    name: "frappe",
    logo: `${SVG}/frappe.svg`,
    title: "Rendszer",
    route: "/desk",
  });
  for (const a of apps) assert.ok(!a.logo.includes("desk.png"));
  assert.ok(apps.every((a) => a.route !== "/desk/helpdesk"));
});

test("sorts into canonical order and keeps one Rendszer entry, last", async () => {
  const { buildApps } = await loadTs("./appsList.ts");
  const shuffled = [api[3], api[2], api[0], api[3], api[1]];
  const apps = buildApps(shuffled, "System");
  assert.deepEqual(
    apps.map((a) => a.name),
    ["erpnext", "crm", "frappe"]
  );
});

test("unknown apps sit before Rendszer; empty/missing data still gives Rendszer", async () => {
  const { buildApps } = await loadTs("./appsList.ts");
  const apps = buildApps(
    [
      { name: "builder", title: "Builder", logo: "", route: "/builder" },
      api[0],
    ],
    "System"
  );
  assert.deepEqual(
    apps.map((a) => a.name),
    ["erpnext", "builder", "frappe"]
  );
  assert.equal(apps[1].logo, `${SVG}/builder.svg`);
  assert.deepEqual(
    buildApps(null, "System").map((a) => a.name),
    ["frappe"]
  );
  assert.deepEqual(
    buildApps([], "System").map((a) => a.route),
    ["/desk"]
  );
});

test("a /desk/helpdesk route from an old API never becomes Rendszer's route", async () => {
  const { buildApps } = await loadTs("./appsList.ts");
  const apps = buildApps(
    [{ name: "frappe", title: "", logo: "", route: "" }],
    "Rendszer"
  );
  assert.equal(apps[0].route, "/desk");
  assert.equal(apps[0].title, "Rendszer");
});
