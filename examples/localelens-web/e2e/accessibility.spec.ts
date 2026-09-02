import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const targetUrl = "https://example.com/";
const providerRequests = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const requests: string[] = [];
  providerRequests.set(page, requests);
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/captures" || pathname.startsWith("/api/replays")) {
      requests.push(`${request.method()} ${pathname}`);
    }
  });
});

test.afterEach(async ({ page }) => {
  expect(providerRequests.get(page)).toEqual([]);
});

async function expectAxeClean(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function startSampleRun(page: Page, thirdMarket: "France" | "Germany") {
  await page.getByRole("textbox", { name: "URL (HTTPS)" }).fill(targetUrl);
  await page.getByRole("checkbox", { name: thirdMarket }).check();
  await page.getByRole("button", { name: "Compare markets" }).click();
}

test("idle sample state has no automated axe violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Ready to compare", { exact: true })).toBeVisible();
  await expectAxeClean(page);
});

test("validation error is focused and has no automated axe violations", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "URL (HTTPS)" }).fill("http://example.com");
  await page.getByRole("button", { name: "Compare markets" }).click();

  const alert = page.locator('.form-alert[role="alert"]');
  await expect(alert).toHaveCount(1);
  await expect(alert).toBeFocused();
  await expect(alert).toContainText("Enter a valid HTTPS URL");
  await expectAxeClean(page);
});

test("running state uses one polite live region without moving submit focus", async ({
  page,
}) => {
  await page.goto("/");
  const compare = page.getByRole("button", { name: "Compare markets" });
  await page.getByRole("textbox", { name: "URL (HTTPS)" }).fill(targetUrl);
  await page.getByRole("checkbox", { name: "Germany" }).check();
  await compare.focus();
  await compare.click();

  const liveRegion = page.locator('[role="status"][aria-live="polite"]');
  await expect(liveRegion).toHaveCount(1);
  await expect(liveRegion).toContainText(/Queued|Launching browser|Loading page/);
  await expect(compare).toBeFocused();
  await expectAxeClean(page);
});

test("complete state exposes descriptive screenshots and labeled comparison structures", async ({
  page,
}) => {
  await page.goto("/");
  await startSampleRun(page, "Germany");

  const status = page.getByRole("status", { name: "Comparison status" });
  await expect(status.getByText("Complete", { exact: true })).toHaveCount(3);
  const regionalResults = page.getByRole("region", { name: "Regional results" });
  await expect(regionalResults.getByRole("img")).toHaveCount(3);
  for (const country of ["United States", "United Kingdom", "Germany"]) {
    await expect(
      regionalResults.getByRole("img", {
        name: new RegExp(
          `${country} evidence for regional\\.example\\.test, captured`,
          "i",
        ),
      }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("table", { name: "Captured field differences by market" }),
  ).toBeVisible();
  await expect(status.getByRole("list")).toBeVisible();
  await expectAxeClean(page);
});

test("partial-failure state remains labeled and has no automated axe violations", async ({
  page,
}) => {
  await page.goto("/");
  await startSampleRun(page, "France");

  const status = page.getByRole("status", { name: "Comparison status" });
  await expect(status.getByText("Complete", { exact: true })).toHaveCount(2);
  await expect(status.getByText("Failed", { exact: true })).toHaveCount(1);
  await expect(
    page.getByRole("article", { name: "France regional evidence failed" }),
  ).toBeVisible();
  await expect(page.getByText("Partial report: 2 of 3 captures succeeded.")).toBeVisible();
  await expectAxeClean(page);
});

test("keyboard order is stable and every focused control has a visible outline", async ({
  page,
}) => {
  await page.goto("/");

  const expectedOrder = [
    page.getByText("How it works", { exact: true }),
    page.getByRole("textbox", { name: "URL (HTTPS)" }),
    page.getByRole("checkbox", { name: "Germany" }),
    page.getByRole("checkbox", { name: "France" }),
    page.getByRole("checkbox", { name: "Japan" }),
    page.getByRole("checkbox", { name: "Australia" }),
    page.getByRole("button", { name: "Compare markets" }),
    page.locator(".table-scroll"),
    page.getByRole("button", { name: "Download JSON" }),
    page.getByRole("button", { name: "Print evidence" }),
  ];

  for (const target of expectedOrder) {
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
    const focusStyle = await target.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        color: style.outlineColor,
        style: style.outlineStyle,
        width: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(focusStyle.style).not.toBe("none");
    expect(focusStyle.width).toBeGreaterThanOrEqual(2);
    expect(focusStyle.color).not.toBe("rgba(0, 0, 0, 0)");
  }
});

test.describe("coarse-pointer targets", () => {
  test.use({ hasTouch: true, viewport: { height: 844, width: 390 } });

  test("interactive targets are at least 44 by 44 CSS pixels", async ({ page }) => {
    await page.goto("/");
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);

    const targets = [
      page.locator("summary"),
      page.getByRole("textbox", { name: "URL (HTTPS)" }),
      ...[
        "United States",
        "United Kingdom",
        "Germany",
        "France",
        "Japan",
        "Australia",
      ].map((name) => page.getByRole("checkbox", { name }).locator("..")),
      page.getByRole("button", { name: "Compare markets" }),
      page.getByRole("button", { name: "Download JSON" }),
      page.getByRole("button", { name: "Print evidence" }),
    ];

    for (const target of targets) {
      const box = await target.boundingBox();
      expect(box, await target.evaluate((element) => element.outerHTML)).not.toBeNull();
      expect(box!.width, await target.evaluate((element) => element.outerHTML)).toBeGreaterThanOrEqual(44);
      expect(box!.height, await target.evaluate((element) => element.outerHTML)).toBeGreaterThanOrEqual(44);
    }
  });
});

test("reduced-motion preference removes meaningful CSS motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true,
  );
  const motion = await page.locator(".primary-action").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animationDuration: style.animationDuration,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      transitionDuration: style.transitionDuration,
    };
  });
  expect(motion.animationDuration).toBe("0s");
  expect(motion.scrollBehavior).toBe("auto");
  expect(Number.parseFloat(motion.transitionDuration)).toBeLessThanOrEqual(0.00001);
});

test("640 CSS pixel reflow proxy preserves content expected at 200 percent zoom", async ({
  page,
}) => {
  await page.setViewportSize({ height: 720, width: 640 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Compare the experience by market" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Regional results" })).toBeVisible();
  await expect(
    page.getByLabel("Captured field differences by market, compact view"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Download JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print evidence" })).toBeVisible();
  expect(
    await page.locator("html").evaluate(
      (documentElement) => documentElement.scrollWidth <= documentElement.clientWidth,
    ),
  ).toBe(true);
});
