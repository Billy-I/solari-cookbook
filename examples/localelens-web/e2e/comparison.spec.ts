import { expect, test, type Page } from "@playwright/test";

const targetUrl = "https://regional.example.test/pricing";

function observeConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

function observeProviderRoutes(page: Page) {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/captures" || pathname.startsWith("/api/replays")) {
      providerRequests.push(`${request.method()} ${pathname}`);
    }
  });
  return providerRequests;
}

test("sample comparison settles three markets without provider requests", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const consoleErrors = observeConsoleErrors(page);
  const providerRequests = observeProviderRoutes(page);
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printOpened = "true";
    };
  });

  await page.goto("/");
  await expect(
    page.getByLabel("Run evidence").getByText("Sample evidence", { exact: true }),
  ).toBeVisible();

  await page.getByRole("textbox", { name: "URL (HTTPS)" }).fill(targetUrl);
  await page.getByRole("checkbox", { name: "Germany" }).check();
  await page.getByRole("button", { name: "Compare markets" }).click();

  const status = page.getByRole("status", { name: "Comparison status" });
  for (const market of ["US", "GB", "DE"]) {
    await expect(status.getByText(market, { exact: true })).toBeVisible();
  }
  await expect(status.getByText("Complete", { exact: true })).toHaveCount(3);

  const differences = page.getByRole("table", {
    name: "Captured field differences by market",
  });
  await expect(differences).toBeVisible();
  await expect(differences.getByRole("rowheader", { name: "Currency" })).toBeVisible();
  await expect(differences.getByText("Different").first()).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  await expect((await download).suggestedFilename()).toMatch(/localelens.*\.json$/);

  await page.getByRole("button", { name: "Print evidence" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-opened", "true");

  await page.getByRole("button", { name: "Compare markets" }).click();
  await expect(status.getByText("Complete", { exact: true })).toHaveCount(3);
  expect(
    await page.locator("html").evaluate(
      (documentElement) => documentElement.scrollWidth <= documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(providerRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
