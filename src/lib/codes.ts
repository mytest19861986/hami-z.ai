// کدهای پیگیری یکتا (PAY-002 · SETTLE-013)
import { randomInt } from "crypto"

export function genTrackingCode(prefix = "HK"): string {
  const t = Date.now().toString(36).toUpperCase().slice(-6)
  const r = randomInt(1000, 9999)
  return `${prefix}-${t}${r}`
}
