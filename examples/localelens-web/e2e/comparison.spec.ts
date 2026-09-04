import { expect, test, type Page } from "@playwright/test";

import { createSolariTestDouble } from "./support/solari-test-double";

function observeConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test("desktop connection and comparison are explicit, live-only, and retry-safe", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const consoleErrors = observeConsoleErrors(page);
  const testDouble = createSolariTestDouble();
  await testDouble.install(page);
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printOpened = "true";
    };
  });

  await page.goto("/");
  await expect(page.getByText(/sample|demo/i)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Compare live through Solari" }),
  ).toBeDisabled();
  await page.getByLabel("Solari API key").fill("synthetic-playwright-key");
  expect(testDouble.authenticationCalls).toHaveLength(0);
  expect(testDouble.captureCalls).toHaveLength(0);

  await page.getByRole("button", { name: "Use my Solari key" }).click();
  await expect(page.getByText("Ready for this session")).toBeVisible();
  expect(testDouble.authenticationCalls).toEqual(["authentication"]);
  expect(testDouble.captureCalls).toHaveLength(0);
  expect(await page.content()).not.toContain("synthetic-playwright-key");

  await page.getByLabel("URL (HTTPS)").fill("https://public.synthetic.test/pricing");
  await page.getByRole("checkbox", { name: "Germany" }).check();
  await page.getByRole("button", { name: "Compare live through Solari" }).click();
  await expect(page.locator(".receipt-row").getByText("partial", { exact: true })).toBeVisible();
  expect(testDouble.captureCalls).toEqual([
    { attempt: 1, country: "de" },
    { attempt: 1, country: "gb" },
    { attempt: 1, country: "us" },
  ]);
  await page.waitForTimeout(250);
  expect(testDouble.captureCalls).toHaveLength(3);

  await page.getByText("Screenshots and regional evidence").click();
  await expect(page.getByText("Live evidence")).toHaveCount(2);
  await expect(page.getByText("CAPTURE_FAILED", { exact: true })).toBeVisible();
  await expect(page.getByText("Partial report: 2 of 3 captures succeeded.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Watch replay" })).toHaveCount(2);
  expect(testDouble.replayCalls.filter((call) => call === "events")).toHaveLength(0);

  await page.getByRole("button", { name: "Watch replay" }).first().click();
  await expect(page.getByRole("dialog", { name: "Session replay" })).toBeVisible();
  await expect(page.getByText("Replay ready")).toBeVisible();
  await expect(page.locator(".rr-controller")).toBeVisible();
  expect(testDouble.replayCalls.filter((call) => call === "events")).toHaveLength(1);
  await page.getByText("Developer data", { exact: true }).click();
  const replayDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download NDJSON" }).click();
  await expect((await replayDownload).suggestedFilename()).toBe(
    "sol_0123456789abcdef0123.ndjson",
  );
  expect(testDouble.replayCalls.filter((call) => call === "events")).toHaveLength(1);
  await page.getByRole("button", { name: "Close replay" }).click();
  await expect(page.getByRole("dialog", { name: "Session replay" })).toHaveCount(0);

  const partialDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  await expect((await partialDownload).suggestedFilename()).toMatch(/localelens.*\.json$/);

  await page.getByRole("button", { name: "Retry United Kingdom" }).click();
  await expect(page.locator(".receipt-row").getByText("complete", { exact: true })).toBeVisible();
  expect(testDouble.captureCalls).toHaveLength(4);
  expect(testDouble.captureCalls[3]).toEqual({ attempt: 2, country: "gb" });
  await expect(page.getByText("Live evidence")).toHaveCount(3);

  await page.getByRole("button", { name: "Print evidence" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-opened", "true");
  expect(
    await page.locator("html").evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByLabel("Solari API key")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Compare live through Solari" }),
  ).toBeDisabled();
  expect(consoleErrors).toEqual([]);
});
