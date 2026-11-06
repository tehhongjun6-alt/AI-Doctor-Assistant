export interface StageTimerResult {
  [stage: string]: number
  total: number
}

export function createStageTimer(now: () => number = () => performance.now()) {
  const startTime = now()
  let lastMarkTime = startTime
  const stages: Record<string, number> = {}

  return {
    mark(stage: string): void {
      const currentTime = now()
      stages[stage] = Math.round(currentTime - lastMarkTime)
      lastMarkTime = currentTime
    },
    result(): StageTimerResult {
      return {
        ...stages,
        total: Math.round(lastMarkTime - startTime),
      }
    },
  }
}
