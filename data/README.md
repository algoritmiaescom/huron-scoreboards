# Competition data

This directory holds the competition archive as JSON, versioned alongside the code. The layout and
the meaning of every field are defined in [docs/data-model.md](../docs/data-model.md). Corrections
are submitted as pull requests; see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Two datasets

| Directory    | Contents                                                         |
| ------------ | ---------------------------------------------------------------- |
| `data/`      | The real archive: results transcribed from official scoreboards. |
| `data/mock/` | Seed data with invented results, used to exercise the app.       |

Both are validated by `npm run validate:data`, but they are validated **independently**: references
resolve within a single dataset, so a mock team can never satisfy a reference in the real archive
and mock records can never be served as history.

The real archive is currently empty. Transcribing an official scoreboard into it is the most
valuable contribution you can make.

## The mock dataset is not real

> [!WARNING]
> Every standing, team, roster and media post under `data/mock/` is **synthetic**. It was generated
> to exercise the schemas and the application, and it is **not** the record of any ICPC
> competition. Do not cite it, link to it, or copy it into `data/`.

Only the school names, locations and the overall contest structure resemble reality. Placements,
problem results, team rosters and posts are invented. Every `source`, `permalink` and media URL
points at `example.com`, which marks the record as having no verifiable origin.

The mock dataset is deliberately uneven, because the real archive will be too. Older seasons are
sparsely transcribed, recent ones are complete, and the current season is still being played. Every
optional field is missing somewhere, so rendering code cannot assume it is present.

| Season | What it exercises                                                                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2023   | Oldest record: no rosters at all, no problem titles, only two qualifiers, no repechage, no accumulated standing.                                           |
| 2024   | Mixed fidelity: some rosters, some problem titles, a shorter contest with a different penalty, a published standing covering only the teams that advanced. |
| 2025   | Fully documented: complete rosters, problem titles and links, every stage, a rich media feed.                                                              |
| 2026   | Season in progress: qualifiers played, repechage and final not yet held, an announced event with no posts.                                                 |

Edge cases the data covers on purpose:

- teams registered for a season that never appear in a contest, and schools that field no teams;
- rosters with a missing coach, a missing role, or only two contestants;
- teams that submitted nothing all contest, and teams that submitted but solved nothing;
- tied places, a problem nobody solved, a problem solved by exactly one team, and two teams
  sharing first-to-solve on the same minute;
- contests that differ in duration, penalty value and problem count;
- posts with no media, no title, no tags, or an author known only by username, plus an event with
  no location and no linked contest;
- schools with a committed logo, schools with a remotely hosted one, and ten of fifteen with none.

The 2026 final is announced but unplayed, so its event deliberately has no `contestId`: media can
reference a contest that does not exist in the archive yet.

The logos in `public/logos/` are **neutral placeholder monograms**, not the institutions' real
marks. They exist so the path-based logo branch has files to resolve against. Replace them with a
real logo the club is comfortable redistributing, or point the school at its own hosted copy.

## Adding real results

Add transcribed contests under `data/`, mirroring the layout in `data/mock/`. A record belongs in
the real archive only when:

- every result matches an official scoreboard, and
- `source` points at that official scoreboard rather than `example.com`.

Do not move files out of `data/mock/` to populate the archive. Mock results are invented, so they
must be re-transcribed from an official source rather than promoted.

## Validation

`npm run validate:data` checks both datasets against the Zod schemas and verifies cross-file
references. CI runs the same command on every pull request, so a change that breaks a reference
cannot merge.
