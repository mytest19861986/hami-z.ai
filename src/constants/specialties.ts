// تخصص‌های پزشکی — فهرست ثابت محصول
export const SPECIALTIES = [
  "پوست و مو",
  "ارتوپدی",
  "اطفال",
  "داخلی",
  "قلب و عروق",
  "زنان و زایمان",
  "گوش، حلق و بینی",
  "چشم‌پزشکی",
  "دندانپزشکی",
  "مغز و اعصاب",
  "روان‌پزشکی",
  "اورولوژی",
  "غدد و متابولیسم",
  "جراحی عمومی",
  "عفونی",
  "ریه",
  "گوارش و کبد",
  "تغذیه و رژیم‌درمانی",
  "فیزیوتراپی",
  "پزشکی خانواده",
] as const

export type Specialty = (typeof SPECIALTIES)[number]

export function isSpecialty(s: string): boolean {
  return (SPECIALTIES as readonly string[]).includes(s)
}
