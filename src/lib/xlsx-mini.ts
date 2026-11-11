// مولد فایل xlsx بدون وابستگی بیرونی (EXPORT-SETTLE · PAY-BATCH)
// ─────────────────────────────────────────────────────────────────────────────
// یک آرشیو ZIP با ورودی‌های «STORE» (بدون فشرده‌سازی) می‌سازد؛ ساختار فایل‌های
// XML طبق OOXML (SpreadsheetML) با رشته‌های inline — سازگار با Excel/LibreOffice.
// ویژگی‌ها: صفحهٔ راست‌به‌چپ (rightToLeft)، سلول متن/عدد، فونت درشت (bold) برای
// سطر عنوان و قالب عدد جداکنندهٔ هزارگان (#,##0) و عرض ستون دلخواه.
// ─────────────────────────────────────────────────────────────────────────────

export interface XlsxCell {
  /** مقدار سلول */
  v: string | number
  /** نوع سلول: "n" = عدد، پیش‌فرض = متن (inline string) */
  t?: "n"
  /** درشت‌کردن قلم (سبک xf بولد) */
  bold?: boolean
  /** قالب عدد با جداکنندهٔ هزارگان — فقط برای سلول عددی معنا دارد */
  thousands?: boolean
}

export interface XlsxSheet {
  name: string
  rows: XlsxCell[][]
  /** عرض ستون‌ها بر حسب نویسه (اختیاری) */
  widths?: number[]
  /** راست‌به‌چپ‌کردن برگه (پیش‌فرض true) */
  rtl?: boolean
}

/* ─── CRC-32 (IEEE 802.3) — برای هدر ZIP ─── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/* ─── ZIP با متد STORE (بدون فشرده‌سازی — اندازهٔ فایل خروجی کوچک است) ─── */
function zipStore(files: { name: string; data: Buffer }[]): Buffer {
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  // تاریخ/ساعت DOS (دقت ۲ ثانیه)
  const now = new Date()
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, "utf8")
    const crc = crc32(f.data)

    // Local File Header
    const lfh = Buffer.alloc(30)
    lfh.writeUInt32LE(0x04034b50, 0)
    lfh.writeUInt16LE(20, 4) // نسخهٔ لازم
    lfh.writeUInt16LE(0x0800, 6) // پرچم UTF-8 برای نام فایل
    lfh.writeUInt16LE(0, 8) // متد STORE
    lfh.writeUInt16LE(dosTime, 10)
    lfh.writeUInt16LE(dosDate, 12)
    lfh.writeUInt32LE(crc, 14)
    lfh.writeUInt32LE(f.data.length, 18)
    lfh.writeUInt32LE(f.data.length, 22)
    lfh.writeUInt16LE(nameBuf.length, 26)
    lfh.writeUInt16LE(0, 28)
    chunks.push(lfh, nameBuf, f.data)

    // Central Directory Record
    const cdr = Buffer.alloc(46)
    cdr.writeUInt32LE(0x02014b50, 0)
    cdr.writeUInt16LE(20, 4) // نسخهٔ سازنده
    cdr.writeUInt16LE(20, 6) // نسخهٔ لازم
    cdr.writeUInt16LE(0x0800, 8)
    cdr.writeUInt16LE(0, 10)
    cdr.writeUInt16LE(dosTime, 12)
    cdr.writeUInt16LE(dosDate, 14)
    cdr.writeUInt32LE(crc, 16)
    cdr.writeUInt32LE(f.data.length, 20)
    cdr.writeUInt32LE(f.data.length, 24)
    cdr.writeUInt16LE(nameBuf.length, 28)
    cdr.writeUInt16LE(0, 30)
    cdr.writeUInt16LE(0, 32)
    cdr.writeUInt16LE(0, 34)
    cdr.writeUInt16LE(0, 36)
    cdr.writeUInt32LE(0, 38)
    cdr.writeUInt32LE(offset, 42)
    central.push(cdr, nameBuf)

    offset += 30 + nameBuf.length + f.data.length
  }

  const cdBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...chunks, cdBuf, eocd])
}

/* ─── ابزارهای XML ─── */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** نام ستون اکسل از اندیس صفرمبنا: 0→A، 25→Z، 26→AA … */
function colName(idx: number): string {
  let s = ""
  let n = idx
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

/* ─── اجزای بستهٔ xlsx ─── */
function contentTypesXml(sheetCount: number): string {
  const overrides = [
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
  ]
  for (let i = 1; i <= sheetCount; i++) {
    overrides.push(
      `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
  }
  return (
    XML_HEAD +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    overrides.join("") +
    "</Types>"
  )
}

const ROOT_RELS_XML =
  XML_HEAD +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  "</Relationships>"

function workbookXml(sheetNames: string[]): string {
  const sheets = sheetNames
    .map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("")
  return (
    XML_HEAD +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${sheets}</sheets>` +
    "</workbook>"
  )
}

function workbookRelsXml(sheetCount: number): string {
  const rels: string[] = [
    '<Relationship Id="rIdSty" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
  ]
  for (let i = 1; i <= sheetCount; i++) {
    rels.push(
      `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`
    )
  }
  return XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join("") + "</Relationships>"
}

/**
 * سبک‌ها — چهار xf:
 *  0) عادی  1) درشت (عنوان)  2) عدد با جداکنندهٔ هزارگان  3) درشت + هزارگان (جمع کل)
 */
const STYLES_XML =
  XML_HEAD +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>' +
  '<fonts count="2">' +
  '<font><sz val="11"/><name val="Vazirmatn"/></font>' +
  '<font><b/><sz val="11"/><name val="Vazirmatn"/></font>' +
  "</fonts>" +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>"

function sheetXml(sheet: XlsxSheet): string {
  const rtl = sheet.rtl !== false
  const cols = (sheet.widths ?? [])
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("")

  const rowsXml = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          const ref = `${colName(c)}${r + 1}`
          const styleIdx = cell.t === "n" ? (cell.bold ? 3 : cell.thousands ? 2 : 0) : cell.bold ? 1 : 0
          const s = styleIdx ? ` s="${styleIdx}"` : ""
          if (cell.t === "n") {
            return `<c r="${ref}"${s}><v>${Number(cell.v)}</v></c>`
          }
          return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(cell.v))}</t></is></c>`
        })
        .join("")
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join("")

  return (
    XML_HEAD +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetViews><sheetView${rtl ? ' rightToLeft="1"' : ""} workbookViewId="0"/></sheetViews>` +
    `${cols ? `<cols>${cols}</cols>` : ""}` +
    `<sheetData>${rowsXml}</sheetData>` +
    "</worksheet>"
  )
}

/* ─── نقطهٔ ورود ─── */
export function buildXlsx(sheets: XlsxSheet[]): Buffer {
  if (!sheets.length) throw new Error("حداقل یک برگه لازم است.")
  for (const s of sheets) {
    if (!s.name || s.name.length > 31) throw new Error("نام برگه باید بین ۱ تا ۳۱ نویسه باشد.")
    if (/[[\]:*?/\\]/.test(s.name)) throw new Error("نام برگه شامل نویسهٔ ممنوع است.")
  }

  const files: { name: string; data: Buffer }[] = [
    { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml(sheets.length), "utf8") },
    { name: "_rels/.rels", data: Buffer.from(ROOT_RELS_XML, "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbookXml(sheets.map((s) => s.name)), "utf8") },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRelsXml(sheets.length), "utf8") },
    { name: "xl/styles.xml", data: Buffer.from(STYLES_XML, "utf8") },
  ]
  sheets.forEach((s, i) => {
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: Buffer.from(sheetXml(s), "utf8") })
  })

  return zipStore(files)
}
