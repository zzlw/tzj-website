import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const creds = JSON.parse(readFileSync("/tmp/tzj-creds.json", "utf8"));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto("http://localhost:3002/login", { waitUntil: "networkidle", timeout: 20000 });
await page.fill("input[name=username]", creds.user);
await page.fill("input[name=password]", creds.pass);
await page.click("button[type=submit]");
await page.waitForTimeout(2500);

await page.goto("http://localhost:3002/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/tzj-dash.png" });

await page.goto("http://localhost:3002/cases", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/tzj-list.png" });

const edit = page.locator('table tbody tr a[href*="/edit"]').first();
await edit.click();
await page.waitForTimeout(2500);
await page.screenshot({ path: "/tmp/tzj-editor.png" });

console.log("done");
await browser.close();
