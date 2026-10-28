# Data model

Planning document for the scoreboards and media features. It defines the entities, what is
stored versus derived, and the rules a contributor must satisfy. Types here are sketches, not the
final source.

Decisions that shape the structure of the system belong in `docs/adr/`; this document records the
domain itself.

## Naming

The word "competition" is ambiguous, so it is not used as a type name:

| Term        | Meaning                                                            |
| ----------- | ------------------------------------------------------------------ |
| **Season**  | One year of competition.                                           |
| **Series**  | A recurring competition within a season: GPM or the Mexico Finals. |
| **Contest** | One scored event with its own problem set and standings.           |

```text
Season 2024
├── Series: GPM
│   ├── Contest: qualifier 1
│   ├── Contest: qualifier 2
│   ├── Contest: qualifier 3
│   ├── Contest: repechage
│   └── SeasonStanding: accumulated GPM result, determines who advances
└── Series: Mexico Finals
    └── Contest: final
```

Master Mexico, Donald Knuth, and the Girls Programming Challenge are additional series. They are
out of scope for the MVP, but `Series` is an open set so they can be added as data rather than as
new types.

## Identifiers

Identifiers are human-readable slugs, because they appear in routes and in data files and must
stay stable when a name changes.

| Entity  | Format                      | Example           |
| ------- | --------------------------- | ----------------- |
| Season  | year                        | `2024`            |
| Series  | slug                        | `gpm`             |
| Contest | `<season>-<series>-<stage>` | `2024-gpm-q1`     |
| School  | slug                        | `ipn-escom`       |
| Team    | `<season>-<slug>`           | `2024-los-ositos` |

## Scoreboards

### School

Schools are the stable identity in the model. Team names and rosters change every year; school
history pages depend on schools outliving them.

Academic units that compete separately are separate schools. `parentInstitutionId` is optional
and exists so a history page can roll several units up to one institution, without forcing a
two-level model on schools that have no units.

```ts
type School = {
  id: string; // 'ipn-escom'
  officialName: string; // 'Escuela Superior de Cómputo del Instituto Politécnico Nacional'
  shortName: string; // 'ESCOM'
  parentInstitutionId?: string; // 'ipn'
  city?: string;
  state?: string;
  logo?: string; // 'logos/ipn-escom.svg' or 'https://…'
};
```

`logo` is optional and holds either a file committed under `public/` and referenced by the path
the site serves it from, such as `logos/ipn-escom.svg`, or an absolute `https` URL to a logo the
school hosts itself. One field covers both because a school has one logo; which storage it uses is
a hosting detail, not a modelling distinction.

Only `https` is accepted for remote logos. A general URL check also accepts `javascript:` and
`data:`, and this value is rendered as an image source, so community-contributed data must not be
able to introduce either; `http` would load as mixed content. The logo component re-checks the
value and shows the fallback icon for anything the schema would reject.

Logos are not required, and most schools will not have one. Every view that shows a school must
render without a logo rather than reserving a broken image. No alt text is stored: it is derived
from the school name, unlike media posts, where it cannot be.

An institution such as `unam` or `ipn` is a `School` record that no team competes under directly.
Rolled-up history must make clear whether it is showing a unit or an institution.

### Team

A team is a per-season registration, not an entity that persists across years. Do not attempt to
thread a team's identity through multiple seasons; aggregate by school instead.

Rosters are optional: member names are personal data and are often unavailable for older
contests, so a contest can be published without them.

```ts
type Team = {
  id: string;
  name: string;
  schoolId: string;
  seasonYear: number;
  members?: TeamMember[];
};

type TeamMember = {
  name: string;
  role?: 'contestant' | 'coach';
};
```

### Contest

```ts
type Contest = {
  id: string;
  seasonYear: number;
  seriesId: string; // 'gpm' | 'mexico-finals'
  stage: 'qualifier-1' | 'qualifier-2' | 'qualifier-3' | 'repechage' | 'final';
  name: string;
  date: string; // ISO date
  durationMinutes: number; // typically 300
  penaltyMinutesPerFailedAttempt: number; // typically 20
  problems: Problem[];
  standings: StandingRow[];
  source: string; // URL of the official scoreboard this data came from
};

type Problem = {
  label: string; // 'A'
  title?: string;
  url?: string;
};
```

`source` is required. Every published contest must be traceable to the official scoreboard it was
transcribed from, because the data is community-contributed.

`penaltyMinutesPerFailedAttempt` is stored per contest rather than assumed, because the rule has
not been constant across contests. Penalty must always be computed from the contest's own value;
never hard-code 20 in domain code or components.

### Standings and problem results

A problem cell is a discriminated union so that contradictory states — a solve time with no
attempts, attempts on an unattempted problem — cannot be represented.

```ts
type StandingRow = {
  place: number;
  teamId: string;
  results: ProblemResult[]; // one per contest problem, in problem order
};

type ProblemResult =
  | { status: 'unattempted' }
  | { status: 'attempted'; attempts: number }
  | { status: 'solved'; attempts: number; solvedAtMinute: number };
```

**`attempts` counts every judged submission, including the accepted one.** A problem solved on
the first try has `attempts: 1`. This definition must appear in the contribution guide; it is the
field most likely to be entered inconsistently.

### Stored versus derived

| Value                    | Source  | Rule                                                          |
| ------------------------ | ------- | ------------------------------------------------------------- |
| `place`                  | Stored  | Official result. Tie-breaks are not always reproducible.      |
| `attempts`, solve time   | Stored  | Transcribed from the official scoreboard.                     |
| Penalty rule             | Stored  | `penaltyMinutesPerFailedAttempt`; it varies between contests. |
| Solved count             | Derived | Number of `solved` results in the row.                        |
| Penalty                  | Derived | See the formula below; uses the contest's own penalty rule.   |
| First to solve           | Derived | Minimum `solvedAtMinute` for that problem across the contest. |
| GPM accumulated standing | Stored  | Official published result; see below.                         |

Penalty for a team is the sum, over the problems it solved, of:

```text
solvedAtMinute + penaltyMinutesPerFailedAttempt * (attempts - 1)
```

`attempts - 1` is the number of failed submissions, since `attempts` includes the accepted one.
Unsolved problems contribute nothing. The multiplier comes from the contest being displayed, so
two contests in the same season may rank identical results differently.

First to solve is derived so it cannot drift out of agreement with the solve times. Because
times are minute-resolution, **ties are possible and the model must allow several first solvers
on one problem**. Treat it as a set of team IDs per problem, not a boolean on one row.

Derived values are computed in the domain layer, not stored in data files and not recomputed in
components.

### Season standing

The accumulated GPM result decides who advances to the Finals. It is stored as published rather
than computed: the accumulation rule is the organizers' and has varied between seasons, so
computing it risks displaying a number that disagrees with the official record.

```ts
type SeasonStanding = {
  seasonYear: number;
  seriesId: string;
  rows: {
    place: number;
    teamId: string;
    score: number;
    qualified: boolean;
  }[];
  source: string;
};
```

## Media

The media feature owns its own types. Per the feature boundary rule in
[architecture](architecture.md), it must not import scoreboards types; `Event` therefore carries
its own display fields and refers to a contest only by an optional, loose id.

```ts
type Event = {
  id: string;
  name: string;
  date: string;
  hashtag: string;
  location?: string;
  contestId?: string; // loose reference, not a scoreboards import
  postIds: string[];
};

type Post = {
  id: string;
  source: 'x' | 'instagram' | 'facebook' | 'youtube' | 'linkedin';
  author: {
    username: string;
    displayName?: string;
    avatarUrl?: string;
    profileUrl?: string;
  };
  postedAt: string; // ISO timestamp
  title?: string;
  body: string;
  media: PostMedia[];
  permalink: string;
  tags: string[];
};

type PostMedia = {
  type: 'image' | 'video';
  url: string;
  alt: string; // required
};
```

Notes on the shape:

- Social posts have a body, not a title/subtitle/description triple. `title` is optional and only
  for sources that genuinely have one.
- `media` and `tags` are arrays: posts carry carousels and several hashtags.
- **`alt` is a required string but may be empty.** Ingestion preserves upstream descriptions and
  uses `""` when unavailable; contributors can improve them. Empty descriptions do not mean
  informative media is decorative. [Accessibility](accessibility.md) remains a release requirement.
- `permalink` is mandatory so the original post is always attributable.

### Ingested and curated posts share one archive

Posts are collected outside the browser through configured Juicer feeds, direct hashtag lookup,
or both, then normalized into the same validated `Post` used by curated records. GitHub Actions
proposes append-only changes for review; the browser will read the merged archive through a
repository interface, never branch on origin or call Juicer.

Existing posts and manual edits are preserved. Stable event-scoped IDs allow the same upstream
post to belong to multiple events without violating global uniqueness. Duplicates within an event
are detected by identity or canonical permalink. Remote media is referenced, not downloaded.

See [ADR 0006](adr/0006-ingest-media-through-reviewed-pull-requests.md) for the integration decision
and [media ingestion](media-ingestion.md) for configuration, limitations, and setup. This does not
introduce server state into the browser or require an asynchronous state library.

## Storage

Data is stored as JSON under a top-level `data/` directory. It is content, not source, so it sits
outside `src/` where contributors can find it without reading application code.

```text
data/
  schools.json                     Registry of every school and institution
  seasons/
    2024/
      teams.json                   Teams registered that season
      gpm/
        qualifier-1.json           One Contest per file
        qualifier-2.json
        qualifier-3.json
        repechage.json
        standing.json              Accumulated GPM result
      mexico-finals/
        final.json
  media/
    events/
      2024-mexico-finals.json      Event plus its curated posts
  mock/                            Seed data, same layout, invented results
```

School logos are the one exception to data living under `data/`. They are static assets the
browser requests by URL, so the files sit in `public/logos/` and the data stores only the path:

```text
public/
  logos/
    ipn-escom.svg                  Referenced as `logos/ipn-escom.svg`
```

One contest per file keeps pull requests reviewable: a correction touches one file, and the diff
shows exactly which contest changed. Schools and teams are shared registries because they are
referenced across contests and must not be duplicated.

JSON is verbose for a wide standings table, which is the cost of this choice. Mitigate it with
compact per-row encoding and clear validation errors rather than by inventing a bespoke format.
Keys are stable, so avoid reordering them in unrelated changes to keep diffs readable.

### Mock data is a separate dataset

`data/mock/` repeats the layout above with invented results, so the application has something to
render before contests are transcribed. It is a sibling dataset, not a staging area: references are
resolved within one dataset, so a mock record can never satisfy a reference in the real archive.
Every mock `source` points at `example.com` to mark it as having no verifiable origin. See
[data/README.md](../data/README.md).

## Validation

All data is community-contributed and untrusted, so it is validated in two places for two
different reasons.

**In CI, before a change is merged.** A GitHub Actions job runs `npm run validate:data`, a script
that parses every file under `data/` with its Zod schema and then checks references across files.
A pull request that would publish broken data fails before review. This is the gate that makes
pull-request contribution workable: a contributor gets a specific error instead of a reviewer
guessing.

**At runtime, in the repository layer.** The same schemas parse data when the application loads
it, so a type is never asserted over unparsed JSON. Validate at the repository boundary, never in
components, and surface invalid data explicitly rather than silently dropping it.

The schemas are the single source shared by both paths. Domain types are inferred from them with
`z.infer`, so a schema and its type cannot drift apart.

### Schema checks

Per record, within one file:

- required fields are present and well-typed;
- `attempts` is at least 1 whenever a problem is attempted or solved;
- `solvedAtMinute` falls within the contest's `durationMinutes`;
- `penaltyMinutesPerFailedAttempt` is present and not negative;
- identifiers match the documented slug format;
- dates are valid ISO dates;
- `alt` is present on every post media item;
- `place` values form a sensible ranking, allowing shared places for ties.

### Cross-reference checks

These span files and cannot be expressed in a single schema, so the script runs them after
parsing everything:

- every `schoolId` on a team resolves to a school in `data/schools.json`;
- every `parentInstitutionId` resolves to a school, and no cycles exist;
- every `teamId` in a standing resolves to a team registered in that season;
- every `contestId` and `postId` reference resolves;
- `results` has exactly one entry per contest problem, in problem order;
- problem labels are unique within a contest;
- identifiers are unique within their registry;
- one accumulated standing exists per season/series, and an event cannot repeat a post reference;
- a contest's `seasonYear` and `seriesId` agree with its path under `data/`;
- a team's `seasonYear` agrees with the season of its registry file;
- a committed `logo` path points at a file that exists under `public/`.

Only the validation script checks the logo file, because the same validators also run in the
browser, where there is no filesystem. Remote logos are not fetched: that would need the network,
and CI must not depend on a third-party host being up.

### Reporting

The script validates every file and reports all failures at once, rather than stopping at the
first. It prints the file path, the location within the file, and what was expected. A
contributor fixing a transcription error should not have to re-run CI once per mistake.

Exit non-zero on any failure.

Runtime repositories return explicit `ready`, `empty`, `invalid`, or `error` results. Both
invalid records and load failures retain file/record diagnostics; neither exposes a partially
loaded archive. A missing record in a valid archive is a separate `not-found` lookup result.
Mock and real references are always resolved independently.

Domain selectors preserve official places and stored accumulated scores. School history
defaults to the exact competing school; institution scope explicitly includes all descendants
once. Teams remain season-scoped. Per-season contest counts, best place, and podium counts use
contest rows, not accumulated standings. Accumulated-only seasons remain visible, with no
invented best contest place; team counts include either kind of published participation.

## Open questions

- **Scoring details for older seasons**, including the penalty value each contest actually used
  and whether contest duration differed.
- **Platform coverage**, which depends on the Juicer account and the availability of upstream
  sources; the current schema supports X, Instagram, Facebook, YouTube, and LinkedIn.
