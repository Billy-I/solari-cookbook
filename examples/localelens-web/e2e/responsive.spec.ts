import { expect, test } from "@playwright/test";

const firstTargetUrl = "https://example.com/";
const secondTargetUrl = "https://www.iana.org/";

test("compact sample comparisons complete the full safe journey", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const consoleErrors: string[] = [];
  const providerRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/captures" || pathname.startsWith("/api/replays")) {
      providerRequests.push(pathname);
    }
  });
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printOpened = "true";
    };
  });

  await page.goto("/");
  const status = page.getByRole("status", { name: "Comparison status" });
  await page
    .getByRole("textbox", { name: "URL (HTTPS)" })
    .fill(firstTargetUrl);
  await expect(page.getByRole("textbox", { name: "URL (HTTPS)" })).toHaveValue(
    firstTargetUrl,
  );
  await page.getByRole("checkbox", { name: "Germany" }).check();
  await page.getByRole("button", { name: "Compare markets" }).click();

  await expect(status).toContainText("Queued");
  await expect(
    page.getByLabel("Run evidence").getByText("example.com", { exact: true }),
  ).toBeVisible();
  await expect(status.getByText("Complete", { exact: true })).toHaveCount(3);
  await expect(
    page.getByLabel("Captured field differences by market, compact view"),
  ).toBeVisible();
  await expect(page.getByText("Germany", { exact: true }).last()).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  await expect((await download).suggestedFilename()).toMatch(/localelens.*\.json$/);

  await page.getByRole("button", { name: "Print evidence" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-opened", "true");

  await page.getByRole("textbox", { name: "URL (HTTPS)" }).fill(secondTargetUrl);
  await expect(page.getByRole("textbox", { name: "URL (HTTPS)" })).toHaveValue(
    secondTargetUrl,
  );
  await page.getByRole("button", { name: "Compare markets" }).click();
  await expect(status).toContainText("Queued");
  await expect(
    page.getByLabel("Run evidence").getByText("www.iana.org", { exact: true }),
  ).toBeVisible();
  await expect(status.getByText("Complete", { exact: true })).toHaveCount(3);
  expect(
    await page.locator("html").evaluate(
      (documentElement) => documentElement.scrollWidth <= documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(providerRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
