import { describe, expect, it } from 'vitest';

import {
  isAllowedSourceRequest,
  isNonessentialPageResource,
  isNonessentialTrackingRequest,
  isPaginationComplete,
  performRenderActions,
  SourceRenderError,
  validateCapturedHtml,
  validateRenderLimits,
  validateRenderRequest,
} from './render';

import type { SourceDefinition } from '@/features/scoreboards/ingestion/schemas';
import type { Page } from '@playwright/test';

const source: SourceDefinition = {
  id: 'icpc-mexico',
  authorityId: 'icpc-mexico',
  name: 'ICPC Mexico',
  baseUrl: 'https://icpcmexico.org/contests',
  supportedStages: ['fecha-0', 'qualifier-1'],
  supportsSeasonStanding: true,
};

const limits = {
  navigationTimeoutMs: 20_000,
  actionTimeoutMs: 5_000,
  maxRequests: 20,
  maxCaptureBytes: 1024,
};

describe('bounded rendered source state', () => {
  it('requires the configured HTTPS origin and explicit bounded selectors/actions', () => {
    expect(
      validateRenderRequest(source, {
        url: 'https://icpcmexico.org/contests/2024',
        actions: [
          { kind: 'click', selector: 'button#season-2024' },
          { kind: 'select', selector: 'select#country', value: 'MX' },
          { kind: 'wait', selector: 'table#standings tbody tr' },
        ],
        readySelector: 'table#standings',
        captureSelector: 'table#standings',
      }).actions,
    ).toHaveLength(3);
    expect(() =>
      validateRenderRequest(source, {
        url: 'https://example.com/standings',
        actions: [],
        readySelector: 'main',
        captureSelector: 'main',
      }),
    ).toThrow(/configured source HTTPS origin/);
    expect(() =>
      validateRenderRequest(source, {
        url: 'https://icpcmexico.org/standings',
        actions: Array.from({ length: 51 }, () => ({ kind: 'wait', selector: 'table' })),
        readySelector: 'main',
        captureSelector: 'main',
      }),
    ).toThrow();
  });

  it('allows only HTTPS requests to the configured origin', () => {
    const origin = 'https://icpcmexico.org';
    expect(isAllowedSourceRequest('https://icpcmexico.org/contests?q=2024', origin)).toBe(true);
    expect(isAllowedSourceRequest('data:text/plain,fixture', origin)).toBe(true);
    expect(isAllowedSourceRequest('blob:https://icpcmexico.org/id', origin)).toBe(true);
    expect(isAllowedSourceRequest('http://icpcmexico.org/contests', origin)).toBe(false);
    expect(isAllowedSourceRequest('https://example.com/redirect', origin)).toBe(false);
    expect(isAllowedSourceRequest('file:///etc/passwd', origin)).toBe(false);
    expect(isAllowedSourceRequest('not a URL', origin)).toBe(false);
  });

  it('allows explicit subresource origins without allowing top-level navigation to them', () => {
    const sourceWithSubresource = {
      ...source,
      allowedOrigins: [
        'https://www.google.com',
        'https://www.gstatic.com',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
      ],
    };
    const allowedOrigins = new Set([
      new URL(sourceWithSubresource.baseUrl).origin,
      ...sourceWithSubresource.allowedOrigins,
    ]);
    expect(isAllowedSourceRequest('https://www.google.com/recaptcha/api.js', allowedOrigins)).toBe(
      true,
    );
    expect(
      isAllowedSourceRequest(
        'https://www.gstatic.com/recaptcha/releases/fixture/recaptcha__en.js',
        allowedOrigins,
      ),
    ).toBe(true);
    expect(
      isAllowedSourceRequest('https://fonts.googleapis.com/css?family=Fixture', allowedOrigins),
    ).toBe(true);
    expect(
      isAllowedSourceRequest('https://fonts.gstatic.com/s/roboto/fixture.woff2', allowedOrigins),
    ).toBe(true);
    expect(isAllowedSourceRequest('http://www.google.com/recaptcha/api.js', allowedOrigins)).toBe(
      false,
    );
    expect(isAllowedSourceRequest('https://example.com/recaptcha.js', allowedOrigins)).toBe(false);
    expect(() =>
      validateRenderRequest(sourceWithSubresource, {
        url: 'https://www.google.com/recaptcha/api.js',
        actions: [],
        readySelector: 'main',
        captureSelector: 'main',
      }),
    ).toThrow(/configured source HTTPS origin/);
  });

  it('blocks only known analytics endpoints without treating them as page failures', () => {
    expect(
      isNonessentialTrackingRequest('https://www.googletagmanager.com/gtag/js?id=G-EXAMPLE'),
    ).toBe(true);
    expect(isNonessentialTrackingRequest('https://www.google-analytics.com/g/collect?v=2')).toBe(
      true,
    );
    expect(isNonessentialTrackingRequest('http://www.googletagmanager.com/gtag/js')).toBe(false);
    expect(isNonessentialTrackingRequest('https://www.googletagmanager.com/gtm.js')).toBe(false);
    expect(isNonessentialTrackingRequest('https://example.com/gtag/js')).toBe(false);
  });

  it('blocks only the observed Carto map stylesheet as a nonessential page resource', () => {
    expect(
      isNonessentialPageResource('https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'),
    ).toBe(true);
    expect(isNonessentialPageResource('https://basemaps.cartocdn.com/tiles/1/2/3.png')).toBe(false);
    expect(isNonessentialPageResource('https://example.com/gl/positron-gl-style/style.json')).toBe(
      false,
    );
  });

  it('waits for one full pagination summary and matching table row count', () => {
    const selectors = { tableSelector: '#standings', summarySelector: 'main' };
    let summaryText = 'Rows per page: 1000 1-3 of 3';
    const table = {
      innerText: '',
      querySelector: () => null,
      querySelectorAll: (selector: string) => ({ length: selector === 'tbody tr' ? 3 : 0 }),
    };
    const summary = {
      innerText: summaryText,
      querySelector: () => null,
      querySelectorAll: () => ({ length: 0 }),
    };
    const documentRoot = {
      querySelector: (selector: string) =>
        selector === selectors.tableSelector
          ? table
          : selector === selectors.summarySelector
            ? summary
            : null,
    };
    expect(isPaginationComplete(selectors, documentRoot)).toBe(true);

    summaryText = 'Rows per page: 10 1-2 of 3';
    summary.innerText = summaryText;
    expect(isPaginationComplete(selectors, documentRoot)).toBe(false);

    summaryText = '1-3 of 3 1-3 of 3';
    summary.innerText = summaryText;
    expect(isPaginationComplete(selectors, documentRoot)).toBe(false);
  });

  it('runs explicit interactions in order with per-action timeout bounds', async () => {
    const calls: string[] = [];
    const page = {
      locator: (selector: string) => ({
        click: ({ timeout }: { timeout: number }) => {
          calls.push(`click:${selector}:${String(timeout)}`);
          return Promise.resolve();
        },
        selectOption: (value: string, { timeout }: { timeout: number }) => {
          calls.push(`select:${selector}:${value}:${String(timeout)}`);
          return Promise.resolve();
        },
        waitFor: ({ state, timeout }: { state: string; timeout: number }) => {
          calls.push(`wait:${selector}:${state}:${String(timeout)}`);
          return Promise.resolve();
        },
      }),
      waitForFunction: (
        _predicate: unknown,
        args: { tableSelector: string; summarySelector: string },
        { timeout }: { timeout: number },
      ) => {
        calls.push(`pagination:${args.tableSelector}:${args.summarySelector}:${String(timeout)}`);
        return Promise.resolve();
      },
    } as unknown as Page;
    await performRenderActions(
      page,
      [
        { kind: 'click', selector: '#expand' },
        { kind: 'select', selector: '#season', value: '2024' },
        { kind: 'wait', selector: '#results' },
        { kind: 'waitForPagination', tableSelector: 'table', summarySelector: 'main' },
      ],
      2500,
    );
    expect(calls).toEqual([
      'click:#expand:2500',
      'select:#season:2024:2500',
      'wait:#results:visible:2500',
      'pagination:table:main:2500',
    ]);
  });

  it('enforces bounded browser and capture limits, accounting for UTF-8 bytes', () => {
    expect(() => {
      validateRenderLimits({ ...limits, maxRequests: 1001 });
    }).toThrow(RangeError);
    expect(() => {
      validateRenderLimits({ ...limits, navigationTimeoutMs: 60_001 });
    }).toThrow(RangeError);
    expect(validateCapturedHtml('<p>ok</p>', 9)).toBe(9);
    expect(() => validateCapturedHtml('ááá', 5)).toThrow(SourceRenderError);
  });
});
