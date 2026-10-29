import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import { chromium } from '@playwright/test';
import { z } from 'zod';

import { sourceDefinitionSchema } from '@/features/scoreboards/ingestion/schemas';

import type { SourceDefinition } from '@/features/scoreboards/ingestion/schemas';
import type { Page } from '@playwright/test';

const MAX_NAVIGATION_TIMEOUT_MS = 60_000;
const MAX_ACTION_TIMEOUT_MS = 30_000;
const MAX_REQUESTS = 1000;
const MAX_ACTIONS = 50;
const MAX_CAPTURE_BYTES = 16 * 1024 * 1024;

const selectorSchema = z.string().min(1).max(512);

export const renderActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('click'), selector: selectorSchema }),
  z.object({ kind: z.literal('select'), selector: selectorSchema, value: z.string().max(512) }),
  z.object({ kind: z.literal('wait'), selector: selectorSchema }),
]);

export const renderRequestSchema = z.object({
  url: z.url({ protocol: /^https$/ }),
  actions: z.array(renderActionSchema).max(MAX_ACTIONS),
  readySelector: selectorSchema,
  captureSelector: selectorSchema,
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;
export type RenderAction = z.infer<typeof renderActionSchema>;

export interface RenderLimits {
  navigationTimeoutMs: number;
  actionTimeoutMs: number;
  maxRequests: number;
  maxCaptureBytes: number;
}

export interface RenderedSourceState {
  sourceId: string;
  discoveryUrl: string;
  finalUrl: string;
  capturedAt: string;
  html: string;
  contentSha256: string;
  requests: number;
}

interface CaptureLocator {
  count: () => Promise<number>;
  evaluate: (expression: string) => Promise<unknown>;
}

export class SourceRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceRenderError';
  }
}

export const validateRenderRequest = (
  source: SourceDefinition,
  rawRequest: unknown,
): z.infer<typeof renderRequestSchema> => {
  const parsedSource = sourceDefinitionSchema.parse(source);
  const request = renderRequestSchema.parse(rawRequest);
  const allowedOrigin = new URL(parsedSource.baseUrl).origin;
  const target = new URL(request.url);
  if (target.origin !== allowedOrigin || target.protocol !== 'https:') {
    throw new SourceRenderError('Rendered page URL must use the configured source HTTPS origin.');
  }
  return request;
};

export const validateRenderLimits = (limits: RenderLimits): void => {
  if (
    !Number.isSafeInteger(limits.navigationTimeoutMs) ||
    limits.navigationTimeoutMs < 1 ||
    limits.navigationTimeoutMs > MAX_NAVIGATION_TIMEOUT_MS
  ) {
    throw new RangeError(
      `Navigation timeout must be between 1 and ${String(MAX_NAVIGATION_TIMEOUT_MS)} milliseconds.`,
    );
  }
  if (
    !Number.isSafeInteger(limits.actionTimeoutMs) ||
    limits.actionTimeoutMs < 1 ||
    limits.actionTimeoutMs > MAX_ACTION_TIMEOUT_MS
  ) {
    throw new RangeError(
      `Browser action timeout must be between 1 and ${String(MAX_ACTION_TIMEOUT_MS)} milliseconds.`,
    );
  }
  if (
    !Number.isSafeInteger(limits.maxRequests) ||
    limits.maxRequests < 1 ||
    limits.maxRequests > MAX_REQUESTS
  ) {
    throw new RangeError(`Browser request budget must be between 1 and ${String(MAX_REQUESTS)}.`);
  }
  if (
    !Number.isSafeInteger(limits.maxCaptureBytes) ||
    limits.maxCaptureBytes < 1 ||
    limits.maxCaptureBytes > MAX_CAPTURE_BYTES
  ) {
    throw new RangeError(
      `Rendered capture limit must be between 1 and ${String(MAX_CAPTURE_BYTES)} bytes.`,
    );
  }
};

export const isAllowedSourceRequest = (value: string, origin: string): boolean => {
  if (value.startsWith('data:') || value.startsWith('blob:') || value === 'about:blank') {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === origin;
  } catch {
    return false;
  }
};

export const validateCapturedHtml = (html: string, maxBytes: number): number => {
  const byteLength = Buffer.byteLength(html, 'utf8');
  if (byteLength > maxBytes) {
    throw new SourceRenderError('Selected rendered HTML exceeds the configured byte limit.');
  }
  return byteLength;
};

export const performRenderActions = async (
  page: Page,
  actions: readonly RenderAction[],
  timeoutMs: number,
): Promise<void> => {
  for (const action of actions) {
    const locator = page.locator(action.selector);
    if (action.kind === 'click') {
      await locator.click({ timeout: timeoutMs });
    } else if (action.kind === 'select') {
      await locator.selectOption(action.value, { timeout: timeoutMs });
    } else {
      await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    }
  }
};

export const renderSelectedSourceState = async (
  source: SourceDefinition,
  rawRequest: unknown,
  limits: RenderLimits,
): Promise<RenderedSourceState> => {
  const request = validateRenderRequest(source, rawRequest);
  validateRenderLimits(limits);
  const origin = new URL(source.baseUrl).origin;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      acceptDownloads: false,
      javaScriptEnabled: true,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    let requests = 0;
    let blockedReason: string | undefined;
    await page.route('**/*', async (route) => {
      const requestUrl = route.request().url();
      requests += 1;
      if (requests > limits.maxRequests) {
        blockedReason = 'Browser request budget exhausted.';
        await route.abort('blockedbyclient');
        return;
      }
      if (!isAllowedSourceRequest(requestUrl, origin)) {
        blockedReason = `Browser request left the configured source origin: ${requestUrl}`;
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });
    page.setDefaultNavigationTimeout(limits.navigationTimeoutMs);
    page.setDefaultTimeout(limits.actionTimeoutMs);
    try {
      await page.goto(request.url, { waitUntil: 'domcontentloaded' });
      if (blockedReason !== undefined) {
        throw new SourceRenderError(blockedReason);
      }
      await performRenderActions(page, request.actions, limits.actionTimeoutMs);
      await page.locator(request.readySelector).waitFor({ state: 'visible' });
      const capture = page.locator(request.captureSelector) as unknown as CaptureLocator;
      if ((await capture.count()) !== 1) {
        throw new SourceRenderError('Capture selector must match exactly one rendered element.');
      }
      const capturedHtml = await capture.evaluate('element => element.outerHTML');
      if (typeof capturedHtml !== 'string') {
        throw new SourceRenderError('Selected rendered element did not return HTML text.');
      }
      const html = capturedHtml;
      validateCapturedHtml(html, limits.maxCaptureBytes);
      return {
        sourceId: source.id,
        discoveryUrl: request.url,
        finalUrl: page.url(),
        capturedAt: new Date().toISOString(),
        html,
        contentSha256: createHash('sha256').update(html).digest('hex'),
        requests,
      };
    } catch (error) {
      if (error instanceof SourceRenderError) {
        throw error;
      }
      if (blockedReason !== undefined) {
        throw new SourceRenderError(blockedReason);
      }
      throw new SourceRenderError(
        error instanceof Error ? error.message : 'Rendered source capture failed.',
      );
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
};
