import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const providerRequests = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const requests: string[] = [];
  providerRequests.set(page, requests);
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/^\/api\/(captures|replays)(?:\/|$)/.test(pathname)) {
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

async function runFeaturedDemo(page: Page) {
  await page.getByRole("button", { name: "Run featured demo" }).click();
  await expect(page.getByText(/^llr_[0-9a-f-]{36}$/)).toBeVisible();
  await expect(page.locator(".receipt-row").getByText("complete", { exact: true })).toBeVisible();
}

async function expectVisibleFocus(target: Locator) {
  await expect(target).toBeFocused();
  const style = await target.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      color: computed.outlineColor,
      style: computed.outlineStyle,
      width: Number.parseFloat(computed.outlineWidth),
    };
  });
  expect(style.style).not.toBe("none");
  expect(style.width).toBeGreaterThanOrEqual(2);
  expect(style.color).not.toBe("rgba(0, 0, 0, 0)");
}

test("idle and completed demo states have no automated axe violations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Demo data — this URL will not be visited.")).toBeVisible();
  await expectAxeClean(page);

  await runFeaturedDemo(page);
  await page.getByText("Screenshots and regional evidence").click();
  await page.getByText("Detailed field comparison").click();
  await expectAxeClean(page);
});

test("keyboard order exposes disclosures and exports without focus jumps", async ({
  page,
}) => {
  await page.goto("/");
  const demo = page.getByRole("button", { name: "Run featured demo" });
  await demo.focus();
  await page.keyboard.press("Enter");
  await expect(demo).toBeFocused();
  await expect(page.locator(".receipt-row").getByText("complete", { exact: true })).toBeVisible();
  await expect(demo).toBeFocused();

  const screenshots = page.getByText("Screenshots and regional evidence");
  await page.keyboard.press("Tab");
  await expectVisibleFocus(screenshots);
  await page.keyboard.press("Enter");
  await expect(screenshots.locator("..")).toHaveAttribute("open", "");

  const details = page.getByText("Detailed field comparison");
  await page.keyboard.press("Tab");
  await expectVisibleFocus(details);
  await page.keyboard.press("Space");
  await expect(details.locator("..")).toHaveAttribute("open", "");

  const tableScroll = page.locator(".table-scroll");
  await page.keyboard.press("Tab");
  await expectVisibleFocus(tableScroll);

  const download = page.getByRole("button", { name: "Download JSON" });
  await page.keyboard.press("Tab");
  await expectVisibleFocus(download);
  const print = page.getByRole("button", { name: "Print evidence" });
  await page.keyboard.press("Tab");
  await expectVisibleFocus(print);
});

test.describe("coarse-pointer targets", () => {
  test.use({ hasTouch: true, viewport: { height: 844, width: 390 } });

  test("all interactive targets are at least 44 by 44 CSS pixels", async ({
    page,
  }) => {
    await page.goto("/");
    await runFeaturedDemo(page);

    const targets = [
      page.getByText("How it works", { exact: true }),
      page.getByRole("button", { name: "Run featured demo" }),
      page.getByText("Screenshots and regional evidence"),
      page.getByText("Detailed field comparison"),
      page.getByRole("button", { name: "Download JSON" }),
      page.getByRole("button", { name: "Print evidence" }),
    ];

    for (const target of targets) {
      const box = await target.boundingBox();
      expect(box, await target.evaluate((element) => element.outerHTML)).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test("reduced-motion preference removes meaningful CSS motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

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

test("640 CSS pixel reflow preserves all decision and action content", async ({
  page,
}) => {
  await page.setViewportSize({ height: 720, width: 640 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Compare the experience by market" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What changed" })).toBeVisible();
  await expect(page.getByText("Screenshots and regional evidence")).toBeVisible();
  await expect(page.getByText("Detailed field comparison")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download JSON" })).toBeVisible();
  expect(
    await page.locator("html").evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
});
