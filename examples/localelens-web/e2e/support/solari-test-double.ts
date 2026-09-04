import type { Page, Route } from "@playwright/test";

export type SolariTestDouble = {
  authenticationCalls: string[];
  captureCalls: Array<{ country: string; attempt: number }>;
  replayCalls: string[];
  install(page: Page): Promise<void>;
};

const screenshotBase64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=";

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export function createSolariTestDouble(): SolariTestDouble {
  const authenticationCalls: string[] = [];
  const captureCalls: Array<{ country: string; attempt: number }> = [];
  const replayCalls: string[] = [];
  let ready = false;

  return {
    authenticationCalls,
    captureCalls,
    replayCalls,
    async install(page) {
      await page.route("**/api/solari-session", async (route) => {
        const request = route.request();
        if (request.method() === "GET") {
          return json(route, { status: ready ? "ready" : "missing" });
        }
        if (request.method() === "POST") {
          const body = request.postDataJSON() as { apiKey?: unknown };
          if (typeof body.apiKey !== "string" || body.apiKey.length === 0) {
            return json(
              route,
              {
                status: "authentication_unavailable",
                message: "The credential request was invalid.",
              },
              400,
            );
          }
          authenticationCalls.push("authentication");
          ready = true;
          return json(route, { status: "ready" });
        }
        if (request.method() === "DELETE") {
          ready = false;
          return route.fulfill({ status: 204 });
        }
        return route.fulfill({ status: 405 });
      });

      await page.route("**/api/captures", async (route) => {
        const body = route.request().postDataJSON() as {
          attempt: number;
          country: string;
          runId: string;
          url: string;
        };
        captureCalls.push({ country: body.country, attempt: body.attempt });
        const sessionRef = "sol_0123456789abcdef0123";

        if (body.country === "gb" && body.attempt === 1) {
          return json(
            route,
            {
              ok: false,
              correlation: {
                runId: body.runId,
                country: body.country,
                attempt: body.attempt,
                sessionRef,
              },
              error: {
                code: "CAPTURE_FAILED",
                message: "The regional capture did not complete.",
                retryable: true,
              },
            },
            200,
          );
        }

        return json(route, {
          ok: true,
          evidence: {
            requestedUrl: body.url,
            finalUrl: `https://${body.country}.synthetic.test/pricing`,
            title: `Synthetic ${body.country.toUpperCase()} page`,
            documentLanguage: body.country === "de" ? "de-DE" : "en",
            primaryHeading: `Synthetic ${body.country.toUpperCase()} heading`,
            primaryAction: "View synthetic plan",
            ctas: ["View synthetic plan"],
            currencies: [body.country === "de" ? "EUR" : "USD"],
            priceSnippets: [body.country === "de" ? "20 EUR" : "$20"],
            consentText: "Synthetic consent controls.",
            httpStatus: 200,
            capturedAt: "2026-09-03T12:00:00.000Z",
          },
          receipt: {
            runId: body.runId,
            country: body.country,
            attempt: body.attempt,
            sessionRef,
            proxyCountry: body.country,
            proxyTier: "residential",
            timezoneId: "Etc/UTC",
            recordingRequested: true,
          },
          screenshot: {
            mediaType: "image/jpeg",
            base64: screenshotBase64,
            width: 1,
          },
        });
      });

      await page.route("**/api/replays/**", async (route) => {
        if (route.request().method() !== "GET") {
          return route.fulfill({ status: 405 });
        }
        const mode = new URL(route.request().url()).searchParams.get("mode");
        replayCalls.push(mode ?? "status");
        if (mode !== "events") return json(route, { status: "ready" });

        return json(route, {
          status: "ready",
          events: [
            {
              type: 4,
              timestamp: 1_000,
              data: {
                href: "https://public.synthetic.test/pricing",
                width: 1280,
                height: 720,
              },
            },
            {
              type: 2,
              timestamp: 1_001,
              data: {
                node: {
                  type: 0,
                  id: 1,
                  childNodes: [
                    {
                      type: 2,
                      id: 2,
                      tagName: "html",
                      attributes: {},
                      childNodes: [
                        {
                          type: 2,
                          id: 3,
                          tagName: "head",
                          attributes: {},
                          childNodes: [],
                        },
                        {
                          type: 2,
                          id: 4,
                          tagName: "body",
                          attributes: {},
                          childNodes: [
                            {
                              type: 2,
                              id: 5,
                              tagName: "h1",
                              attributes: {},
                              childNodes: [
                                {
                                  type: 3,
                                  id: 6,
                                  textContent: "Synthetic replay",
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                initialOffset: { left: 0, top: 0 },
              },
            },
          ],
        });
      });
    },
  };
}
