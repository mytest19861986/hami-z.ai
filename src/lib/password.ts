// هش رمز عبور با scrypt + توکن‌های تصادفی (بدون وابستگی بیرونی)
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto"

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(":")) return false
  const [salt, hash] = stored.split(":")
  const candidate = scryptSync(password, salt, 64)
  const original = Buffer.from(hash, "hex")
  return candidate.length === original.length && timingSafeEqual(candidate, original)
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex")
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex")
}
