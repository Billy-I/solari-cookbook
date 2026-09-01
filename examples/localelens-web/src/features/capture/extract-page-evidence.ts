export type ExtractedPageEvidence = {
  finalUrl: string;
  title: string | null;
  documentLanguage: string | null;
  currencies: string[];
  priceSnippets: string[];
  primaryHeading: string | null;
  primaryAction: string | null;
  ctas: string[];
  consentText: string | null;
  httpStatus: number | null;
};

export type ExtractPageEvidenceInput = {
  finalUrl: string;
  httpStatus: number | null;
};

export function extractPageEvidence({
  finalUrl,
  httpStatus,
}: ExtractPageEvidenceInput): ExtractedPageEvidence {
  const normalize = (value: string | null | undefined): string =>
    value?.replace(/\s+/g, " ").trim() ?? "";
  const cap = (value: string, length: number): string =>
    value.slice(0, length);
  const isVisible = (element: Element): boolean => {
    for (let current: Element | null = element; current; current = current.parentElement) {
      const tag = current.tagName.toLowerCase();
      const style = window.getComputedStyle(current);
      if (
        ["script", "style", "noscript", "template"].includes(tag) ||
        current.hasAttribute("hidden") ||
        current.getAttribute("aria-hidden") === "true" ||
        style.display === "none" ||
        style.visibility === "hidden"
      ) {
        return false;
      }
    }

    return true;
  };
  const visibleTextNodes = (root: Node): string[] => {
    const values: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      const text = normalize(node.textContent);
      if (parent && text && isVisible(parent)) values.push(text);
    }

    return values;
  };
  const visibleElementText = (element: Element): string =>
    normalize(visibleTextNodes(element).join(" "));
  const uniqueBounded = (
    values: readonly string[],
    count: number,
    length: number,
  ): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const rawValue of values) {
      const value = cap(normalize(rawValue), length);
      const key = value.toLocaleLowerCase("en-US");
      if (!value || seen.has(key)) continue;
      seen.add(key);
      result.push(value);
      if (result.length === count) break;
    }

    return result;
  };

  const textNodes = visibleTextNodes(document.body);
  const headingCandidates = [
    ...document.querySelectorAll("h1"),
    ...document.querySelectorAll("h2, h3, h4, h5, h6"),
  ];
  const primaryHeadingElement = headingCandidates.find(
    (element) => isVisible(element) && visibleElementText(element),
  );
  const ctaValues = [...document.querySelectorAll("button, [role='button'], a[href]")]
    .filter((element) => isVisible(element))
    .map((element) => visibleElementText(element));
  const ctas = uniqueBounded(ctaValues, 20, 120);
  const currencyPattern =
    /\b(?:USD|EUR|GBP|JPY|AUD|CAD|CHF|CNY|INR|KRW|BRL|MXN|SGD|NZD|HKD|SEK|NOK|DKK|PLN|CZK|HUF|ZAR)\b|[$€£¥₹₩₽₺₫₪₱฿]/gi;
  const currencyValues: string[] = [];

  for (const text of textNodes) {
    for (const match of text.matchAll(currencyPattern)) {
      const token = match[0] ?? "";
      currencyValues.push(/^[a-z]{3}$/i.test(token) ? token.toUpperCase() : token);
    }
  }

  const priceSnippets = uniqueBounded(
    textNodes.filter((text) => {
      currencyPattern.lastIndex = 0;
      return currencyPattern.test(text);
    }),
    8,
    160,
  );
  const consentText = textNodes.find((text) =>
    /\b(?:cookie|cookies|consent|privacy)\b/i.test(text),
  );
  const title = cap(normalize(document.title), 200);
  const documentLanguage = cap(
    normalize(document.documentElement.getAttribute("lang")),
    35,
  );
  const primaryHeading = primaryHeadingElement
    ? cap(visibleElementText(primaryHeadingElement), 240)
    : "";

  return {
    finalUrl,
    title: title || null,
    documentLanguage: documentLanguage || null,
    primaryHeading: primaryHeading || null,
    primaryAction: ctas[0] ?? null,
    ctas,
    currencies: uniqueBounded(currencyValues, 12, 20),
    priceSnippets,
    consentText: consentText ? cap(consentText, 500) : null,
    httpStatus,
  };
}
