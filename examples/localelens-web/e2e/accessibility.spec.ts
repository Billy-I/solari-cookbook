import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  createSolariTestDouble,
  type SolariTestDouble,
} from "./support/solari-test-double";

const doubles = new WeakMap<Page, SolariTestDouble>();

test.beforeEach(async ({ page }) => {
  const testDouble = createSolariTestDouble();
  doubles.set(page, testDouble);
  await testDouble.install(page);
});

async function connect(page: Page) {
  await page.getByLabel("Solari API key").fill("synthetic-accessibility-key");
  await page.getByRole("button", { name: "Use my Solari key" }).click();
  await expect(page.getByText("Ready for this session")).toBeVisible();
}

async function runComparison(page: Page, complete = false) {
  await page.getByLabel("URL (HTTPS)").fill("https://public.synthetic.test/pricing");
  await page.getByRole("checkbox", { name: "Germany" }).check();
  await page.getByRole("button", { name: "Compare live through Solari" }).click();
  await expect(page.locator(".receipt-row").getByText("partial", { exact: true })).toBeVisible();
  if (complete) {
    await page.getByText("Screenshots and regional evidence").click();
    await page.getByRole("button", { name: "Retry United Kingdom" }).click();
    await expect(page.locator(".receipt-row").getByText("complete", { exact: true })).toBeVisible();
  }
}

async function expectAxeClean(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
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

test("idle and completed live-only states have no automated axe violations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Solari API key")).toBeVisible();
  await expectAxeClean(page);

  await connect(page);
  await runComparison(page, true);
  await page.getByText("Detailed field comparison").click();
  await expectAxeClean(page);
});

test("keyboard order preserves compare focus and exposes evidence actions", async ({
  page,
}) => {
  await page.goto("/");
  await connect(page);
  await page.getByLabel("URL (HTTPS)").fill("https://public.synthetic.test/pricing");
  await page.getByRole("checkbox", { name: "Germany" }).check();
  const compare = page.getByRole("button", { name: "Compare live through Solari" });
  await compare.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".receipt-row").getByText("partial", { exact: true })).toBeVisible();
  await expect(compare).toBeFocused();

  const screenshots = page.getByText("Screenshots and regional evidence");
  await page.keyboard.press("Tab");
  await expectVisibleFocus(screenshots);
  await page.keyboard.press("Enter");
  await expect(screenshots.locator("..")).toHaveAttribute("open", "");

  await page.getByRole("button", { name: "Retry United Kingdom" }).click();
  const details = page.getByText("Detailed field comparison");
  await details.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expectVisibleFocus(details);
  await page.keyboard.press("Space");
  await expect(details.locator("..")).toHaveAttribute("open", "");

  const tableScroll = page.locator(".table-scroll");
  await page.keyboard.press("Tab");
  await expectVisibleFocus(tableScroll);
  const download = page.getByRole("button", { name: "Download JSON" });
  await download.focus();
  await expectVisibleFocus(download);
  const print = page.getByRole("button", { name: "Print evidence" });
  await print.focus();
  await expectVisibleFocus(print);
});

test.describe("coarse-pointer targets", () => {
  test.use({ hasTouch: true, viewport: { height: 844, width: 390 } });

  test("all primary journey targets are at least 44 by 44 CSS pixels", async ({
    page,
  }) => {
    await page.goto("/");
    const initialTargets = [
      page.getByText("How it works", { exact: true }),
      page.getByRole("link", { name: "Get a Solari API key" }),
      page.getByLabel("Solari API key"),
    ];
    for (const target of initialTargets) {
      const box = await target.boundingBox();
      expect(box, await target.evaluate((element) => element.outerHTML)).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await connect(page);
    await runComparison(page, true);
    const completedTargets = [
      page.getByRole("button", { name: "Disconnect" }),
      page.getByRole("button", { name: "Compare live through Solari" }),
      page.getByText("Screenshots and regional evidence"),
      page.getByText("Detailed field comparison"),
      page.getByRole("button", { name: "Download JSON" }),
      page.getByRole("button", { name: "Print evidence" }),
    ];
    for (const target of completedTargets) {
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

  const motion = await page.locator(".primary-action").first().evaluate((element) => {
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

test("640 CSS pixel reflow preserves live comparison and action content", async ({
  page,
}) => {
  await page.setViewportSize({ height: 720, width: 640 });
  await page.goto("/");
  await connect(page);
  await runComparison(page);

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
  expect(doubles.get(page)?.authenticationCalls).toHaveLength(1);
  expect(doubles.get(page)?.captureCalls).toHaveLength(3);
});
