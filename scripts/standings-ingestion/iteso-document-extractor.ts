import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { z } from 'zod';

import type { ITESOExtractedPage } from './adapters/iteso-document';

const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_PAGES = 80;
const runFile = promisify(execFile);

const extractedRowSchema = z
  .object({
    cells: z.array(z.string().max(2000)).max(100),
    confidences: z.array(z.number().min(0).max(1).nullable()).max(100),
  })
  .strict()
  .refine((row) => row.cells.length === row.confidences.length);

const extractedPageSchema = z
  .object({
    pageNumber: z.number().int().positive(),
    method: z.enum(['text', 'ocr']),
    text: z.string().max(100_000),
    tables: z.array(z.object({ rows: z.array(extractedRowSchema).max(2000) }).strict()).max(20),
  })
  .strict();

const extractedDocumentSchema = z
  .object({
    version: z.literal(1),
    pageCount: z.number().int().positive().max(MAX_PAGES),
    pages: z.array(extractedPageSchema).max(MAX_PAGES),
  })
  .strict()
  .refine((document) => document.pages.length === document.pageCount)
  .refine((document) => document.pages.every((page, index) => page.pageNumber === index + 1));

export type ITESOExtractedDocument = z.infer<typeof extractedDocumentSchema>;

export const extractITESODocument = async (
  body: Uint8Array,
  type: 'pdf' | 'image',
  repositoryRoot: string,
): Promise<ITESOExtractedDocument> => {
  if (body.byteLength === 0 || body.byteLength > MAX_INPUT_BYTES) {
    throw new RangeError(`ITESO document must be between 1 and ${String(MAX_INPUT_BYTES)} bytes.`);
  }
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'huron-iteso-'));
  const inputPath = path.join(temporaryDirectory, type === 'pdf' ? 'source.pdf' : 'source.img');
  try {
    await writeFile(inputPath, body);
    const scriptPath = path.join(
      repositoryRoot,
      'scripts/standings-ingestion/iteso_document_extract.py',
    );
    const projectPath = path.join(repositoryRoot, 'scripts/standings-spike');
    const { stdout } = await runFile(
      'uv',
      [
        'run',
        '--locked',
        '--project',
        projectPath,
        'python',
        scriptPath,
        '--input',
        inputPath,
        '--kind',
        type,
      ],
      {
        timeout: 180_000,
        maxBuffer: MAX_OUTPUT_BYTES,
        encoding: 'utf8',
      },
    );
    return extractedDocumentSchema.parse(JSON.parse(stdout) as unknown);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local PDF/OCR extraction failed.';
    throw new Error(`Local ITESO document extraction failed: ${message}`, { cause: error });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};

export const extractedPages = (document: ITESOExtractedDocument): ITESOExtractedPage[] =>
  document.pages;
