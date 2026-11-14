// gen-deploy-guide.js — راهنمای استقرار «حامی‌کارت» روی سرور اوبونتو (فارسی RTL)
// Cover: Recipe R1 (Pure Paragraph Left) — tech palette
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat, SectionType,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  TableLayoutType, TableOfContents, VerticalAlign,
} = require("docx");
const fs = require("fs");

// ─── پالت (Cool + Heavy + Calm → Deep Sea / لاجوردی حامی‌کارت) ───
const PAL = {
  primary: "162032", body: "1C2A3D", secondary: "5B6B7D",
  accent: "8B7E5A", surface: "F5F7FA",
  coverBg: "0E1A2B", coverTitle: "FFFFFF", coverSub: "C9D4E0",
  coverMeta: "AAB8C6", coverFooter: "8A97A6",
};

// ─── همهٔ پاراگراف‌های فارسی RTL هستند ───
const rtl = (o = {}) => ({ bidirectional: true, ...o });
function run(text, opts = {}) {
  return new TextRun({ text, rightToLeft: true, ...opts });
}
function ltr(text, opts = {}) {
  return new TextRun({ text, rightToLeft: false, ...opts });
}

function heading(text, level) {
  const H = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 }[level];
  return new Paragraph(rtl({
    heading: H,
    spacing: { before: level === 1 ? 360 : level === 2 ? 260 : 200, after: 140, line: 312 },
    children: [run(text, { bold: true, color: PAL.primary })],
  }));
}

function body(text, opts = {}) {
  return new Paragraph(rtl({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: [run(text, { size: 24, color: PAL.body, ...(opts.run || {}) })],
    ...(opts.para || {}),
  }));
}

// پاراگراف با مخلوط فارسی + لاتین (کد/دستور در متن RTL)
function bodyMixed(parts, opts = {}) {
  return new Paragraph(rtl({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: parts.map((p) =>
      p.ltr ? ltr(p.t, { size: 24, color: PAL.body, ...(p.run || {}) }) : run(p.t, { size: 24, color: PAL.body, ...(p.run || {}) })
    ),
    ...(opts.para || {}),
  }));
}

// بلوک کد/دستور — پس‌زمینهٔ روشن، چپ‌چین، فونت monospace
function codeBlock(lines) {
  return lines.map((ln, i) => new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 276, before: i === 0 ? 120 : 0, after: i === lines.length - 1 ? 160 : 0 },
    shading: { type: ShadingType.CLEAR, fill: "EFF3F8" },
    indent: { left: 200, right: 200 },
    children: [ltr(ln, { size: 20, color: "1C2A3D", font: { ascii: "Consolas", eastAsia: "Consolas" } })],
  }));
}

function note(text) {
  return new Paragraph(rtl({
    spacing: { line: 312, before: 60, after: 160 },
    border: { right: { style: BorderStyle.SINGLE, size: 12, color: PAL.accent, space: 8 } },
    indent: { right: 200 },
    shading: { type: ShadingType.CLEAR, fill: "F7F4EC" },
    children: [run(text, { size: 22, color: "4A4232" })],
  }));
}

// جدول RTL — ستون اول سمت راست
function rtlTable(headers, rows, widths) {
  const mk = (text, isHeader, w, i) => new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.CLEAR, fill: isHeader ? "E7EDF5" : i % 2 ? "F5F7FA" : "FFFFFF" },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    width: { size: w, type: WidthType.PERCENTAGE },
    children: [new Paragraph(rtl({
      alignment: AlignmentType.RIGHT,
      spacing: { line: 276 },
      children: Array.isArray(text)
        ? text.map((p) => (p.ltr ? ltr(p.t, { size: isHeader ? 22 : 21, bold: isHeader, color: PAL.body }) : run(p.t, { size: isHeader ? 22 : 21, bold: isHeader, color: PAL.body })))
        : [run(text, { size: isHeader ? 22 : 21, bold: isHeader, color: PAL.body })],
    }))],
  });
  return new Table({
    visuallyRightToLeft: true,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "9AA6B2" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "9AA6B2" },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "D0D6DE" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "E2E7EE" },
    },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => mk(h, true, widths[i], 0)) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, ci) => mk(c, false, widths[ci], ri)) })),
    ],
  });
}

function tableTitle(text) {
  return new Paragraph(rtl({
    keepNext: true,
    spacing: { before: 160, after: 80 },
    children: [run(text, { bold: true, size: 22, color: PAL.secondary })],
  }));
}

// ─── کاور R1 (مطابق دستور — بدون سخت‌کد اندازه) ───
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  const split = (t, cpl) => {
    if (t.length <= cpl) return [t];
    const lines = []; let rem = t;
    while (rem.length > cpl) { lines.push(rem.slice(0, cpl).trim()); rem = rem.slice(cpl).trim(); }
    if (rem) lines.push(rem);
    if (lines.length > 1 && lines[lines.length - 1].length <= 2) { const last = lines.pop(); lines[lines.length - 1] += last; }
    return lines;
  };
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = split(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = split(title, charsPerLine(minPt)); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(p) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false, metaLineCount = 0, fixedHeight = 800, pageHeight = 16838 } = p;
  const SAFETY = 1200;
  const usable = pageHeight - SAFETY;
  const contentH = titleLineCount * (titlePt * 23 + 200) + (hasSubtitle ? 12 * 23 + 600 : 0) + (hasEnglishLabel ? 9 * 23 + 600 : 0) + metaLineCount * (10 * 23 + 100) + fixedHeight + 3 * 300;
  const remaining = Math.max(usable - contentH, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(remaining * 0.45), rawBottom = Math.floor(remaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, midSpacing: Math.max(remaining - topSpacing - bottomSpacing, 0), bottomSpacing };
}

const allNoBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
};
const noBorders = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } };

function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph(rtl({ spacing: { before: spacing.topSpacing } })));
  if (config.englishLabel) {
    children.push(new Paragraph({
      bidirectional: true,
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [ltr(config.englishLabel.split("").join("  "), { size: 18, color: P.accent, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph(rtl({
      indent: { left: padL, right: padR },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [run(titleLines[i], { size: titleSize, bold: true, color: P.titleColor })],
    })));
  }
  if (config.subtitle) {
    children.push(new Paragraph(rtl({
      indent: { left: padL, right: padR }, spacing: { after: 800 },
      children: [run(config.subtitle, { size: 24, color: P.subtitleColor })],
    })));
  }
  for (const line of config.metaLines || []) {
    children.push(new Paragraph(rtl({
      indent: { left: padL + 200, right: padR }, spacing: { after: 80 },
      border: { right: accentLeft },
      children: [run(line, { size: 24, color: P.metaColor })],
    })));
  }
  children.push(new Paragraph(rtl({ spacing: { before: spacing.bottomSpacing } })));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      ltr(config.footerLeft || "", { size: 16, color: P.footerColor }),
      ltr("                                        "),
      ltr(config.footerRight || "", { size: 16, color: P.footerColor }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders, children })],
    })],
  })];
}

module.exports = {
  Document, Packer, Paragraph, TextRun, PageBreak, Header, Footer, PageNumber, NumberFormat, SectionType,
  AlignmentType, HeadingLevel, TableOfContents, BorderStyle,
  PAL, rtl, run, ltr, heading, body, bodyMixed, codeBlock, note, rtlTable, tableTitle, buildCoverR1,
};
