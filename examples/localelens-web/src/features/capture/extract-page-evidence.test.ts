import { afterEach, describe, expect, it } from "vitest";

import { extractPageEvidence } from "@/src/features/capture/extract-page-evidence";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("lang");
});

describe("extractPageEvidence", () => {
  it("extracts normalized visible evidence in document order", () => {
    document.title = `  Regional   offers ${"x".repeat(220)}  `;
    document.documentElement.lang = " en-GB ";
    document.body.innerHTML = `
      <h2>Fallback heading</h2>
      <h1>  Main\nregional   heading  </h1>
      <p>Plans begin at USD 25 per month.</p>
      <p>Cookie preferences are available.</p>
      <a href="/start"> Start now </a>
      <button>Start now</button>
      <button> Compare plans </button>
      <script>const hidden = "EUR 999";</script>
      <style>.hidden { content: "GBP 999"; }</style>
      <p hidden>JPY 999 hidden</p>
      <p aria-hidden="true">AUD 999 hidden</p>
      <p style="display: none">CAD 999 hidden</p>
    `;

    const result = extractPageEvidence({
      finalUrl: "https://example.com/gb",
      httpStatus: 200,
    });

    expect(result).toMatchObject({
      finalUrl: "https://example.com/gb",
      documentLanguage: "en-GB",
      primaryHeading: "Main regional heading",
      primaryAction: "Start now",
      ctas: ["Start now", "Compare plans"],
      currencies: ["USD"],
      priceSnippets: ["Plans begin at USD 25 per month."],
      consentText: "Cookie preferences are available.",
      httpStatus: 200,
    });
    expect(result.title).toHaveLength(200);
    expect(JSON.stringify(result)).not.toMatch(/EUR 999|GBP 999|JPY 999|AUD 999|CAD 999/);
  });

  it("caps headings, actions, CTAs, currencies, prices, and consent text", () => {
    const longHeading = "Heading ".repeat(50);
    const longAction = "Action ".repeat(30);
    const currencyTokens = [
      "USD",
      "EUR",
      "GBP",
      "JPY",
      "AUD",
      "CAD",
      "CHF",
      "CNY",
      "INR",
      "KRW",
      "BRL",
      "MXN",
      "SGD",
    ];

    document.body.innerHTML = `
      <h1>${longHeading}</h1>
      <button>${longAction}</button>
      ${Array.from({ length: 24 }, (_, index) => `<a href="/${index}">Action ${index}</a>`).join("")}
      ${currencyTokens.map((token, index) => `<p>${token} ${index + 1} plan</p>`).join("")}
      <p>${`Cookie consent ${"details ".repeat(100)}`}</p>
    `;

    const result = extractPageEvidence({
      finalUrl: "https://example.com/",
      httpStatus: null,
    });

    expect(result.primaryHeading).toHaveLength(240);
    expect(result.primaryAction).toHaveLength(120);
    expect(result.ctas).toHaveLength(20);
    expect(result.ctas.every((value) => value.length <= 120)).toBe(true);
    expect(result.currencies).toEqual(currencyTokens.slice(0, 12));
    expect(result.priceSnippets).toHaveLength(8);
    expect(result.priceSnippets.every((value) => value.length <= 160)).toBe(true);
    expect(result.consentText).toHaveLength(500);
  });

  it("returns nulls and empty arrays when bounded evidence is unavailable", () => {
    document.body.innerHTML = "<main><p>Plain informational page.</p></main>";

    expect(
      extractPageEvidence({
        finalUrl: "https://example.com/",
        httpStatus: null,
      }),
    ).toEqual({
      finalUrl: "https://example.com/",
      title: null,
      documentLanguage: null,
      primaryHeading: null,
      primaryAction: null,
      ctas: [],
      currencies: [],
      priceSnippets: [],
      consentText: null,
      httpStatus: null,
    });
  });
});
