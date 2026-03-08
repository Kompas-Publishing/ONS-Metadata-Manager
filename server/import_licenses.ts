
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

import { db } from './db';
import { licenses } from '../shared/schema';
import { eq, like } from 'drizzle-orm';

// Paths to the CSV files
const FILE_2026 = "D:\\Desktop\\Work-Github\\Licenses\\Content totaal 2026 .csv";
const FILE_VERLOPEN = "D:\\Desktop\\Work-Github\\Licenses\\Content totaal 2026 verlopen.csv";

function parseDate(val: any): Date | null {
  if (!val) return null;
  const str = String(val).trim().toLowerCase();
  if (str === "" || str.includes("geen") || str.includes("onbeperkt") || str.includes("vooraf") || str.includes("nvt") || str.includes("verlopen") || str.includes("totaal")) {
    return null;
  }
  
  if (typeof val === 'number') {
    return new Date((val - 25569) * 86400 * 1000);
  }

  const cleanStr = str.replace(/\s+/g, '-').replace(/\//g, '-');
  const match = cleanStr.match(/(\d{1,4})-(\d{1,2})-(\d{1,4})/);
  if (match) {
    let day = parseInt(match[1]);
    let month = parseInt(match[2]);
    let year = parseInt(match[3]);
    if (day > 1000) { [year, month, day] = [day, month, year]; }
    if (year < 100) year += 2000;
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }
  
  const fallback = new Date(val);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function normalizeTitle(title: string): string {
  if (!title) return "";
  let t = title.trim();
  t = t.replace(/\s*\(?\d+\s*(?:afl|stuks|afleveringen|seizoen).*\)?/i, '');
  t = t.replace(/\s*-\s*\d+\s*seizoen.*/i, '');
  t = t.replace(/\s+\d+(?:[\.\-\s]\d+)?\s*$/i, ''); 
  t = t.replace(/\s+S\d+(?:E\d+)?\s*$/i, '');
  t = t.replace(/\s+Seizoen\s+\d+.*$/i, '');
  t = t.replace(/\s+Afl(?:\.|\evering)?\s*\d+.*$/i, '');
  t = t.replace(/\s+part\s+\d+.*$/i, '');
  t = t.replace(/[\-\.\s]+$/, '');
  return t.trim();
}

async function cleanupOldImports() {
    console.log("Cleaning up previous imports...");
    await db.delete(licenses).where(like(licenses.notes, 'Imported from CSV%'));
    console.log("Cleanup done.");
}

async function processFile(filePath: string, isExpiredFile: boolean) {
  console.log(`\nProcessing ${path.basename(filePath)}...`);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

  if (data.length === 0) return;

  const groups = new Map<string, any>();
  let startIndex = 0;
  if (!isExpiredFile) {
      for (let i = 0; i < Math.min(30, data.length); i++) {
          if (data[i].some(c => String(c).includes("Rechten")) || data[i].some(c => String(c).includes("Titel"))) {
              startIndex = i + 1;
              break;
          }
      }
  } else {
      startIndex = 0;
      if (String(data[0][0]).toLowerCase() === "tje") startIndex = 1;
  }

  for (let i = startIndex; i < data.length; i++) {
    const cols = data[i];
    if (cols.length < 2) continue;

    let distributor = String(cols[0] || "").trim();
    let rawTitle = String(cols[1] || "").trim();

    if (!rawTitle || rawTitle === "Titel") continue;
    // Stronger skip for section headers
    if (!distributor && rawTitle.toUpperCase() === rawTitle) continue;
    if (rawTitle.startsWith(';') || rawTitle.includes('---')) continue;

    let rowData: any = {};
    if (!isExpiredFile) {
        rowData = {
            distributor: distributor,
            title: rawTitle,
            fee: String(cols[6] || "").trim(),
            start: parseDate(cols[7]),
            end: parseDate(cols[8]),
            runs: String(cols[9] || "").trim(),
            rating: String(cols[10] || "").trim(),
            description: String(cols[13] || "").trim(),
            imdb: String(cols[14] || "").startsWith('http') ? String(cols[14]) : "",
            extra: { length: cols[2], clipName: cols[4], season: cols[11] }
        };
    } else {
        rowData = {
            distributor: distributor,
            title: rawTitle,
            fee: "", // Expired file doesn't have current fees
            start: null,
            end: parseDate(cols[6]),
            runs: String(cols[7] || "").trim(),
            rating: String(cols[8] || "").trim(),
            description: String(cols[9] || "").trim(),
            imdb: "",
            extra: { length: cols[2], note: cols[4] }
        };
        for (let j = 10; j < cols.length; j++) {
            if (String(cols[j]).startsWith('http')) { rowData.imdb = String(cols[j]); break; }
        }
    }

    const normalizedTitle = normalizeTitle(rowData.title);
    const key = `${rowData.distributor.toLowerCase()}|${normalizedTitle.toLowerCase()}`;

    if (!groups.has(key)) {
      groups.set(key, {
        name: normalizedTitle,
        distributor: rowData.distributor,
        contentTitle: normalizedTitle,
        licenseFeeAmount: rowData.fee,
        licenseStart: rowData.start,
        licenseEnd: rowData.end,
        allowedRuns: rowData.runs,
        contentRating: rowData.rating,
        description: rowData.description,
        imdbLink: rowData.imdb,
        rows: []
      });
    }

    const group = groups.get(key);
    group.rows.push(rowData);
    
    // Aggregate/Update metadata from rows
    if (!group.distributor && rowData.distributor) group.distributor = rowData.distributor;
    if (!group.description && rowData.description) group.description = rowData.description;
    if (!group.imdbLink && rowData.imdb) group.imdbLink = rowData.imdb;
    if (!group.licenseStart && rowData.start) group.licenseStart = rowData.start;
    if (!group.licenseEnd && rowData.end) group.licenseEnd = rowData.end;
    if (!group.licenseFeeAmount && rowData.fee) group.licenseFeeAmount = rowData.fee;
    if (!group.allowedRuns && rowData.runs) group.allowedRuns = rowData.runs;
    if (!group.contentRating && rowData.rating) group.contentRating = rowData.rating;
  }

  console.log(`Analyzing ${groups.size} potential licenses...`);

  let count = 0;
  for (const group of Array.from(groups.values())) {
    // FILTER LOGIC:
    // 1. Has a known distributor (not empty, not "Unknown")
    // 2. OR has a valid license fee
    // 3. OR has a valid end date
    const hasDistributor = group.distributor && group.distributor.toLowerCase() !== "unknown" && group.distributor !== "";
    const hasFee = group.licenseFeeAmount && group.licenseFeeAmount !== "" && group.licenseFeeAmount !== "0";
    const hasEndDate = group.licenseEnd !== null;

    if (!hasDistributor && !hasFee && !hasEndDate) {
        // Skip this group
        continue;
    }

    let notes = `Imported from CSV (${isExpiredFile ? 'Expired' : 'Active'}).\n`;
    if (isExpiredFile) notes += `!!! EXPIRED LICENSE !!!\n`;
    notes += `Original rows included:\n`;
    group.rows.forEach((r: any) => {
        notes += `- ${r.title}`;
        if (r.extra.season) notes += ` | Season: ${r.extra.season}`;
        if (r.extra.clipName) notes += ` | Clip: ${r.extra.clipName}`;
        if (r.extra.length) notes += ` | Length: ${r.extra.length}`;
        notes += `\n`;
    });

    try {
        await db.insert(licenses).values({
            name: group.name || "Untitled License",
            distributor: group.distributor || "Unknown",
            contentTitle: group.contentTitle,
            licenseFeeAmount: group.licenseFeeAmount,
            licenseStart: group.licenseStart,
            licenseEnd: group.licenseEnd,
            allowedRuns: group.allowedRuns,
            contentRating: group.contentRating,
            description: group.description,
            imdbLink: group.imdbLink,
            notes: notes
        });
        count++;
    } catch (err) {
        console.error(`Failed to insert license ${group.name}:`, err);
    }
  }
  console.log(`Successfully imported ${count} valid licenses.`);
}

async function run() {
  try {
    await cleanupOldImports();
    await processFile(FILE_2026, false);
    await processFile(FILE_VERLOPEN, true);
    console.log("\nImport process completed!");
  } catch (error) {
    console.error("Import process failed:", error);
  } finally {
    process.exit(0);
  }
}

run();
