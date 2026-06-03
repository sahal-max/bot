// Quick docx text extractor (no external deps): unzip the .docx to read word/document.xml
// docx is a zip; we use node's built-in zlib + manual zip parser via "fs" + "zlib"
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function readUInt32LE(buf, off) { return buf.readUInt32LE(off); }
function readUInt16LE(buf, off) { return buf.readUInt16LE(off); }

const file = process.argv[2];
if (!file) { console.error('usage: node extract_docx.js <file.docx>'); process.exit(1); }
const data = fs.readFileSync(file);

// Find End of Central Directory (EOCD) signature 0x06054b50 from end
let eocdOff = -1;
for (let i = data.length - 22; i >= 0 && i >= data.length - 65557; i--) {
  if (data.readUInt32LE(i) === 0x06054b50) { eocdOff = i; break; }
}
if (eocdOff < 0) { console.error('no EOCD'); process.exit(1); }
const cdSize = readUInt32LE(data, eocdOff + 12);
const cdOff = readUInt32LE(data, eocdOff + 16);
const totalEntries = readUInt16LE(data, eocdOff + 10);

let p = cdOff;
const entries = [];
for (let i = 0; i < totalEntries; i++) {
  if (data.readUInt32LE(p) !== 0x02014b50) { console.error('bad CD sig'); process.exit(1); }
  const compMethod = readUInt16LE(data, p + 10);
  const compSize = readUInt32LE(data, p + 20);
  const uncompSize = readUInt32LE(data, p + 24);
  const fnLen = readUInt16LE(data, p + 28);
  const exLen = readUInt16LE(data, p + 30);
  const cmLen = readUInt16LE(data, p + 32);
  const localOff = readUInt32LE(data, p + 42);
  const fname = data.slice(p + 46, p + 46 + fnLen).toString('utf8');
  entries.push({ fname, compMethod, compSize, uncompSize, localOff });
  p += 46 + fnLen + exLen + cmLen;
}

function extractEntry(e) {
  let lp = e.localOff;
  if (data.readUInt32LE(lp) !== 0x04034b50) throw new Error('bad LFH');
  const fnLen = readUInt16LE(data, lp + 26);
  const exLen = readUInt16LE(data, lp + 28);
  lp += 30 + fnLen + exLen;
  const compData = data.slice(lp, lp + e.compSize);
  if (e.compMethod === 0) return compData;
  if (e.compMethod === 8) return zlib.inflateRawSync(compData);
  throw new Error('unsupported method ' + e.compMethod);
}

const target = entries.find(e => e.fname === 'word/document.xml');
if (!target) { console.error('no document.xml'); process.exit(1); }
const xml = extractEntry(target).toString('utf8');

// Convert paragraphs/breaks to newlines, strip tags
let text = xml
  .replace(/<w:p\b[^>]*\/>/g, '\n')
  .replace(/<w:p\b[^>]*>/g, '\n')
  .replace(/<w:br\b[^>]*\/>/g, '\n')
  .replace(/<w:tab\b[^>]*\/>/g, '\t')
  .replace(/<[^>]+>/g, '');
text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
process.stdout.write(text);
