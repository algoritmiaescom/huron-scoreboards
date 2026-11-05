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

The real archive contains 34 contest scoreboards from the 2009–2026 seasons, totaling 12,374
contest rows, plus 12 accumulated GPM standings with 4,800 rows:

| Season | Contests | Contest rows | Accumulated rows |
| ------ | -------- | ------------ | ---------------- |
| 2009   | 1        | 163          | —                |
| 2010   | 1        | 199          | —                |
| 2011   | 1        | 160          | —                |
| 2012   | 1        | 163          | —                |
| 2013   | 1        | 174          | —                |
| 2014   | 1        | 61           | —                |
| 2015   | 1        | 80           | 306              |
| 2016   | 1        | 89           | 273              |
| 2017   | 1        | 88           | 404              |
| 2018   | 1        | 97           | 393              |
| 2019   | 1        | 53           | 382              |
| 2020   | 1        | 57           | 350              |
| 2021   | 2        | 819          | 225              |
| 2022   | 5        | 1,802        | 381              |
| 2023   | 4        | 1,999        | 458              |
| 2024   | 4        | 2,302        | 482              |
| 2025   | 4        | 2,156        | 532              |
| 2026   | 3        | 1,912        | 614              |

Contest files are organized under `data/seasons/<year>/`. School identities use reviewed
canonical records where supported by the source and review notes. Other non-empty source labels
are preserved literally as separate school records rather than merged by guesswork; 95 teams have
`schoolId: null` because their source did not identify an institution, and the scoreboard displays
“Institución no identificada” for them. The school directory now contains 1,067 records.

The 2026 GPM archive contains qualifiers 1, 2 and 3 from ICPC Mexico: 601, 701 and 610 rows.
The first two tables have confirmed published row counts and problem detail. The third publishes
only solved/penalty totals and does not display its registered-team count: all 610 visible source
rows are preserved, but completeness beyond that table is not asserted. Its date, August 29, comes
from the official contest index; durations remain unknown. Fecha 0 and repechage are not included
in this qualifier import. Literal school labels and international participants are retained.

The 2026 accumulated standing is transcribed from ICPC Mexico's separate accumulated table,
which states that all three scoring dates are computed. All 614 ranked rows are retained,
including the 509 teams with points and the 105 zero-point teams tied at place 510. The 14
guest teams listed separately have neither accumulated places nor scores and are not given
invented values. Only the 70 explicit numeric quota assignments are marked `qualified: true`;
the other 544 flags remain unknown rather than being treated as definitive rejections. The
source headline reports 71 assigned quotas, but the ranked table displays only 70; this
discrepancy is disclosed without inventing an assignment. The snapshot remains `unconfirmed`
because the source does not explicitly identify it as final. Exact unique team/school pairs
reuse existing season registrations; other source identities remain separate.

The 2019–2025 Finals now use ScoreLATAM's Mexico-only groups rather than ICPC Mexico's
LATAM-wide tables. Every selected source row explicitly identifies country `/MX` in User/Site.
The published Mexico-group places are preserved, including ties; they are not invented ranks
obtained by subtracting foreign teams from the previous archive. CCL classifications are separate
and are not appended to the Mexico group. Existing team IDs, school assignments and registrations
are retained, including registrations no longer appearing in these Finals; GPM results and mock
data are unchanged. No country is guessed from a team name or assigned to an unidentified school.

| Season | Previous Finals rows | Mexico-group rows | Source                                                            |
| ------ | -------------------- | ----------------- | ----------------------------------------------------------------- |
| 2019   | 368                  | 53                | [ScoreLATAM 2019](https://scorelatam.naquadah.com.br/latam-2019/) |
| 2020   | 302                  | 57                | [ScoreLATAM 2020](https://scorelatam.naquadah.com.br/latam-2020/) |
| 2021   | 273                  | 52                | [ScoreLATAM 2021](https://scorelatam.naquadah.com.br/latam-2021/) |
| 2022   | 329                  | 55                | [ScoreLATAM 2022](https://scorelatam.naquadah.com.br/latam-2022/) |
| 2023   | 424                  | 55                | [ScoreLATAM 2023](https://scorelatam.naquadah.com.br/latam-2023/) |
| 2024   | 516                  | 116               | [ScoreLATAM 2024](https://scorelatam.naquadah.com.br/latam-2024/) |
| 2025   | 593                  | 133               | [ScoreLATAM 2025](https://scorelatam.naquadah.com.br/latam-2025/) |

The 2019 and 2020 layouts label Mexico's group `mxmx`; country membership is still checked
against `/MX`, not inferred from that code alone. The 2020 and 2021 pages lack an explicit
final-state heading: all selected teams and totals were corroborated against ICPC Global's
published Finals. ScoreLATAM's distinct zero-score places are retained even where Global reports
ties. This manual review does not change automatic publication-state gates. Seven rows
(three in 2023, one in 2024, three in 2025) preserve published totals with `results: null` because
the available detail does not reproduce those totals with the recorded penalty rule. Dates and
durations remain unknown where not established by the selected scoreboard.

The 2019 archive also contains the ITESO accumulated GPM table, with all 382 rows and 79 source
institution labels. Nineteen labels match one existing school record exactly; the other 60 are
preserved as literal school records because no single exact match was available. Its official PDF
describes the points as accumulated through the third date but does not explicitly identify the
table as the final result. The record is therefore marked `snapshot: "unconfirmed"` and labeled
“Acumulado hasta la tercera fecha”; the scoreboard displays that caveat. Every published point
total matches the three date totals plus any community points shown in the source. Five teams reuse
2019 Finals registrations where both the team name and unique exact school match; no other teams
were merged by name alone. ITESO's season overview does not expose a 2020 accumulated-result
page, but ICPC Global links directly to its official accumulated PDF, now archived.

The recovered ITESO accumulated documents for 2015–2025 are published with explicit snapshot
labels. Except for the 2023 intermediate table, they remain `unconfirmed`, not asserted final.
The 2023 source covers only the first two dates; no third-date or repechage points are inferred.
The 2015 source uses dense ranking: ties at 155, 197 and 239 do not skip the following places.
All 306 rows survive, including both FGZ registrations. The 2024 GooseFarmers and Timbits pairs
have different source registration IDs and remain separate teams. Source annotations, including
2018 account-use and ineligibility notices, appear in publication notes.

The 2009–2018 Finals were transcribed from the complete paginated ICPC Global native tables.
These historical events cover Mexico **and Central America**; no country-based filtering was
applied. All rows retain published totals without invented problem detail or contest metadata.
In 2013 the source omits place 13 and leaves 81 of its 174 rows unranked. Its explicitly documented
`ranking: "published"` preserves that gap and uses `place: null` for the unknown places. Such rows
display “No publicado”, count as participation, and never create podiums or fabricated best places.

The country audit queried the Global native standings and finder views for all 2009–2026 seasons,
ICPC Mexico's contest index and all available Finals, ScoreLATAM's seven listed LATAM editions,
and both ITESO indexes. ITESO is an accumulated-source adapter, not a Finals adapter.
Global's public standings projection does not expose complete row-level countries, even when
`country` and `countryCode` are requested. Geographic medal citations cover only a few historical
rows and cannot classify the whole table. Consequently 2009–2018 remain unresolved and unchanged;
the archive is not yet entirely Mexico-only. No 2026 Finals standing is available.

The separate Global native tables for 2019–2025 differ from ScoreLATAM's Mexico groups in
coverage, including CCL and unranked rows. They were not appended to those groups. Native Global GPM
rows are not accumulated-point standings and are not published as such. Older directory entries
may link to external results even when their native standings are empty; an empty table is not
proof that no historical results exist.

The 2023 GPM repechage retains all 1,157 published places. For 49 rows, per-problem details
conflict with the published totals, so those rows preserve the published solved and penalty totals
with `results: null`; the other rows retain their available detail. The 2022 GPM repechage also
retains all 163 published rows, including international participants and tied places. Its date
and duration were unavailable on the source scoreboard and remain `null`.

Real media events and their posts also live here, under `media/events/`. Juicer ingestion appends
posts through reviewed PRs; see [setup and operation](../docs/media-ingestion.md). No real event
is enabled by default, and ingestion never promotes mock data.

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

| Season | What it exercises                                                                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2023   | Partial history: totals-only qualifier 1 with unknown metadata/problem set, mixed-detail qualifier 2 with an unknown penalty; no rosters, repechage, or accumulated standing. |
| 2024   | Mixed fidelity: some rosters, some problem titles, a shorter contest with a different penalty, a published standing covering only the teams that advanced.                    |
| 2025   | Fully documented: complete rosters, problem titles and links, every stage, a rich media feed.                                                                                 |
| 2026   | Season in progress: qualifiers played, repechage and final not yet held, an announced event with no posts.                                                                    |

Edge cases the data covers on purpose:

- teams registered for a season that never appear in a contest, and schools that field no teams;
- rosters with a missing coach, a missing role, or only two contestants;
- teams that submitted nothing all contest, and teams that submitted but solved nothing;
- tied places, a problem nobody solved, a problem solved by exactly one team, and two teams
  sharing first-to-solve on the same minute;
- contests that differ in duration, penalty value and problem count;
- totals-only rows with preserved solved/penalty totals and explicitly unknown contest metadata;
- mixed-detail standings with unavailable problem cells and an unknown published penalty;
- posts with no media, no title, no tags, or an author known only by username, plus an event with
  no location and no linked contest;
- schools with a committed logo, schools with a remotely hosted one, and ten of fifteen with none.

The 2026 final is announced but unplayed, so its event deliberately has no `contestId`: media can
reference a contest that does not exist in the archive yet.

Partial-history examples are directly selectable in mock mode:

- `/scoreboards?contest=2023-gpm-qualifier-1`: all 12 teams retain their original synthetic places
  and totals, but date, duration, penalty rule, and per-problem detail are unavailable.
- `/scoreboards?contest=2023-gpm-qualifier-2`: the leading team has only its solved total and an
  explicitly unknown penalty; other teams retain complete problem detail. No first-solve claims
  are made from this incomplete evidence.

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
