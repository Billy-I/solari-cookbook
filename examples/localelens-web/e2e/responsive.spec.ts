import { expect, test } from "@playwright/test";

test("360 CSS pixel demo reflows without provider traffic or hidden decisions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const consoleErrors: string[] = [];
  const providerRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/^\/api\/(captures|replays)(?:\/|$)/.test(pathname)) {
      providerRequests.push(`${request.method()} ${pathname}`);
    }
  });
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printOpened = "true";
    };
  });

  await page.goto("/");
  await expect(page.getByText("Demo data — this URL will not be visited.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What changed" })).toBeVisible();
  await expect(page.getByText("Screenshots and regional evidence")).toBeVisible();
  await expect(page.getByText("Detailed field comparison")).toBeVisible();

  await page.getByRole("button", { name: "Run featured demo" }).click();
  await expect(page.getByText(/^llr_[0-9a-f-]{36}$/)).toBeVisible();
  await expect(page.locator(".receipt-row").getByText("complete", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Comparison status" }).getByText("Complete", {
      exact: true,
    }),
  ).toHaveCount(3);

  await page.getByText("Screenshots and regional evidence").click();
  await expect(page.getByRole("article", { name: /regional evidence$/ })).toHaveCount(3);
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
  expect(providerRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
