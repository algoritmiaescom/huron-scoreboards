# Product scope

Huron Scoreboards is the public site of the algorithms club at Huron. Its goal is to preserve and
present the historical results of Mexican ICPC programming competitions, and to let the community
correct that record.

The site is read-only for visitors. There is no account system, no administration screen, and no
backend. All competition data is versioned in this repository and corrected through pull
requests.

## Competition model

The Mexican ICPC season repeats yearly and is the backbone of the data model:

```text
season (year)
├── qualifier round 1
├── qualifier round 2        (a season has up to three qualifiers)
├── qualifier round 3
├── repechage                (second chance for teams that missed advancement)
└── Mexico finals
```

A contest belongs to exactly one season and one stage. A contest defines an ordered set of
problems, and each participating team has one result per problem.

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

**School history**

Every school has a page summarizing its results across seasons, using charts for performance
trends and podium displays for its best placements.

### 2. Media feed

A page that collects public media posts published under the hashtag of the most recent contest,
so the site reflects the live reaction around the competition that just took place.

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
