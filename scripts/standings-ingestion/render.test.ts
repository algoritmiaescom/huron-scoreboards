import { describe, expect, it } from 'vitest';

import {
  isAllowedSourceRequest,
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
    } as unknown as Page;
    await performRenderActions(
      page,
      [
        { kind: 'click', selector: '#expand' },
        { kind: 'select', selector: '#season', value: '2024' },
        { kind: 'wait', selector: '#results' },
      ],
      2500,
    );
    expect(calls).toEqual([
      'click:#expand:2500',
      'select:#season:2024:2500',
      'wait:#results:visible:2500',
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
