import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 0 : 1,
  use: {
    baseURL: "http://127.0.0.1:34123",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 34123",
    env: { NEXT_PUBLIC_APP_MODE: "sample" },
    port: 34123,
    reuseExistingServer: false,
  },
});
