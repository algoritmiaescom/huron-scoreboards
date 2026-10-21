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
set of problems, and each participating team has one result per problem.

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

**Route and selection contract**

The application uses `/scoreboards`, `/schools`, `/schools/:schoolId`, `/media`, and
`/contribute`. Once standings are released, `/` redirects to `/scoreboards`; unknown paths show
recovery rather than another page's content.

- A contest view uses `/scoreboards?contest=<id>`. Without an explicit selection, choose the
  latest archived contest whose date is not later than today's date in `America/Mexico_City`.
  Break equal-date ties by ascending contest id. If no held contests exist, show an empty archive.
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

Released routes are `/scoreboards`, `/contribute`, root-to-standings redirection, and route recovery.
The school index is accessible at `/schools` through "Instituciones" in desktop and mobile
navigation; individual history links are staged until history destinations are implemented.
Contest selection and filters follow the contract above. The shared season/series/classification
picker advertises accumulated standings only where published records exist, including
standing-only seasons or series. Changing season/series retains accumulated mode when a record
exists; otherwise that explicit selection chooses an available contest. Direct missing accumulated
URLs show recovery, never a substitute contest.
School histories and media screens remain unreleased; navigation does not advertise unfinished routes.

Accumulated standings preserve published scores, places (including ties), and qualification
flags rather than computing an accumulation. Qualified rows have explicit text and icons.
A single cut is shown only between a qualified prefix and an entirely unqualified suffix,
never through a shared place or for qualified-only/noncontiguous records. Empty rows have an
explicit state. Contest filters on accumulated URLs show an explanation and an action removing
only those filters; sharing, reload, and history preserve the accumulated selection. School
identities remain unlinked until their history destinations are released.

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
metric. Cards remain noninteractive until school histories are available.

Every school has a page summarizing its results across seasons, using charts for performance
trends and podium displays for its best placements (the next implementation milestone).

### 2. Media feed

A page that collects public media posts published under the hashtag of the most recent contest,
so the site reflects the live reaction around the competition that just took place.

For the initial port, posts come only from validated repository records. Select the latest held
archived contest using the date/id rule above, then its linked media event (latest event date,
then ascending event id if several exist), considering only events dated today or earlier in
`America/Mexico_City`. Display only its referenced posts. If that contest has no eligible event,
show an explicit empty state rather than posts from a different contest or an upcoming event.
Unlinked announced events remain valid archive data but do not replace this feed.

Repository-backed mode must not claim live updates or an API outage. A future live integration
is a separate architectural milestone; the post presentation and loading/empty/error components
remain reusable for it.

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
- Hosting and deployment configuration.
