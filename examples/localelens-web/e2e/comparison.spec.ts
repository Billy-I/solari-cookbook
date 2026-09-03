import { expect, test, type Page } from "@playwright/test";

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
    if (/^\/api\/(captures|replays)(?:\/|$)/.test(pathname)) {
      providerRequests.push(`${request.method()} ${pathname}`);
    }
  });
  return providerRequests;
}

test("desktop featured demo is fixed, decision-first, and provider-free", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const consoleErrors = observeConsoleErrors(page);
  const providerRequests = observeProviderRoutes(page);
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printOpened = "true";
    };
  });

  await page.goto("/");
  await expect(page.getByText("Demo data — this URL will not be visited.")).toBeVisible();
  await expect(page.getByText("regional.example.test", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("United States, United Kingdom, and Germany"),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download JSON" })).toBeDisabled();

  const hierarchy = await page
    .locator("h2, .evidence-details > summary")
    .allTextContents();
  expect(hierarchy.indexOf("What changed")).toBeLessThan(
    hierarchy.indexOf("Screenshots and regional evidence"),
  );

  await page.getByRole("button", { name: "Run featured demo" }).click();
  await expect(page.getByText(/^llr_[0-9a-f-]{36}$/)).toBeVisible();
  await expect(page.locator(".receipt-row").getByText("complete", { exact: true })).toBeVisible();

  const status = page.getByRole("status", { name: "Comparison status" });
  await expect(status.getByText("Complete", { exact: true })).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "What changed" })).toBeVisible();
  await expect(page.getByText("Evidence availability")).toBeVisible();

  await page.getByText("Screenshots and regional evidence").click();
  await expect(page.getByRole("article", { name: /regional evidence$/ })).toHaveCount(3);
  await page.getByText("Detailed field comparison").click();
  const differences = page.getByRole("table", {
    name: "Captured field differences by market",
  });
  await expect(differences).toBeVisible();
  await expect(differences.getByRole("rowheader", { name: "Currency" })).toBeVisible();

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
  expect(providerRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
