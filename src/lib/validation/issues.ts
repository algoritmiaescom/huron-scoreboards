import type { ZodError } from 'zod';

export interface ValidationIssue {
  /** Path of the data file the issue was found in, relative to the repository root. */
  file: string;
  /** Location within the file, such as `standings[3].results[1].attempts`. */
  location: string;
  message: string;
}

export const formatLocation = (path: readonly PropertyKey[]): string =>
  path.reduce<string>((location, segment) => {
    if (typeof segment === 'number') {
      return `${location}[${String(segment)}]`;
    }

    return location === '' ? String(segment) : `${location}.${String(segment)}`;
  }, '');

export const issuesFromZodError = (file: string, error: ZodError): ValidationIssue[] =>
  error.issues.map((issue) => ({
    file,
    location: formatLocation(issue.path),
    message: issue.message,
  }));

export const formatIssue = ({ file, location, message }: ValidationIssue): string =>
  location === '' ? `${file}: ${message}` : `${file} ${location}: ${message}`;

/** Groups issues by file so a contributor can fix one file at a time. */
export const formatIssues = (issues: readonly ValidationIssue[]): string => {
  const files = [...new Set(issues.map((issue) => issue.file))].sort((a, b) => a.localeCompare(b));

  return files
    .map((file) => {
      const lines = issues
        .filter((issue) => issue.file === file)
        .map((issue) => {
          const suffix = issue.location === '' ? '' : ` (${issue.location})`;

          return `  - ${issue.message}${suffix}`;
        });

      return [file, ...lines].join('\n');
    })
    .join('\n\n');
};
