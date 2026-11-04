# Product scope

Huron Scoreboards is the public site of the algorithms club at Huron. Its goal is to preserve and
present the historical results of Mexican ICPC programming competitions, and to let the community
correct that record.

The site is read-only for visitors. There is no account system, no administration screen, and no
backend. All competition data is versioned in this repository and corrected through pull
requests.

## Competition model

A season holds two competitions. The Gran Premio de México (GPM) runs up to three qualifier
rounds plus a repechage, and its accumulated result decides which teams advance to the Final
Regional Mexicana:

```text
season (year)
├── GPM
│   ├── qualifier round 1
│   ├── qualifier round 2    (a season has up to three qualifiers)
│   ├── qualifier round 3
│   ├── repechage            (second chance for teams that missed advancement)
│   └── accumulated standing (determines who advances)
└── Mexico finals
    └── final                (single contest held after the GPM)
```

A contest belongs to exactly one season, one series, and one stage. A contest defines an ordered
set of problems when known. Detailed teams have one result per problem; historical teams may
instead have only published solved/penalty totals. Both can coexist in one standing. Fecha 0 is
a distinct, non-qualifying GPM stage, not qualifier 1.

Unknown dates, duration, penalty rules, problem details, and qualification are displayed as
unknown, never fabricated as zero, unattempted, or not qualified. An unknown problem set does not
claim zero problems. Published totals remain observations; inconsistent computable totals block
publication. Complete records retain their existing behavior.

Other competitions exist — Master Mexico, Donald Knuth, and the Girls Programming Challenge — and
are out of scope for the first version, but the model treats the series as an open set so they
can be added later as data.

See [data model](data-model.md) for the entities and their rules.

## Modules

### 1. Scoreboards

Shows the standings of a single contest and the historical performance of the schools that
competed.

**Standings table**

| Column          | Content                                                    |
| --------------- | ---------------------------------------------------------- |
| Place           | Final ranking of the team in the contest                   |
| Team            | Team name                                                  |
| School          | Institution the team represented                           |
| One per problem | Per-problem result, one column for each problem in the set |

Each problem cell communicates:

- the number of attempts the team made on that problem,
- whether and when the problem was accepted,
- whether the team was the first to solve the problem, and the timestamp of that solve.

**Filters**

Standings can be narrowed by team name, school, problem, accepted results, and first-to-solve
results. Filter state belongs in route and search parameters so a filtered view is shareable.

Without a selected problem, accepted-result filters can use a published solved count. With a
selected problem they require observed per-problem results. First-to-solve is suppressed whenever
any team lacks problem detail, so incomplete evidence cannot produce a first-solver claim.

**Route and selection contract**

The application uses `/scoreboards`, `/schools`, `/schools/:schoolId`, `/media`, and
`/contribute`. Once standings are released, `/` redirects to `/scoreboards`; unknown paths show
recovery rather than another page's content.

These are client routes under the URL hash on GitHub Pages; for example, the public school
index is `/huron-scoreboards/#/schools?q=UNAM`.

- A contest view uses `/scoreboards?contest=<id>`. Without an explicit selection, choose the
  latest archived contest whose date is not later than today's date in `America/Mexico_City`.
  Break equal-date ties by ascending contest id. If no held contests exist, show an empty archive.
  Undated historical contests remain explicitly selectable and appear in school histories, but
  are not eligible for latest-held selection. Media events use their own metadata.
- Accumulated views use `/scoreboards?season=<year>&series=<id>&view=accumulated`. They select a
  `SeasonStanding`, not a fabricated contest. Conflicting or incomplete selection parameters
  show a recovery message with an explicit action to choose a valid selection.
- Unknown contest, school, series, or problem values must not silently show unrelated data.
  Explain the invalid selection/filter and offer removal or navigation to available records.
- Team search (`team`) matches team names only, case-insensitively, not school names. `school`
  selects the exact competing school's id; institution rollups belong to school history.
- `problem` identifies a label in the selected contest. Alone it does not remove teams or hide
  columns; it scopes the `accepted=1` and `first=1` predicates. Without a selected problem, those
  predicates match any solved or first-solved problem respectively.
- Filters combine with AND semantics. First-to-solve is derived from the unfiltered contest.
  Invalid toggle values are explained rather than silently interpreted as a valid filter.
- Filter edits replace the current history entry; explicit selection changes create a history
  entry and clear incompatible filters. Removing a chip removes only its parameter. Clear-all
  retains the current selection, so reload, back/forward, and shared URLs reproduce the view.
- School links target the school that actually competed, including academic units. Unit
  histories provide a separate parent-institution link instead of silently redirecting to it.

These contracts keep selected data explicit, URLs shareable, and school identities unambiguous.

Released routes are `/scoreboards`, `/schools`, `/schools/:schoolId`, `/media`, `/contribute`,
root-to-standings redirection, and route recovery. The school index is accessible at `/schools`
through "Instituciones" in desktop and mobile navigation; school cards and school identities link
to the corresponding released history. The media feed is available at `/media` through
"Multimedia" in desktop and mobile navigation.
Contest selection and filters follow the contract above. The shared season/series/classification
picker advertises accumulated standings only where published records exist, including
standing-only seasons or series. Changing season/series retains accumulated mode when a record
exists; otherwise that explicit selection chooses an available contest. Direct missing accumulated
URLs show recovery, never a substitute contest.
Accumulated standings preserve published scores, places (including ties), and qualification
flags rather than computing an accumulation. Qualified rows have explicit text and icons.
A single cut is shown only between a qualified prefix and an entirely unqualified suffix,
never through a shared place or for qualified-only/noncontiguous records. Unknown qualification
has its own label and suppresses the cut. Empty rows have an
explicit state. Contest filters on accumulated URLs show an explanation and an action removing
only those filters; sharing, reload, and history preserve the accumulated selection. School
identities link to exact-school histories.

Invalid filters retain their chips and show specific removal actions without displaying
unrelated standings. Known schools without matching teams produce an empty result, not an
institution rollup. The share action copies the current URL only on success; unavailable or
rejected clipboard access opens a dialog with a selectable, read-only URL for manual copying.

**School history**

The school index uses responsive cards searchable by short/official name, city, or state.
Search is case-insensitive and ignores leading/trailing whitespace. Search state uses
`/schools?q=<query>`; edits replace history and reload/back/forward restore the same query.
Repeated or unknown parameters require explicit recovery, without showing unrelated cards.
The directory distinguishes an empty school archive, no search matches, and schools without
contest results. Zero-result schools remain discoverable with "Sin resultados", not an invented
placement. Optional locations/logos do not produce missing-value strings or broken images.

Records without a parent summarize their own results and all transitive descendants; records
with a parent show only that school's exact results. Cards explain this scope and count
registered descendants for institution summaries. A result is one team's row in one contest;
distinct contest counts are shown separately. Best placement uses those official contest places,
including ties. Accumulated standings and teams registered without results do not inflate either
metric. Cards link to the corresponding school history.

Every school has a page summarizing contest results across seasons, with separate exact-school and
institution-descendant scopes. Participation and best-place statistics and trend points use
contest rows only. Podium totals, seasonal counts and highlights include published places 1–3
from all contest stages (including Mexico Finals) and accumulated standings, including ties.
Each team's podium row counts once per contest or accumulated standing; non-final accumulated
highlights disclose their snapshot status. Accumulated-only seasons retain their podiums without
inventing contest participation or trend points. Responsive trend charts reverse the place axis
and provide exact seasonal values as accessible text. Podium highlights link to their contest or
accumulated standing; rosters and contest-result cards link to the selected contest.
Unit histories provide a parent-institution link without changing the default exact
scope. Empty histories, unknown schools, invalid scope parameters, absent rosters, and repository
errors are explicit states.

### 2. Media feed

The `/media` page presents curated public posts from archived media events, including upcoming
events and events without a scoreboard contest. It defaults to the event with published posts
having the latest event date, then ascending event id. Only explicitly referenced posts whose
`postedAt` is not later than the current instant are displayed, in curated order. If no event has
published posts, select the newest event and show an explicit empty state.

Visitors can select other events with published posts through `/media?event=<id>`; removing the
parameter returns to the default event. An explicit event with no published posts remains empty.
Legacy `/media?contest=<id>` links select that contest's newest linked event without requiring a
held or known contest date; a valid contest without media stays empty. Unknown, repeated, or mixed
event/contest selections produce an explicit recovery message, not a fallback. Classification
links are shown only when the selected event has a validated contest reference.

Cards support optional author/profile metadata, title, media assets, and tags, with accessible
carousel controls, native video playback, and an original-post link. Repository-backed mode must
not claim live updates or an API outage. A future live integration is a separate architectural
milestone; the post presentation and loading/empty/error states remain reusable for it.

Posts are collected through Juicer outside the browser, archived as JSON, and published only
after a pull request is reviewed and merged. The feed is a reviewed snapshot, not a real-time
stream. Maintainers may also curate posts directly. See [media ingestion](media-ingestion.md).

### 3. Contribution

A guide explaining how to add missing contests and correct existing results. Contribution happens
entirely through this GitHub repository: contributors edit the versioned data files and open a
pull request. The guide documents the data format, the review expectations, and the evidence
required to change a published result.

## Visual identity

The theme derives from the club logo and the ICPC logo. The palette is tracked in
[design](design.md), not in an ADR.

## Out of scope for now

- Live or in-contest scoring.
- Authentication, roles, and in-app data editing.
- A backend service or hosted database.
