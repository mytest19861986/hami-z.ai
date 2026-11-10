// Seed داده اولیه محصول حامی‌کارت
import { PrismaClient } from "@prisma/client"
import { hashPassword } from "../src/lib/password"
import { PERMISSIONS, ROLE_PERMISSION_MATRIX, ROLE_NAMES } from "../src/constants/permissions"
import { SETTING_DEFAULTS } from "../src/lib/settings"

const db = new PrismaClient()

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86400_000)
}

async function main() {
  console.log("🌱 شروع seed حامی‌کارت …")

  // ── نقش‌ها و مجوزها ──
  for (const [name, title] of Object.entries(ROLE_NAMES)) {
    await db.role.upsert({ where: { name }, update: { title }, create: { name, title } })
  }
  for (const p of PERMISSIONS) {
    await db.permission.upsert({ where: { name: p.name }, update: { title: p.title, module: p.module }, create: p })
  }
  for (const [roleName, perms] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    const role = await db.role.findUnique({ where: { name: roleName } })
    if (!role) continue
    for (const pname of perms) {
      const perm = await db.permission.findUnique({ where: { name: pname } })
      if (!perm) continue
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      })
    }
  }
  console.log("✅ نقش‌ها و مجوزها")

  // ── تنظیمات ──
  for (const [key, def] of Object.entries(SETTING_DEFAULTS)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value: def.value, title: def.title, description: def.description ?? null } })
  }
  console.log("✅ تنظیمات")

  // ── محتوای صفحات عمومی ──
  const pages: Array<{ pageKey: string; title: string; body: string }> = [
    { pageKey: "about", title: "درباره حامی‌کارت", body: "حامی‌کارت بستری برای عرضه و مدیریت طرح‌های تخفیف خدمات درمانی است.\n\nما با شبکه‌ای از پزشکان طرف همکاری در سراسر ایران، امکان استفاده از خدمات درمانی با تخفیف را برای اعضای حامی‌کارت فراهم می‌کنیم. عضویت در حامی‌کارت به شما امکان می‌دهد طرح مناسب خود را تهیه کنید، پزشکان طرف قرارداد را پیدا کنید و در لحظه مراجعه از تخفیف بهره‌مند شوید.\n\nمأموریت ما: شفافیت، اعتماد و دسترسی ساده به خدمات درمانی مقرون‌به‌صرفه." },
    { pageKey: "contact", title: "تماس با ما", body: "برای ارتباط با تیم پشتیبانی حامی‌کارت از راه‌های زیر استفاده کنید:\n\nتلفن پشتیبانی: ۰۱۱-۳۳۳۳۴۴۴۴ (شنبه تا پنجشنبه، ۹ تا ۱۸)\nایمیل: info@hamikart.ir\nنشانی: مازندران، ساری، خیابان ۱۸ دی، پلاک ۱۲۳\n\nهمچنین می‌توانید از فرم «ثبت درخواست پشتیبانی» در پنل کاربری خود استفاده کنید." },
    { pageKey: "faq", title: "پرسش‌های متداول", body: "چگونه عضو حامی‌کارت شوم؟\nبا شماره موبایل خود ثبت‌نام کنید، کد تأیید را وارد کنید و طرح دلخواه را تهیه کنید.\n\nآیا خریدار و دارنده کارت باید یک نفر باشند؟\nخیر؛ می‌توانید طرح را برای یک دارنده مشخص (مثلاً یکی از اعضای خانواده) تهیه کنید.\n\nتخفیف چگونه اعمال می‌شود؟\nدر زمان مراجعه، پزشک طرف قرارداد ویزیت را ثبت می‌کند و تخفیف طبق درصد طرح (یا درصد اختصاصی پزشک) محاسبه و نمایش داده می‌شود.\n\nپورسانت تسویه چه زمانی انجام می‌شود؟\nپورسانت‌های تأییدشده قابل برداشت هستند. تسویه به‌صورت ثبت درخواست و پرداخت خارج از سامانه انجام می‌شود.\n\nاگر طرحم منقضه شود چه می‌شود؟\nطرح منقضی قابل استفاده نیست؛ می‌توانید طرح جدیدی تهیه یا تمدید کنید." },
    { pageKey: "terms", title: "قوانین و شرایط", body: "۱. عضویت در حامی‌کارت با تأیید شماره موبایل معتبر انجام می‌شود و هر شخص با یک شماره یک حساب دارد.\n۲. کارت حامی‌کارت شخصی است و استفاده از آن برای اشخاص غیر مجاز نیست.\n۳. تعداد استفاده مجاز هر طرح طبق مشخصات همان طرح است و پس از اتمام سهمیه، طرح قابل استفاده نیست.\n۴. حامی‌کارت سرویس بیمه نیست و جایگزین بیمه درمانی نیست.\n۵. پرداخت پورسانت و تسویه‌ها پس از تأیید مدیریتی و طبق قواعد اعلام‌شده انجام می‌شود.\n۶. ثبت ویزیت و تخفیف صرفاً توسط پزشکان طرف قرارداد معتبر است." },
    { pageKey: "privacy", title: "حریم خصوصی", body: "حامی‌کارت متعهد است:\n\nاطلاعات هویتی و بانکی شما فقط در حد لازم و برای ارائه سرویس نگهداری می‌شود.\nاطلاعات بانکی فقط برای فرایند تسویه پورسانت استفاده می‌شود و در صفحات عمومی نمایش داده نمی‌شود.\nجزئیات درمانی فقط در حد ثبت ویزیت و برای افراد مجاز (خود بیمار و پزشک معالج) قابل مشاهده است.\nاطلاعات شما بدون حکم قانونی در اختیار اشخاص ثالث قرار نمی‌گیرد.\nخروج از حساب، دسترسی به اطلاعات خصوصی را از طریق مرورگر حذف می‌کند." },
  ]
  for (const p of pages) {
    await db.pageContent.upsert({ where: { pageKey: p.pageKey }, update: {}, create: { ...p, status: "PUBLISHED" } })
  }
  console.log("✅ صفحات عمومی")

  // ── طرح‌های نمونه ──
  const plansData = [
    { title: "طرح برنزی", description: "مناسب شروع استفاده از خدمات درمانی با تخفیف", price: 350000, durationDays: 180, discountPercent: 15, usageLimit: 6, salesCommissionPercent: 10, referralCommissionPercent: 5, sortOrder: 1, features: JSON.stringify(["۱۵٪ تخفیف ویزیت", "۶ مرتبه استفاده در ۶ ماه", "دسترسی به شبکه پزشکان سراسر کشور"]) },
    { title: "طرح نقره‌ای", description: "پوشش متعادل برای خانواده‌های کوچک", price: 650000, durationDays: 365, discountPercent: 20, usageLimit: 15, salesCommissionPercent: 12, referralCommissionPercent: 6, sortOrder: 2, features: JSON.stringify(["۲۰٪ تخفیف ویزیت", "۱۵ مرتبه استفاده در یک سال", "پشتیبانی اولویت‌دار"]) },
    { title: "طرح طلایی", description: "بیشترین تخفیف و استفاده نامحدود", price: 1200000, durationDays: 365, discountPercent: 30, usageLimit: null, salesCommissionPercent: 15, referralCommissionPercent: 8, sortOrder: 3, features: JSON.stringify(["۳۰٪ تخفیف ویزیت", "استفاده نامحدود در یک سال", "پشتیبانی اختصاصی", "تخفیف‌های ویژه مراکز پاراکلینیک"]) },
  ]
  for (const p of plansData) {
    const exists = await db.discountPlan.findFirst({ where: { title: p.title } })
    if (!exists) await db.discountPlan.create({ data: { ...p, isActive: true } })
  }
  console.log("✅ طرح‌ها")

  // ── حساب مدیر ارشد (نمونه — پیش از بهره‌برداری تغییر کند) ──
  const adminMobile = "09120000000"
  let admin = await db.user.findUnique({ where: { mobile: adminMobile } })
  if (!admin) {
    admin = await db.user.create({
      data: {
        mobile: adminMobile,
        passwordHash: hashPassword("Hami@Admin123"),
        status: "ACTIVE",
        mobileVerifiedAt: new Date(),
        profile: { create: { firstName: "مدیر", lastName: "ارشد حامی‌کارت", province: "مازندران", city: "ساری" } },
      },
    })
  }
  const superRole = await db.role.findUnique({ where: { name: "SUPER_ADMIN" } })
  if (superRole) {
    await db.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: superRole.id } },
      update: {},
      create: { userId: admin.id, roleId: superRole.id },
    })
  }
  console.log("✅ مدیر ارشد (۰۹۱۲۰۰۰۰۰۰۰ / Hami@Admin123)")

  // ── پزشکان نمونه برای دایرکتوری عمومی (داده نمایشی — SEC-004) ──
  const doctorsData = [
    { mobile: "09121111101", firstName: "آرش", lastName: "کریمی", code: "۱۲۳۴۵".replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))), specialty: "قلب و عروق", clinic: "کلینیک قلب آرش", province: "مازندران", city: "ساری", discount: 25 },
    { mobile: "09121111102", firstName: "مریم", lastName: "احمدی", code: "23456", specialty: "پوست و مو", clinic: "درمانگاه پوست رز", province: "مازندران", city: "ساری", discount: null },
    { mobile: "09121111103", firstName: "حسین", lastName: "رستمی", code: "34567", specialty: "ارتوپدی", clinic: "مطب ارتوپدی رستمی", province: "مازندران", city: "ساری", discount: 20 },
    { mobile: "09121111104", firstName: "زهرا", lastName: "موسوی", code: "45678", specialty: "اطفال", clinic: "مطب اطفال مهر", province: "مازندران", city: "ساری", discount: null },
    { mobile: "09121111105", firstName: "رضا", lastName: "نجفی", code: "56789", specialty: "داخلی", clinic: "کلینیک داخلی نگین", province: "مازندران", city: "ساری", discount: 22 },
    { mobile: "09121111106", firstName: "سارا", lastName: "قاسمی", code: "67890", specialty: "زنان و زایمان", clinic: "مطب زنان سلامت", province: "مازندران", city: "ساری", discount: null },
    { mobile: "09121111107", firstName: "امیر", lastName: "شریفی", code: "78901", specialty: "دندانپزشکی", clinic: "کلینیک دندانپزشکی لبخند", province: "مازندران", city: "ساری", discount: 15 },
    { mobile: "09121111108", firstName: "نگار", lastName: "عباسی", code: "89012", specialty: "چشم‌پزشکی", clinic: "مطب چشم بینش", province: "مازندران", city: "ساری", discount: null },
    { mobile: "09121111109", firstName: "بهنام", lastName: "کاظمی", code: "90123", specialty: "گوش، حلق و بینی", clinic: "مطب ENT کاظمی", province: "مازندران", city: "ساری", discount: null },
    { mobile: "09121111110", firstName: "لیلا", lastName: "حسینی", code: "11223", specialty: "تغذیه و رژیم‌درمانی", clinic: "کلینیک تغذیه سبز", province: "مازندران", city: "ساری", discount: 18 },
  ]

  const userRole = await db.role.findUnique({ where: { name: "USER" } })
  const doctorRole = await db.role.findUnique({ where: { name: "DOCTOR" } })

  for (const d of doctorsData) {
    let u = await db.user.findUnique({ where: { mobile: d.mobile } })
    if (!u) {
      u = await db.user.create({
        data: {
          mobile: d.mobile,
          status: "ACTIVE",
          mobileVerifiedAt: new Date(),
          profile: { create: { firstName: d.firstName, lastName: d.lastName, province: d.province, city: d.city } },
        },
      })
    }
    if (userRole) await db.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId: userRole.id } }, update: {}, create: { userId: u.id, roleId: userRole.id } })
    if (doctorRole) await db.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId: doctorRole.id } }, update: {}, create: { userId: u.id, roleId: doctorRole.id } })
    const existingDoc = await db.doctor.findUnique({ where: { userId: u.id } })
    if (!existingDoc) {
      await db.doctor.create({
        data: {
          userId: u.id,
          medicalCouncilCode: d.code,
          specialty: d.specialty,
          clinicName: d.clinic,
          clinicAddress: `${d.city}، خیابان اصلی، پلاک نمونه`,
          province: d.province,
          city: d.city,
          clinicPhone: "01133334444",
          bio: `پزشک نمونه ${d.specialty} با سابقه همکاری با حامی‌کارت. (داده نمایشی)`,
          discountPercent: d.discount,
          status: "APPROVED",
          reviewedAt: new Date(),
        },
      })
    }
  }
  console.log("✅ پزشکان نمونه")

  // ── کاربر عادی نمونه + نماینده تأییدشده + معرف ──
  const demoUsers = [
    { mobile: "09120000001", firstName: "کاربر", lastName: "نمونه", role: "USER" },
    { mobile: "09120000002", firstName: "نماینده", lastName: "نمونه", role: "AGENT" },
    { mobile: "09120000003", firstName: "معرف", lastName: "نمونه", role: "REFERRER" },
    { mobile: "09120000004", firstName: "پزشک", lastName: "در انتظار", role: "DOCTOR_PENDING" },
  ]
  for (const du of demoUsers) {
    let u = await db.user.findUnique({ where: { mobile: du.mobile } })
    if (!u) {
      u = await db.user.create({
        data: {
          mobile: du.mobile,
          status: "ACTIVE",
          mobileVerifiedAt: new Date(),
          profile: { create: { firstName: du.firstName, lastName: du.lastName, province: "مازندران", city: "ساری" } },
        },
      })
    }
    if (userRole) await db.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId: userRole.id } }, update: {}, create: { userId: u.id, roleId: userRole.id } })

    if (du.role === "AGENT") {
      const agentRole = await db.role.findUnique({ where: { name: "AGENT" } })
      if (agentRole) await db.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId: agentRole.id } }, update: {}, create: { userId: u.id, roleId: agentRole.id } })
      const ex = await db.agent.findUnique({ where: { userId: u.id } })
      if (!ex) {
        await db.agent.create({
          data: {
            userId: u.id,
            businessName: "نمایندگی نمونه سلامت",
            description: "نماینده فروش نمایشی حامی‌کارت",
            province: "مازندران",
            city: "ساری",
            phone: du.mobile,
            status: "APPROVED",
            reviewedAt: new Date(),
          },
        })
      }
      await db.wallet.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id } })
    }
    if (du.role === "REFERRER") {
      const refRole = await db.role.findUnique({ where: { name: "REFERRER" } })
      if (refRole) await db.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId: refRole.id } }, update: {}, create: { userId: u.id, roleId: refRole.id } })
    }
    if (du.role === "DOCTOR_PENDING") {
      const doctorRole2 = await db.role.findUnique({ where: { name: "DOCTOR" } })
      if (doctorRole2) await db.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId: doctorRole2.id } }, update: {}, create: { userId: u.id, roleId: doctorRole2.id } })
      const ex = await db.doctor.findUnique({ where: { userId: u.id } })
      if (!ex) {
        await db.doctor.create({
          data: {
            userId: u.id,
            medicalCouncilCode: "99901",
            specialty: "داخلی",
            clinicName: "مطب در حال بررسی",
            province: "مازندران",
            city: "ساری",
            status: "PENDING",
          },
        })
      }
    }
  }
  console.log("✅ کاربران نمونه (کاربر/نماینده/معرف/پزشک در انتظار)")
  console.log("👤 ۰۹۱۲۰۰۰۰۰۰۱ = کاربر عادی | ۰۹۱۲۰۰۰۰۰۰۲ = نماینده تأییدشده | ۰۹۱۲۰۰۰۰۰۰۳ = معرف | ۰۹۱۲۰۰۰۰۰۰۴ = پزشک در انتظار")

  // ── REF-SYS: کد رفرال یکتا برای همهٔ کاربران فاقد کد ──
  const REFERRAL_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
  function genCode(): string {
    let out = ""
    for (let i = 0; i < 6; i++) out += REFERRAL_ALPHABET[Math.floor(Math.random() * REFERRAL_ALPHABET.length)]
    return out
  }
  const noCode = await db.user.findMany({ where: { referralCode: null }, select: { id: true } })
  for (const u of noCode) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const c = genCode()
      const clash = await db.user.findUnique({ where: { referralCode: c }, select: { id: true } })
      if (!clash) {
        await db.user.update({ where: { id: u.id }, data: { referralCode: c } })
        break
      }
    }
  }
  console.log(`✅ کد رفرال برای ${noCode.length} کاربر تضمین شد`)

  console.log("🏁 seed کامل شد.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
