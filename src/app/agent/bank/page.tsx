import { redirect } from "next/navigation"

// اطلاعات بانکی به پروفایل همکار فروش منتقل شد (REF-SYS · SETTLE-002/003)
export default function AgentBankPage() {
  redirect("/agent/profile")
}
