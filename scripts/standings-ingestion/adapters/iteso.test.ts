import { describe, expect, it } from 'vitest';

import {
  detectITESODocumentType,
  discoverITESOAccumulatedPage,
  discoverITESOArchive,
  discoverITESOResultAsset,
} from './iteso';

const archiveHtml = `<!doctype html><html><body>
  <section>
    <h2>ICPC México 2025</h2>
    <a href="/acm/1-primera-fase-granpremiomx/">1.Primera Fase – Gran Premio MX</a>
    <a href="/acm/1-primera-fase-granpremiomx/sobre-los-concursos-del-granpremiomx2025/">Sobre los CONCURSOS del #GranPremioMX2025</a>
  </section>
  <section>
    <h2>ICPC México 2019</h2>
    <a href="/acm/1-primera-fase-gran-premio-de-mexico-2/sobre-los-concursos-del-granpremiomx2019/">Sobre los CONCURSOS del #GranPremioMX2019</a>
    <a href="/acm/1-primera-fase-gran-premio-de-mexico-2/sobre-los-concursos-del-granpremiomx2019/granpremiomx2019-resultado-acumulado/">#GranPremioMX2019 – Resultado Acumulado</a>
  </section>
  <section>
    <h2>ICPC México &amp; Centroamérica 2017</h2>
    <a href="/acm/1-primera-fase-gran-premio-de-mexico-y-centroamerica/sobre-los-concursos-del-gran-premio-2017/">Sobre los CONCURSOS del Gran Premio 2017</a>
    <a href="/acm/1-primera-fase-gran-premio-de-mexico-y-centroamerica/sobre-los-concursos-del-gran-premio-2017/resultado-acumulado-a-la-fecha-del-gran-premio-de-mexico-y-centroamerica-2017/">Resultado acumulado a la fecha del Gran Premio de México y Centroamérica 2017</a>
  </section>
</body></html>`;

describe('ITESO accumulated standings discovery', () => {
  it('associates overview and accumulated links with the exact sidebar season', () => {
    const result = discoverITESOArchive(archiveHtml);
    expect(result.editions).toEqual([
      {
        seasonYear: 2025,
        editionLabel: '2025',
        overviewUrl:
          'https://eventos.iteso.mx/acm/1-primera-fase-granpremiomx/sobre-los-concursos-del-granpremiomx2025/',
        accumulatedPageUrl: null,
        stagedLinks: [],
      },
      {
        seasonYear: 2019,
        editionLabel: '2019',
        overviewUrl:
          'https://eventos.iteso.mx/acm/1-primera-fase-gran-premio-de-mexico-2/sobre-los-concursos-del-granpremiomx2019/',
        accumulatedPageUrl:
          'https://eventos.iteso.mx/acm/1-primera-fase-gran-premio-de-mexico-2/sobre-los-concursos-del-granpremiomx2019/granpremiomx2019-resultado-acumulado/',
        stagedLinks: [],
      },
      {
        seasonYear: 2017,
        editionLabel: '2017',
        overviewUrl:
          'https://eventos.iteso.mx/acm/1-primera-fase-gran-premio-de-mexico-y-centroamerica/sobre-los-concursos-del-gran-premio-2017/',
        accumulatedPageUrl:
          'https://eventos.iteso.mx/acm/1-primera-fase-gran-premio-de-mexico-y-centroamerica/sobre-los-concursos-del-gran-premio-2017/resultado-acumulado-a-la-fecha-del-gran-premio-de-mexico-y-centroamerica-2017/',
        stagedLinks: [],
      },
    ]);
  });

  it('finds an accumulated-result page within the edition overview or reports it missing', () => {
    const overviewUrl = 'https://eventos.iteso.mx/acm/overview-2025/';
    expect(
      discoverITESOAccumulatedPage(
        '<article><a href="/acm/results-2025/">Resultado Acumulado Gran Premio 2025</a></article>',
        overviewUrl,
        2025,
      ),
    ).toEqual({
      status: 'found',
      seasonYear: 2025,
      overviewUrl,
      accumulatedPageUrl: 'https://eventos.iteso.mx/acm/results-2025/',
    });
    expect(
      discoverITESOAccumulatedPage('<article>No result yet</article>', overviewUrl, 2025),
    ).toEqual({
      status: 'missing',
      seasonYear: 2025,
      overviewUrl,
      accumulatedPageUrl: null,
      stagedLinks: [],
    });
  });

  it('follows the anchor enclosing the result image and upgrades only approved legacy origins', () => {
    const resultPageUrl = 'https://eventos.iteso.mx/acm/result/';
    const result = discoverITESOResultAsset(
      '<article><a href="http://acm.iteso.mx/share/standing.pdf"><img src="https://i0.wp.com/acm.iteso.mx/share/preview.jpg"></a></article>',
      resultPageUrl,
      ['https://acm.iteso.mx'],
    );
    expect(result).toEqual({
      status: 'found',
      resultPageUrl,
      assetUrl: 'https://acm.iteso.mx/share/standing.pdf',
      originalUrl: 'http://acm.iteso.mx/share/standing.pdf',
      thumbnailUrl: 'https://i0.wp.com/acm.iteso.mx/share/preview.jpg',
      linkText: '',
      upgradedToHttps: true,
    });
    expect(
      discoverITESOResultAsset(
        '<article><a href="http://acm.iteso.mx/share/standing.pdf"><img src="https://i0.wp.com/acm.iteso.mx/share/preview.jpg"></a></article>',
        resultPageUrl,
      ),
    ).toMatchObject({ status: 'staged', assetUrl: null });
  });

  it('dispatches based on response bytes and content type rather than file extension', () => {
    expect(
      detectITESODocumentType('application/octet-stream', new TextEncoder().encode('%PDF-1.7')),
    ).toMatchObject({
      type: 'pdf',
      signatureMatched: false,
    });
    expect(
      detectITESODocumentType('text/html', new TextEncoder().encode('<!doctype html>')),
    ).toMatchObject({
      type: 'html',
      signatureMatched: true,
    });
    expect(
      detectITESODocumentType('application/pdf', new TextEncoder().encode('<html>blocked</html>')),
    ).toMatchObject({ type: 'html', signatureMatched: false });
    expect(
      detectITESODocumentType(
        null,
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toMatchObject({ type: 'image', signatureMatched: false });
  });
});
