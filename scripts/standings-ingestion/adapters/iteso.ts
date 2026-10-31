import { parse } from 'parse5';

import type { DefaultTreeAdapterTypes } from 'parse5';

const ITESO_ORIGIN = 'https://eventos.iteso.mx';
const INDEX_URL = `${ITESO_ORIGIN}/acm/`;

type HtmlNode = DefaultTreeAdapterTypes.Node;
type HtmlElement = DefaultTreeAdapterTypes.Element;

export interface ITESOEditionDiscovery {
  seasonYear: number;
  editionLabel: string;
  overviewUrl: string | null;
  accumulatedPageUrl: string | null;
  stagedLinks: { url: string; linkText: string; reason: string }[];
}

export interface ITESOIndexDiscovery {
  indexUrl: string;
  editions: ITESOEditionDiscovery[];
  duplicateOverviewUrls: string[];
}

export type ITESOAccumulatedPageDiscovery =
  | {
      status: 'found';
      seasonYear: number;
      overviewUrl: string;
      accumulatedPageUrl: string;
    }
  | {
      status: 'missing' | 'staged';
      seasonYear: number;
      overviewUrl: string;
      accumulatedPageUrl: null;
      stagedLinks: { url: string; linkText: string; reason: string }[];
    };

export type ITESOResultAssetDiscovery =
  | {
      status: 'found';
      resultPageUrl: string;
      assetUrl: string;
      originalUrl: string;
      thumbnailUrl: string | null;
      linkText: string;
      upgradedToHttps: boolean;
    }
  | {
      status: 'missing' | 'staged';
      resultPageUrl: string;
      assetUrl: null;
      candidates: { url: string; linkText: string; reason: string }[];
    };

export type ITESODocumentType = 'pdf' | 'image' | 'html' | 'unknown';

export interface ITESODocumentDispatch {
  type: ITESODocumentType;
  declaredContentType: string | null;
  signatureMatched: boolean;
}

const childNodes = (node: HtmlNode): readonly HtmlNode[] =>
  'childNodes' in node ? node.childNodes : [];

const isElement = (node: HtmlNode): node is HtmlElement => 'tagName' in node;

const attribute = (element: HtmlElement, name: string): string | undefined =>
  element.attrs.find((item) => item.name === name)?.value;

const textContent = (node: HtmlNode): string => {
  if (node.nodeName === '#text' && 'value' in node) {
    return node.value;
  }
  return childNodes(node).map(textContent).join(' ').replace(/\s+/g, ' ').trim();
};

const flattenDocument = (root: HtmlNode): HtmlNode[] => {
  const nodes: HtmlNode[] = [];
  const visit = (node: HtmlNode): void => {
    nodes.push(node);
    childNodes(node).forEach(visit);
  };
  visit(root);
  return nodes;
};

const normalizedText = (node: HtmlNode): string => textContent(node).replace(/\s+/g, ' ').trim();

const findEnclosingSection = (
  root: HtmlNode,
  target: HtmlNode,
  currentSection?: HtmlElement,
): HtmlElement | undefined => {
  const section = isElement(root) && root.tagName === 'section' ? root : currentSection;
  if (root === target) {
    return section;
  }
  for (const child of childNodes(root)) {
    const found = findEnclosingSection(child, target, section);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
};

const safeURL = (href: string, base: string): URL | undefined => {
  try {
    const url = new URL(href, base);
    url.hash = '';
    return url;
  } catch {
    return undefined;
  }
};

const editionYearFromSection = (label: string): number | undefined => {
  const match = /^ICPC\s+M[eé]xico(?:\s*&\s*Centroam[eé]rica)?\s+(\d{4})$/i.exec(label.trim());
  if (match === null) {
    return undefined;
  }
  return Number(match[1]);
};

const imageSource = (anchor: HtmlElement): string | undefined => {
  const image = flattenDocument(anchor).find(
    (node): node is HtmlElement => isElement(node) && node.tagName === 'img',
  );
  return image === undefined ? undefined : attribute(image, 'src');
};

export const discoverITESOArchive = (html: string): ITESOIndexDiscovery => {
  const document = parse(html);
  const nodes = flattenDocument(document);
  const editions: ITESOEditionDiscovery[] = [];
  const duplicateOverviewUrls: string[] = [];
  const seenOverviews = new Set<string>();
  nodes.forEach((node) => {
    if (!isElement(node) || !/^h[1-6]$/.test(node.tagName)) {
      return;
    }
    const editionYear = editionYearFromSection(normalizedText(node));
    if (editionYear === undefined) {
      return;
    }
    const section = findEnclosingSection(document, node);
    if (section === undefined) {
      editions.push({
        seasonYear: editionYear,
        editionLabel: String(editionYear),
        overviewUrl: null,
        accumulatedPageUrl: null,
        stagedLinks: [
          { url: INDEX_URL, linkText: '', reason: 'season heading has no section container' },
        ],
      });
      return;
    }
    const anchors = flattenDocument(section).filter(
      (child): child is HtmlElement => isElement(child) && child.tagName === 'a',
    );
    const links = anchors.flatMap((anchor) => {
      const href = attribute(anchor, 'href');
      if (href === undefined) {
        return [];
      }
      const url = safeURL(href, INDEX_URL);
      return url === undefined ? [] : [{ url, linkText: normalizedText(anchor) }];
    });
    const overviewCandidates = links.filter(({ linkText, url }) => {
      const relevantLabel =
        /^sobre los concursos\b/i.test(linkText) && /gran ?premio/i.test(linkText);
      const isArchiveOverview = /^\/acm\//i.test(url.pathname);
      const yearMatch = /(?:19|20)\d{2}/g;
      const years = [...linkText.matchAll(yearMatch)].map((match) => Number(match[0]));
      return relevantLabel && isArchiveOverview && years.includes(editionYear);
    });
    const accumulatedCandidates = links.filter(({ linkText, url }) => {
      const relevantLabel =
        /resultado\s+acumulado|standing\s+(?:a\s+la\s+fecha\s+)?del\s+gran\s+premio/i.test(
          linkText,
        );
      const yearMatch = /(?:19|20)\d{2}/g;
      const years = [...`${linkText} ${url.pathname}`.matchAll(yearMatch)].map((match) =>
        Number(match[0]),
      );
      return relevantLabel && years.includes(editionYear);
    });
    const stagedLinks: ITESOEditionDiscovery['stagedLinks'] = [];
    const uniqueOverviews = [
      ...new Map(overviewCandidates.map((link) => [link.url.href, link])).values(),
    ];
    const uniqueAccumulated = [
      ...new Map(accumulatedCandidates.map((link) => [link.url.href, link])).values(),
    ];
    const validUrl = (url: URL, linkText: string): boolean => {
      if (
        url.protocol !== 'https:' ||
        url.origin !== ITESO_ORIGIN ||
        url.username ||
        url.password
      ) {
        stagedLinks.push({
          url: url.href,
          linkText,
          reason: 'archive navigation link is outside the configured HTTPS origin',
        });
        return false;
      }
      return true;
    };
    const validOverviews = uniqueOverviews.filter(({ url, linkText }) => validUrl(url, linkText));
    const validAccumulated = uniqueAccumulated.filter(({ url, linkText }) =>
      validUrl(url, linkText),
    );
    if (validOverviews.length > 1 || validAccumulated.length > 1) {
      stagedLinks.push({
        url: INDEX_URL,
        linkText: normalizedText(node),
        reason: 'season section has ambiguous contest overview or accumulated result links',
      });
    }
    const overview = validOverviews.at(0);
    const accumulated = validAccumulated.at(0);
    if (overview !== undefined && seenOverviews.has(overview.url.href)) {
      duplicateOverviewUrls.push(overview.url.href);
    } else if (overview !== undefined) {
      seenOverviews.add(overview.url.href);
    }
    editions.push({
      seasonYear: editionYear,
      editionLabel: String(editionYear),
      overviewUrl: validOverviews.length === 1 && overview !== undefined ? overview.url.href : null,
      accumulatedPageUrl:
        validAccumulated.length === 1 && accumulated !== undefined ? accumulated.url.href : null,
      stagedLinks,
    });
  });
  return { indexUrl: INDEX_URL, editions, duplicateOverviewUrls };
};

export const discoverITESOAccumulatedPage = (
  html: string,
  overviewUrl: string,
  seasonYear: number,
): ITESOAccumulatedPageDiscovery => {
  const document = parse(html);
  const nodes = flattenDocument(document);
  const content =
    nodes.find((node): node is HtmlElement => isElement(node) && node.tagName === 'article') ??
    nodes.find((node): node is HtmlElement => isElement(node) && node.tagName === 'main');
  if (content === undefined) {
    return {
      status: 'staged',
      seasonYear,
      overviewUrl,
      accumulatedPageUrl: null,
      stagedLinks: [
        { url: overviewUrl, linkText: '', reason: 'overview article content was not found' },
      ],
    };
  }
  const links = flattenDocument(content).flatMap((node) => {
    if (!isElement(node) || node.tagName !== 'a') {
      return [];
    }
    const href = attribute(node, 'href');
    if (href === undefined) {
      return [];
    }
    const url = safeURL(href, overviewUrl);
    if (url === undefined) {
      return [];
    }
    const linkText = normalizedText(node);
    const yearMatch = /(?:19|20)\d{2}/g;
    const years = [...`${linkText} ${url.pathname}`.matchAll(yearMatch)].map((match) =>
      Number(match[0]),
    );
    const isAccumulated =
      /resultado\s+acumulado|standing\s+(?:a\s+la\s+fecha\s+)?del\s+gran\s+premio/i.test(
        linkText,
      ) && years.includes(seasonYear);
    return isAccumulated ? [{ url, linkText }] : [];
  });
  const unique = [...new Map(links.map((link) => [link.url.href, link])).values()];
  if (unique.length === 0) {
    return {
      status: 'missing',
      seasonYear,
      overviewUrl,
      accumulatedPageUrl: null,
      stagedLinks: [],
    };
  }
  if (unique.length > 1) {
    return {
      status: 'staged',
      seasonYear,
      overviewUrl,
      accumulatedPageUrl: null,
      stagedLinks: unique.map(({ url, linkText }) => ({
        url: url.href,
        linkText,
        reason: 'multiple accumulated result pages match this edition',
      })),
    };
  }
  const result = unique[0];
  if (
    result.url.protocol !== 'https:' ||
    result.url.origin !== ITESO_ORIGIN ||
    result.url.username ||
    result.url.password
  ) {
    return {
      status: 'staged',
      seasonYear,
      overviewUrl,
      accumulatedPageUrl: null,
      stagedLinks: [
        {
          url: result.url.href,
          linkText: result.linkText,
          reason: 'accumulated result page is outside the configured HTTPS origin',
        },
      ],
    };
  }
  return { status: 'found', seasonYear, overviewUrl, accumulatedPageUrl: result.url.href };
};

export const discoverITESOResultAsset = (
  html: string,
  resultPageUrl: string,
  allowedOrigins: readonly string[] = [],
): ITESOResultAssetDiscovery => {
  const document = parse(html);
  const nodes = flattenDocument(document);
  const content =
    nodes.find((node): node is HtmlElement => isElement(node) && node.tagName === 'article') ??
    nodes.find((node): node is HtmlElement => isElement(node) && node.tagName === 'main');
  if (content === undefined) {
    return { status: 'missing', resultPageUrl, assetUrl: null, candidates: [] };
  }
  const anchors = flattenDocument(content).flatMap((node) => {
    if (!isElement(node) || node.tagName !== 'a') {
      return [];
    }
    const href = attribute(node, 'href');
    if (href === undefined) {
      return [];
    }
    const linkText = normalizedText(node);
    const thumbnailUrl = imageSource(node);
    const looksLikeResult =
      /status del standing|resultado acumulado|standing.*gran premio/i.test(linkText) ||
      flattenDocument(node).some((child) => isElement(child) && child.tagName === 'img');
    if (!looksLikeResult) {
      return [];
    }
    const url = safeURL(href, resultPageUrl);
    return url === undefined ? [] : [{ url, linkText, thumbnailUrl }];
  });
  const unique = [...new Map(anchors.map((anchor) => [anchor.url.href, anchor])).values()];
  if (unique.length === 0) {
    return { status: 'missing', resultPageUrl, assetUrl: null, candidates: [] };
  }
  if (unique.length > 1) {
    return {
      status: 'staged',
      resultPageUrl,
      assetUrl: null,
      candidates: unique.map(({ url, linkText }) => ({
        url: url.href,
        linkText,
        reason: 'multiple result assets are linked from the result page',
      })),
    };
  }
  const asset = unique[0];
  const originalUrl = asset.url.href;
  const allowedOriginSet = new Set([
    ITESO_ORIGIN,
    ...allowedOrigins.map((value) => new URL(value).origin),
  ]);
  const assetUrl = asset.url;
  let upgradedToHttps = false;
  if (assetUrl.protocol === 'http:') {
    const secureOrigin = `https://${assetUrl.host}`;
    if (!allowedOrigins.map((value) => new URL(value).origin).includes(secureOrigin)) {
      return {
        status: 'staged',
        resultPageUrl,
        assetUrl: null,
        candidates: [
          {
            url: assetUrl.href,
            linkText: asset.linkText,
            reason: 'insecure result asset origin is not approved for HTTPS upgrade',
          },
        ],
      };
    }
    assetUrl.protocol = 'https:';
    upgradedToHttps = true;
  }
  if (assetUrl.protocol !== 'https:' || !allowedOriginSet.has(assetUrl.origin)) {
    return {
      status: 'staged',
      resultPageUrl,
      assetUrl: null,
      candidates: [
        {
          url: originalUrl,
          linkText: asset.linkText,
          reason: 'result asset is outside the configured HTTPS origins',
        },
      ],
    };
  }
  return {
    status: 'found',
    resultPageUrl,
    assetUrl: assetUrl.href,
    originalUrl,
    thumbnailUrl: asset.thumbnailUrl ?? null,
    linkText: asset.linkText,
    upgradedToHttps,
  };
};

const startsWithBytes = (body: Uint8Array, signature: readonly number[]): boolean =>
  signature.every((value, index) => body[index] === value);

export const detectITESODocumentType = (
  contentType: string | null,
  body: Uint8Array,
): ITESODocumentDispatch => {
  const declaredContentType = contentType?.split(';')[0].trim().toLowerCase() ?? null;
  const prefix = new TextDecoder().decode(body.subarray(0, 512)).trimStart().toLowerCase();
  const signatureType: ITESODocumentType | null = prefix.startsWith('%pdf-')
    ? 'pdf'
    : startsWithBytes(body, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
        startsWithBytes(body, [0xff, 0xd8, 0xff]) ||
        (startsWithBytes(body, [0x52, 0x49, 0x46, 0x46]) &&
          new TextDecoder().decode(body.subarray(8, 12)) === 'WEBP') ||
        prefix.startsWith('gif8')
      ? 'image'
      : prefix.startsWith('<!doctype html') || prefix.startsWith('<html')
        ? 'html'
        : null;
  const declaredType: ITESODocumentType | null =
    declaredContentType === null
      ? null
      : declaredContentType === 'application/pdf'
        ? 'pdf'
        : declaredContentType.startsWith('image/')
          ? 'image'
          : declaredContentType === 'text/html' || declaredContentType === 'application/xhtml+xml'
            ? 'html'
            : 'unknown';
  const type = signatureType ?? declaredType ?? 'unknown';
  return {
    type,
    declaredContentType,
    signatureMatched: signatureType !== null && signatureType === declaredType,
  };
};
