export function toGold(brick: number | null | undefined, gold: number | null | undefined): number {
  const b = Math.max(0, Math.floor(brick ?? 0))
  const g = Math.max(0, Math.floor(gold ?? 0))
  return b * 10000 + g
}

export function splitGold(totalGold: number): { brick: number; gold: number } {
  const value = Math.max(0, Math.floor(totalGold || 0))
  return {
    brick: Math.floor(value / 10000),
    gold: value % 10000
  }
}

export function formatMoney(totalGold: number): string {
  const negative = totalGold < 0
  const { brick, gold } = splitGold(Math.abs(totalGold))
  const core = brick === 0 ? `${gold}金` : gold === 0 ? `${brick}砖` : `${brick}砖${gold}金`
  return negative ? `-${core}` : core
}
