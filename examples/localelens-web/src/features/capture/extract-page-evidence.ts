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
  const MAX_TRAVERSAL_NODES = 5_000;
  const MAX_VISIBLE_TEXT_ITEMS = 2_500;
  const MAX_VISIBLE_TEXT_CHARACTERS = 100_000;
  const MAX_NODE_TEXT_CHARACTERS = 2_000;
  const MAX_ANCESTOR_CHECKS = 32;
  const MAX_HEADING_CANDIDATES = 50;
  const MAX_CTA_CANDIDATES = 100;
  const normalize = (value: string | null | undefined): string =>
    value?.replace(/\s+/g, " ").trim() ?? "";
  const cap = (value: string, length: number): string =>
    value.slice(0, length);
  const isVisible = (element: Element): boolean => {
    let current: Element | null = element;
    let checks = 0;
    while (current && checks < MAX_ANCESTOR_CHECKS) {
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
      current = current.parentElement;
      checks += 1;
    }

    return current === null;
  };
  const visibleTextNodes = (
    root: Node,
    maxNodes = MAX_TRAVERSAL_NODES,
    maxCharacters = MAX_VISIBLE_TEXT_CHARACTERS,
    maxItems = MAX_VISIBLE_TEXT_ITEMS,
  ): string[] => {
    const values: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL);
    let visitedNodes = 0;
    let collectedCharacters = 0;

    for (
      let node = walker.nextNode();
      node && visitedNodes < maxNodes && values.length < maxItems;
      node = walker.nextNode()
    ) {
      visitedNodes += 1;
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const parent = node.parentElement;
      const remainingCharacters = maxCharacters - collectedCharacters;
      if (remainingCharacters <= 0) break;
      const rawText = (node.textContent ?? "").slice(
        0,
        Math.min(MAX_NODE_TEXT_CHARACTERS, remainingCharacters),
      );
      const text = normalize(rawText);
      if (parent && text && isVisible(parent)) {
        values.push(text);
        collectedCharacters += text.length;
      }
    }

    return values;
  };
  const visibleElementText = (element: Element): string =>
    normalize(visibleTextNodes(element, 200, 2_000, 100).join(" "));
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
  const elementWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
  );
  let visitedElements = 0;
  let headingCandidates = 0;
  let firstH1: Element | undefined;
  let firstFallbackHeading: Element | undefined;
  const ctaValues: string[] = [];

  for (
    let node = elementWalker.nextNode();
    node && visitedElements < MAX_TRAVERSAL_NODES;
    node = elementWalker.nextNode()
  ) {
    visitedElements += 1;
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    const isHeading = /^h[1-6]$/.test(tag);

    if (isHeading && headingCandidates < MAX_HEADING_CANDIDATES) {
      headingCandidates += 1;
      if (isVisible(element) && visibleElementText(element)) {
        if (tag === "h1" && !firstH1) firstH1 = element;
        if (tag !== "h1" && !firstFallbackHeading) {
          firstFallbackHeading = element;
        }
      }
    }

    if (
      ctaValues.length < MAX_CTA_CANDIDATES &&
      (tag === "button" ||
        element.getAttribute("role") === "button" ||
        (tag === "a" && element.hasAttribute("href"))) &&
      isVisible(element)
    ) {
      ctaValues.push(visibleElementText(element));
    }
  }

  const primaryHeadingElement = firstH1 ?? firstFallbackHeading;
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
  const title = cap(normalize(document.title.slice(0, 1_000)), 200);
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
