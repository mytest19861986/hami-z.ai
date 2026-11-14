// gen-deploy-guide.js — مونتاژ نهایی سند راهنمای استقرار (فارسی RTL)
const L = require("./gen-deploy-guide-lib.js");
const {
  Document, Packer, Paragraph, TextRun, PageBreak, Header, Footer, PageNumber, NumberFormat, SectionType,
  AlignmentType, TableOfContents, PAL, rtl, run, ltr, buildCoverR1,
} = L;
const { coverConfig, ch1, ch2, ch3 } = require("./gen-deploy-guide-part1.js");
const { ch4, ch5, ch6, ch7, ch8 } = require("./gen-deploy-guide-part2.js");
const fs = require("fs");

const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

function pageNumFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888" })],
    })],
  });
}

const doc = new Document({
  creator: "HamiCard",
  title: "راهنمای استقرار حامی‌کارت روی سرور اوبونتو",
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Vazirmatn" }, size: 24, color: PAL.body },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri", eastAsia: "Vazirmatn" }, size: 32, bold: true, color: PAL.primary },
        paragraph: { spacing: { before: 360, after: 160, line: 312 } },
      },
      heading2: {
        run: { font: { ascii: "Calibri", eastAsia: "Vazirmatn" }, size: 28, bold: true, color: PAL.primary },
        paragraph: { spacing: { before: 240, after: 120, line: 312 } },
      },
      heading3: {
        run: { font: { ascii: "Calibri", eastAsia: "Vazirmatn" }, size: 24, bold: true, color: PAL.primary },
        paragraph: { spacing: { before: 200, after: 100, line: 312 } },
      },
    },
  },
  sections: [
    // ─── بخش ۱: کاور (بدون شماره صفحه) ───
    {
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1(coverConfig),
    },
    // ─── بخش ۲: فهرست مطالب (شمارهٔ رومی) ───
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageNumFooter() },
      children: [
        new Paragraph(rtl({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [run("فهرست مطالب", { bold: true, size: 32 })],
        })),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph(rtl({
          spacing: { before: 200 },
          children: [run("یادآوری: این فهرست با کد فیلد ساخته شده است؛ پس از هرگونه ویرایش سند، روی فهرست راست‌کلیک کرده و «Update Field» را بزنید تا شماره صفحه‌ها تازه شود.", { italics: true, size: 18, color: "888888" })],
        })),
        // بدون PageBreak انتهایی — سکشن بعدی خودش صفحه را عوض می‌کند (PageBreak دوبل = صفحهٔ خالی)
      ],
    },
    // ─── بخش ۳: بدنه (شمارهٔ لاتین از ۱) ───
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      footers: { default: pageNumFooter() },
      children: [...ch1, ...ch2, ...ch3, ...ch4, ...ch5, ...ch6, ...ch7, ...ch8],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = "/home/z/my-project/download/راهنمای-استقرار-حامی-کارت-روی-سرور-اوبونتو.docx";
  fs.writeFileSync(out, buf);
  console.log("DOCX ساخته شد:", out, "حجم:", buf.length, "بایت");
});
