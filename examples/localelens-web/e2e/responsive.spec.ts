import { expect, test } from "@playwright/test";

import { createSolariTestDouble } from "./support/solari-test-double";

test("360 CSS pixel live-only journey reflows without hidden evidence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const testDouble = createSolariTestDouble();
  await testDouble.install(page);
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printOpened = "true";
    };
  });

  await page.goto("/");
  await expect(page.getByText(/sample|demo/i)).toHaveCount(0);
  await page.getByLabel("Solari API key").fill("synthetic-responsive-key");
  expect(testDouble.captureCalls).toHaveLength(0);
  await page.getByRole("button", { name: "Use my Solari key" }).click();
  await expect(page.getByText("Ready for this session")).toBeVisible();
  await page.getByLabel("URL (HTTPS)").fill("https://public.synthetic.test/pricing");
  await page.getByRole("checkbox", { name: "Germany" }).check();
  await page.getByRole("button", { name: "Compare live through Solari" }).click();
  await expect(page.locator(".receipt-row").getByText("partial", { exact: true })).toBeVisible();
  expect(testDouble.authenticationCalls).toHaveLength(1);
  expect(testDouble.captureCalls).toHaveLength(3);

  await expect(page.getByRole("heading", { name: "What changed" })).toBeVisible();
  await page.getByText("Screenshots and regional evidence").click();
  await expect(page.getByRole("article", { name: /regional evidence/ })).toHaveCount(3);
  await page.getByText("Detailed field comparison").click();
  await expect(
    page.getByLabel("Captured field differences by market, compact view"),
  ).toBeVisible();

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  await expect((await downloadEvent).suggestedFilename()).toMatch(/localelens.*\.json$/);
  await page.getByRole("button", { name: "Print evidence" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-opened", "true");

  expect(
    await page.locator("html").evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(consoleErrors).toEqual([]);
});
