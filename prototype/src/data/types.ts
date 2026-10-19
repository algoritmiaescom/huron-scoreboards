export type Series = {
  id: string
  name: string
  shortName: string
  description: string
}

export type School = {
  id: string
  name: string
  shortName: string
  city: string
  state: string
  kind: "institution" | "unit"
  parentId?: string
}

export type Problem = {
  id: string
  title: string
}

export type ProblemResult = {
  status: "unattempted" | "attempted" | "solved"
  attempts: number
  solvedAtMinute?: number
  firstToSolve?: boolean
}

export type Standing = {
  place: number
  teamId: string
  team: string
  schoolId: string
  roster?: string[]
  results: Record<string, ProblemResult>
  solved: number
  penalty: number
}

export type AccumulatedStanding = {
  place: number
  teamId: string
  team: string
  schoolId: string
  score: number
  qualified: boolean
}

export type Contest = {
  id: string
  season: number
  seriesId: string
  stage: string
  name: string
  date: string
  location?: string
  durationMinutes: number
  penaltyMinutesPerFailedAttempt: number
  officialUrl: string
  hashtag?: string
  kind: "contest" | "accumulated"
  problems: Problem[]
  standings: Standing[]
  accumulatedStandings?: AccumulatedStanding[]
}

export type MediaAsset = {
  type: "image" | "video"
  url: string
  alt: string
}

export type MediaPost = {
  id: string
  source: "X" | "Instagram" | "Facebook" | "YouTube" | "LinkedIn"
  username: string
  displayName?: string
  avatar?: string
  profileUrl: string
  timestamp: string
  title?: string
  body: string
  assets: MediaAsset[]
  hashtags: string[]
  permalink: string
}
