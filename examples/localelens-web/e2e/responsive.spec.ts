import { expect, test } from "@playwright/test";

test("sample comparison stays usable at a compact viewport", async ({ page }) => {
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

  await page.goto("/");
  await page
    .getByRole("textbox", { name: "URL (HTTPS)" })
    .fill("https://regional.example.test/pricing");
  await page.getByRole("checkbox", { name: "Germany" }).check();
  await page.getByRole("button", { name: "Compare markets" }).click();

  const status = page.getByRole("status", { name: "Comparison status" });
  await expect(status.getByText("Complete", { exact: true })).toHaveCount(3);
  await expect(
    page.getByLabel("Captured field differences by market, compact view"),
  ).toBeVisible();
  await expect(page.getByText("Germany", { exact: true }).last()).toBeVisible();
  expect(
    await page.locator("html").evaluate(
      (documentElement) => documentElement.scrollWidth <= documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(providerRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
