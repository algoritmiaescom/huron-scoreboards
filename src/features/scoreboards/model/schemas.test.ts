import { describe, expect, it } from 'vitest';

import { schoolSchema } from './schemas';

const school = {
  id: 'ipn-escom',
  officialName: 'Escuela Superior de Cómputo',
  shortName: 'ESCOM',
};

const parseLogo = (logo: string) => schoolSchema.safeParse({ ...school, logo });

describe('schoolSchema logo', () => {
  it('is optional, because most schools have no logo on file', () => {
    const result = schoolSchema.safeParse(school);

    expect(result.success).toBe(true);
    expect(result.data?.logo).toBeUndefined();
  });

  it.each(['logos/ipn-escom.svg', 'logos/udg-cucei.png', 'logos/unam.webp'])(
    'accepts the committed logo path %s',
    (logo) => {
      expect(parseLogo(logo).success).toBe(true);
    },
  );

  it('accepts a remote https logo', () => {
    expect(parseLogo('https://example.com/logo.svg').success).toBe(true);
  });

  it.each([
    // Rendered as an image source, so a scheme that can execute must never validate.
    'javascript:alert(1)',
    'data:image/svg+xml,<svg onload=alert(1) />',
    // Would load as mixed content.
    'http://example.com/logo.png',
    // Must stay inside public/logos.
    '../../etc/passwd',
    'logos/../../secrets.svg',
    '/logos/ipn-escom.svg',
    'public/logos/ipn-escom.svg',
    // Filenames are slugs with a known image extension.
    'logos/Bad_Name.svg',
    'logos/ipn-escom.JPG',
    'logos/ipn-escom.exe',
    'logos/ipn-escom',
  ])('rejects %s', (logo) => {
    expect(parseLogo(logo).success).toBe(false);
  });
});
