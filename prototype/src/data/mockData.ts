import type {
  AccumulatedStanding,
  Contest,
  MediaPost,
  Problem,
  ProblemResult,
  School,
  Series,
  Standing,
} from "./types"

export const series: Series[] = [
  {
    id: "gpm",
    name: "Gran Premio de México",
    shortName: "GPM",
    description: "Serie clasificatoria nacional",
  },
  {
    id: "mexico-finals",
    name: "Finales de México",
    shortName: "Finales de México",
    description: "Final del campeonato nacional",
  },
]

export const schools: School[] = [
  {
    id: "unam",
    name: "Universidad Nacional Autónoma de México",
    shortName: "UNAM",
    city: "Ciudad de México",
    state: "CDMX",
    kind: "institution",
  },
  {
    id: "unam-fc",
    name: "Facultad de Ciencias, UNAM",
    shortName: "UNAM FC",
    city: "Ciudad de México",
    state: "CDMX",
    kind: "unit",
    parentId: "unam",
  },
  {
    id: "ipn",
    name: "Instituto Politécnico Nacional",
    shortName: "IPN",
    city: "Ciudad de México",
    state: "CDMX",
    kind: "institution",
  },
  {
    id: "ipn-escom",
    name: "Escuela Superior de Cómputo",
    shortName: "IPN ESCOM",
    city: "Ciudad de México",
    state: "CDMX",
    kind: "unit",
    parentId: "ipn",
  },
  {
    id: "tec",
    name: "Tecnológico de Monterrey",
    shortName: "ITESM",
    city: "Monterrey",
    state: "Nuevo León",
    kind: "institution",
  },
  {
    id: "udg",
    name: "Universidad de Guadalajara",
    shortName: "UDG",
    city: "Guadalajara",
    state: "Jalisco",
    kind: "institution",
  },
  {
    id: "uanl",
    name: "Universidad Autónoma de Nuevo León",
    shortName: "UANL",
    city: "San Nicolás",
    state: "Nuevo León",
    kind: "institution",
  },
  {
    id: "buap",
    name: "Benemérita Universidad Autónoma de Puebla",
    shortName: "BUAP",
    city: "Puebla",
    state: "Puebla",
    kind: "institution",
  },
  {
    id: "uv",
    name: "Universidad Veracruzana",
    shortName: "UV",
    city: "Xalapa",
    state: "Veracruz",
    kind: "institution",
  },
  {
    id: "ug",
    name: "Universidad de Guanajuato",
    shortName: "UG",
    city: "Guanajuato",
    state: "Guanajuato",
    kind: "institution",
  },
]

const problemTitles = [
  "Arrecife de datos",
  "Balam",
  "Caminos de obsidiana",
  "Día de mercado",
  "Ecos del cenote",
  "Frontera mínima",
  "Grafos de papel",
  "Hilos de Huron",
  "Islas",
  "Jardines",
  "Kukulcán",
  "Líneas",
  "Mariposas",
]

function makeProblems(count: number): Problem[] {
  return problemTitles.slice(0, count).map((title, index) => ({
    id: String.fromCharCode(65 + index),
    title,
  }))
}

const teams = [
  {
    id: "2024-segmentree",
    name: "Segmentree",
    schoolId: "unam-fc",
    roster: ["Ana Torres", "Luis Molina", "Sofía Cruz"],
  },
  {
    id: "2024-big-o",
    name: "Los Big O",
    schoolId: "ipn-escom",
    roster: ["Daniel Soto", "María Paz", "Iván Ruiz"],
  },
  {
    id: "2024-runtime",
    name: "Runtime Terrors",
    schoolId: "tec",
    roster: ["Camila Reyes", "Diego Leal", "Renata Sáenz"],
  },
  {
    id: "2024-tapatios",
    name: "Tapatíos.cpp",
    schoolId: "udg",
    roster: ["Emilio Luna", "Sara Díaz", "Óscar Gil"],
  },
  { id: "2024-regios", name: "Regios Dinámicos", schoolId: "uanl" },
  { id: "2024-lobos", name: "Lobos en Cola", schoolId: "buap" },
  { id: "2024-bitacora", name: "Bitácora UV", schoolId: "uv" },
  { id: "2024-greedy", name: "Guanajuato Greedy", schoolId: "ug" },
] as const

function result(
  status: ProblemResult["status"],
  attempts: number,
  solvedAtMinute?: number,
  firstToSolve = false,
): ProblemResult {
  return { status, attempts, solvedAtMinute, firstToSolve }
}

const patterns: ProblemResult[][] = [
  [
    result("solved", 1, 22, true),
    result("solved", 2, 64),
    result("solved", 1, 89),
    result("solved", 3, 137),
    result("solved", 1, 173),
    result("solved", 2, 222),
    result("attempted", 2),
    result("unattempted", 0),
    result("solved", 1, 245),
    result("attempted", 3),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
  ],
  [
    result("solved", 1, 22, true),
    result("solved", 1, 51, true),
    result("solved", 3, 118),
    result("solved", 1, 142),
    result("solved", 2, 211),
    result("attempted", 4),
    result("attempted", 1),
    result("unattempted", 0),
    result("solved", 3, 281),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
  ],
  [
    result("solved", 1, 27),
    result("solved", 2, 77),
    result("solved", 2, 126),
    result("solved", 1, 149, true),
    result("attempted", 3),
    result("attempted", 2),
    result("unattempted", 0),
    result("unattempted", 0),
    result("solved", 2, 264),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
  ],
  [
    result("solved", 3, 58),
    result("solved", 1, 83),
    result("solved", 2, 155),
    result("solved", 2, 219),
    result("attempted", 4),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
  ],
  [
    result("solved", 1, 41),
    result("solved", 3, 112),
    result("solved", 2, 198),
    result("attempted", 2),
    result("attempted", 1),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
  ],
  [
    result("solved", 2, 66),
    result("solved", 2, 148),
    result("solved", 4, 238),
    result("attempted", 3),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
  ],
  [
    result("solved", 1, 73),
    result("solved", 4, 192),
    result("attempted", 4),
    result("attempted", 2),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
  ],
  [
    result("solved", 3, 169),
    result("attempted", 5),
    result("attempted", 1),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
    result("unattempted", 0),
  ],
]

function makeStandings(
  problemCount: number,
  penaltyRule: number,
  shift = 0,
  older = false,
): Standing[] {
  return teams
    .map((team, index) => {
      const place = ((index + shift) % teams.length) + 1
      const seed = patterns[place - 1].slice(0, problemCount)
      const results = Object.fromEntries(
        makeProblems(problemCount).map((problem, i) => [problem.id, seed[i]]),
      )
      const solvedResults = seed.filter((item) => item.status === "solved")
      return {
        place,
        teamId: `${
          older ? "2023" : "2024"
        }-${team.id.split("-").slice(1).join("-")}`,
        team: team.name,
        schoolId: team.schoolId,
        roster: older || !("roster" in team) ? undefined : [...team.roster],
        results,
        solved: solvedResults.length,
        penalty: solvedResults.reduce(
          (sum, item) =>
            sum +
            (item.solvedAtMinute ?? 0) +
            penaltyRule * (item.attempts - 1),
          0,
        ),
      }
    })
    .sort((a, b) => a.place - b.place)
}

const accumulated: AccumulatedStanding[] = teams.map((team, index) => ({
  place: index + 1,
  teamId: team.id,
  team: team.name,
  schoolId: team.schoolId,
  score: [290, 270, 245, 221, 198, 174, 151, 130][index],
  qualified: index < 5,
}))

export const contests: Contest[] = [
  {
    id: "2024-gpm-q1",
    season: 2024,
    seriesId: "gpm",
    stage: "Clasificatorio 1",
    name: "GPM 2024 — Clasificatorio 1",
    date: "2024-03-09",
    location: "En línea",
    durationMinutes: 300,
    penaltyMinutesPerFailedAttempt: 20,
    officialUrl: "https://scoreboard.example.org/gpm-2024-q1",
    kind: "contest",
    problems: makeProblems(10),
    standings: makeStandings(10, 20, 2),
  },
  {
    id: "2024-gpm-q2",
    season: 2024,
    seriesId: "gpm",
    stage: "Clasificatorio 2",
    name: "GPM 2024 — Clasificatorio 2",
    date: "2024-05-18",
    location: "En línea",
    durationMinutes: 300,
    penaltyMinutesPerFailedAttempt: 20,
    officialUrl: "https://scoreboard.example.org/gpm-2024-q2",
    kind: "contest",
    problems: makeProblems(11),
    standings: makeStandings(11, 20, 1),
  },
  {
    id: "2024-gpm-q3",
    season: 2024,
    seriesId: "gpm",
    stage: "Clasificatorio 3",
    name: "GPM 2024 — Clasificatorio 3",
    date: "2024-08-24",
    location: "En línea",
    durationMinutes: 300,
    penaltyMinutesPerFailedAttempt: 15,
    officialUrl: "https://scoreboard.example.org/gpm-2024-q3",
    kind: "contest",
    problems: makeProblems(13),
    standings: makeStandings(13, 15),
  },
  {
    id: "2024-gpm-repechage",
    season: 2024,
    seriesId: "gpm",
    stage: "Repechage",
    name: "GPM 2024 — Repechage",
    date: "2024-10-12",
    location: "En línea",
    durationMinutes: 240,
    penaltyMinutesPerFailedAttempt: 20,
    officialUrl: "https://scoreboard.example.org/gpm-2024-repechage",
    kind: "contest",
    problems: makeProblems(8),
    standings: makeStandings(8, 20, 3),
  },
  {
    id: "2024-gpm-accumulated",
    season: 2024,
    seriesId: "gpm",
    stage: "Clasificación acumulada",
    name: "GPM 2024 — Clasificación acumulada",
    date: "2024-10-14",
    durationMinutes: 0,
    penaltyMinutesPerFailedAttempt: 0,
    officialUrl: "https://scoreboard.example.org/gpm-2024-accumulated",
    kind: "accumulated",
    problems: [],
    standings: [],
    accumulatedStandings: accumulated,
  },
  {
    id: "2024-mexico-final",
    season: 2024,
    seriesId: "mexico-finals",
    stage: "Final",
    name: "Finales ICPC México 2024",
    date: "2024-11-09",
    location: "Guadalajara, Jalisco",
    durationMinutes: 300,
    penaltyMinutesPerFailedAttempt: 20,
    officialUrl: "https://scoreboard.example.org/mexico-finals-2024",
    hashtag: "#ICPCMexico2024",
    kind: "contest",
    problems: makeProblems(13),
    standings: makeStandings(13, 20),
  },
  {
    id: "2023-gpm-q1",
    season: 2023,
    seriesId: "gpm",
    stage: "Clasificatorio 1",
    name: "GPM 2023 — Clasificatorio 1",
    date: "2023-04-15",
    location: "En línea",
    durationMinutes: 300,
    penaltyMinutesPerFailedAttempt: 20,
    officialUrl: "https://scoreboard.example.org/gpm-2023-q1",
    kind: "contest",
    problems: makeProblems(9),
    standings: makeStandings(9, 20, 1, true),
  },
  {
    id: "2023-gpm-q2",
    season: 2023,
    seriesId: "gpm",
    stage: "Clasificatorio 2",
    name: "GPM 2023 — Clasificatorio 2",
    date: "2023-08-19",
    location: "En línea",
    durationMinutes: 300,
    penaltyMinutesPerFailedAttempt: 20,
    officialUrl: "https://scoreboard.example.org/gpm-2023-q2",
    kind: "contest",
    problems: makeProblems(10),
    standings: makeStandings(10, 20, 2, true),
  },
  {
    id: "2023-mexico-final",
    season: 2023,
    seriesId: "mexico-finals",
    stage: "Final",
    name: "Finales ICPC México 2023",
    date: "2023-11-11",
    location: "Monterrey, Nuevo León",
    durationMinutes: 300,
    penaltyMinutesPerFailedAttempt: 20,
    officialUrl: "https://scoreboard.example.org/mexico-finals-2023",
    hashtag: "#ICPCMexico2023",
    kind: "contest",
    problems: makeProblems(11),
    standings: makeStandings(11, 20, 2, true),
  },
]

const photo1 =
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=82"
const photo2 =
  "https://images.unsplash.com/photo-1565598611425-45b0878bdd0b?auto=format&fit=crop&w=1200&q=82"
const photo3 =
  "https://images.unsplash.com/photo-1632835256083-f044d6a859ed?auto=format&fit=crop&w=1200&q=82"

export const mediaPosts: MediaPost[] = [
  {
    id: "m1",
    source: "Instagram",
    username: "icpcmexico",
    displayName: "ICPC México",
    profileUrl: "https://instagram.com",
    timestamp: "2024-11-09T19:20:00-06:00",
    title: "Comienza la final",
    body: "Trece problemas, cinco horas y los mejores equipos del país en una misma sala.",
    assets: [
      {
        type: "image",
        url: photo1,
        alt: "Equipo universitario de programación colaborando frente a una laptop durante una competencia",
      },
      {
        type: "image",
        url: photo2,
        alt: "Tres estudiantes concentrados en sus laptops en una mesa de competencia",
      },
    ],
    hashtags: ["#ICPCMexico2024", "#ICPC", "#CompetitiveProgramming"],
    permalink: "https://instagram.com/p/example1",
  },
  {
    id: "m2",
    source: "X",
    username: "huron_algo",
    displayName: "Huron Algorithms Club",
    profileUrl: "https://x.com",
    timestamp: "2024-11-09T20:08:00-06:00",
    body: "Pizarrones, café y grafos: la última hora antes del congelamiento de la clasificación.",
    assets: [
      {
        type: "image",
        url: photo3,
        alt: "Estudiantes trabajando en equipo con laptops alrededor de una mesa",
      },
    ],
    hashtags: ["#ICPCMexico2024", "#Huron"],
    permalink: "https://x.com/huron_algo/status/example",
  },
  {
    id: "m3",
    source: "YouTube",
    username: "comunidadicpc",
    displayName: "Comunidad ICPC",
    profileUrl: "https://youtube.com",
    timestamp: "2024-11-10T10:00:00-06:00",
    title: "Finales de México 2024 — premiación",
    body: "Revive la ceremonia de clausura y conoce a los medallistas de esta temporada.",
    assets: [
      {
        type: "video",
        url: photo2,
        alt: "Miniatura de video con estudiantes celebrando en la ceremonia de premiación",
      },
    ],
    hashtags: ["#ICPCMexico2024"],
    permalink: "https://youtube.com/watch?v=example",
  },
]

export const seasons = [
  ...new Set(contests.map((contest) => contest.season)),
].sort((a, b) => b - a)

export function getSchool(id: string) {
  return schools.find((school) => school.id === id)
}

export function schoolMatchesScope(resultSchoolId: string, scopeId: string) {
  if (resultSchoolId === scopeId) return true
  return (
    schools.find((school) => school.id === resultSchoolId)?.parentId === scopeId
  )
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`))
}
