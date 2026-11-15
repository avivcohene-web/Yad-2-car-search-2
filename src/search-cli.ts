import { readFileSync } from "node:fs";

const API_KEY = process.env.REEF_API_KEY;
const BASE = process.env.REEF_BASE_URL || "https://api.reefapi.com";
if (!API_KEY) throw new Error("REEF_API_KEY is missing");

function arg(name: string, fallback: string) {
  const p = process.argv.find(x => x.startsWith(`--${name}=`));
  const v = p ? p.slice(name.length + 3) : "";
  return v || fallback;
}

let req: any = {};
try { req = JSON.parse(readFileSync("search-request.json", "utf8")); } catch {}

const price_max = Number(arg("price-max", String(req.price_max ?? 14000)));
const target_price_max = Number(req.target_price_max ?? 12000);
const year_min = Number(arg("year-min", String(req.year_min ?? 2005)));
const year_max = Number(arg("year-max", String(req.year_max ?? 2015)));
const mileage_max = Number(arg("mileage-max", String(req.mileage_max ?? 240000)));
const hand_max = Number(arg("hand-max", String(req.hand_max ?? 7)));
const pages = Math.min(10, Math.max(1, Number(arg("pages", String(req.pages ?? 10)))));
const limit = Math.min(50, Math.max(1, Number(arg("limit", String(req.limit ?? 50)))));

async function reef(path: string, body: Record<string, unknown>) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {"x-api-key": API_KEY!, "content-type": "application/json"},
    body: JSON.stringify(body)
  });
  const responseText = await r.text();
  let data: any;
  try { data = JSON.parse(responseText); }
  catch { throw new Error(`HTTP ${r.status}: ${responseText.slice(0, 500)}`); }
  if (!r.ok || data?.ok === false) throw new Error(data?.error?.message || `HTTP ${r.status}`);
  return data;
}

function arr(d: any): any[] {
  return Array.isArray(d?.listings) ? d.listings : Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : [];
}
function num(v: any): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const x = Number(v.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(x)) return x;
  }
  return undefined;
}
function primitive(v: any): string {
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (v && typeof v === "object") return String(v.name ?? v.title ?? v.value ?? "");
  return "";
}
function txt(x: any) {
  return [x?.title, x?.manufacturer, x?.model, x?.sub_model, x?.subModel, x?.gearbox, x?.family_type, x?.description]
    .map(primitive).filter(Boolean).join(" ").toLowerCase();
}
const reliableModelNames = [
  "מאזדה 2", "מאזדה 3", "מאזדה 6", "mazda 2", "mazda 3", "mazda 6",
  "סיוויק", "civic", "ג'אז", "ג׳אז", "jazz", "אקורד", "accord",
  "קורולה", "corolla", "יאריס", "yaris", "אוריס", "auris", "קאמרי", "camry",
  "סוויפט", "swift", "sx4", "ספלאש", "splash", "אלטו", "alto", "סלריו", "celerio",
  "גטס", "getz", "i10", "i20", "i30", "אקסנט", "accent", "אלנטרה", "elantra",
  "ריו", "rio", "פיקנטו", "picanto", "סיד", "ceed", "סראטו", "cerato",
  "סיריון", "sirion", "מיקרה", "micra", "נוט", "note", "טידה", "tiida",
  "פוקוס", "focus", "פיאסטה", "fiesta", "פאביה", "fabia",
  "אימפרזה", "impreza", "b3", "lancer", "לנסר", "קולט", "colt"
];
// Exclude only explicit powertrain risks. Unknown versions are flagged for inspection, not assumed safe.
const rejectedBrands = /פיג['׳’]?ו|peugeot|סיטרואן|citro[eë]n|citroen|רנו|renault|דאצ'יה|dacia/i;
const rejectedTransmissions = /\b(dsg\s*7|dq200|powershift|power\s*shift|edc|i-?shift|m-?mt|dual?ogic|al4)\b|מצמדים? יבשים|גיר רובוטי|רובוטית|רובוטי חד|רצועת טיימינג רטובה|רצועה רטובה|wet.?belt|puretech/i;
const automaticSignals = /אוט(?:׳|'|ומט)|automatic|tiptronic|פלנטרי|cvt|dsg|רציף/i;
const manualSignals = /ידני|manual|manual transmission/i;
function knownHighRisk(t: string, year: number | undefined, cc: number | undefined) {
  if (rejectedBrands.test(t) || rejectedTransmissions.test(t)) return true;
  // 2013+ petrol Ceed 135 hp used a dual-clutch DCT, not the earlier 4-speed automatic.
  if (year !== undefined && year >= 2013 && year <= 2015 && /(ceed|סיד)/i.test(t) && /(135|gdi)/i.test(t) && automaticSignals.test(t)) return true;
  // 1.2 Micra CVT generation: avoid the Jatco CVT for this low-risk search.
  if (year !== undefined && year >= 2010 && year <= 2015 && /(micra|מיקרה)/i.test(t) && /1\.2|1198/.test(t) && automaticSignals.test(t)) return true;
  if (manualSignals.test(t) && !automaticSignals.test(t)) return true;
  // Keep known higher-risk CVT combinations outside this low-risk shortlist.
  if (year !== undefined && year >= 2012 && /(subaru|סובארו|impreza|אימפרזה)/i.test(t) && /אוט|automatic/i.test(t)) return true;
  if (year !== undefined && year >= 2008 && /(lancer|לנסר)/i.test(t) && /(1\.8|1798)/.test(t) && automaticSignals.test(t)) return true;
  // Ford Focus/Fiesta automatic dual-clutch variants: verify year before applying.
  if (year !== undefined && year >= 2012 && year <= 2016 && /(focus|פוקוס|fiesta|פיאסטה)/i.test(t) && automaticSignals.test(t)) return true;
  // Common dry-clutch DQ200 combinations in Israeli-market VW-group listings.
  if (year !== undefined && year >= 2009 && year <= 2015 && /(golf|גולף|polo|פולו|ibiza|איביזה|fabia|פאביה|octavia|אוקטביה)/i.test(t)
      && automaticSignals.test(t) && /(1\.2|1\.4|tsi|turbo|טורבו)/i.test(t)) return true;
  if (year !== undefined && year >= 2009 && year <= 2013 && /(golf|גולף)/i.test(t) && automaticSignals.test(t) && /1\.6/.test(t)) return true;
  return false;
}
function warnings(t: string, year?: number) {
  const out: string[] = [];
  if (!automaticSignals.test(t)) out.push("סוג גיר לא מאומת במודעה");
  if (/\b(cvt|dsg|טורבו|turbo)\b|גיר רציף/i.test(t)) out.push("לאמת תיבת הילוכים ומנוע לפי רישיון");
  if (year !== undefined && year >= 2006 && year <= 2011 && /(civic|סיוויק)/i.test(t) && /האצ'?בק|hatch/i.test(t))
    out.push("סיוויק האצ'בק מהשנים האלה: לוודא שאינה i-Shift רובוטית");
  if (year !== undefined && year >= 2006 && year <= 2010 && /(yaris|יאריס|corolla|קורולה)/i.test(t))
    out.push("לבדוק אם הגיר רובוטי חד-מצמדי או פלנטרי");
  return out;
}

const all: any[] = [];
for (let page = 1; page <= pages; page++) {
  const r = await reef("/yad2/v1/cars/search", {
    price_max, year_min, year_max, mileage_max, hand_max,
    only_with_price: true, only_with_images: true, page
  });
  all.push(...arr(r.data));
}
const unique = new Map<string, any>();
for (const x of all) {
  const id = String(x.ad_id ?? x.id ?? x.token ?? x.url ?? JSON.stringify(x));
  if (!unique.has(id)) unique.set(id, x);
}
const clean = [...unique.values()].filter(x => {
  const price = num(x.price), year = num(x.year ?? x.vehicle_year), km = num(x.mileage ?? x.km), hand = num(x.hand);
  if (price === undefined || price < 1000 || price > price_max) return false;
  if (x.price_not_published === true || x.price_placeholder === true || x.payment_installments) return false;
  if (year === undefined || year < year_min || year > year_max) return false;
  if (km !== undefined && km > mileage_max) return false;
  if (hand !== undefined && hand > hand_max) return false;
  const t = txt(x);
  if (knownHighRisk(t, year, num(x.engine_cc ?? x.engine))) return false;
  return true;
});
const ranked = clean.map(x => {
  const price = num(x.price) ?? price_max, km = num(x.mileage ?? x.km);
  const year = num(x.year ?? x.vehicle_year), hand = num(x.hand), t = txt(x);
  let score = 50;
  score += Math.max(0, (price_max - price) / price_max * 12);
  if (price <= target_price_max) score += 9;
  if (km !== undefined) score += Math.max(-10, (mileage_max - km) / mileage_max * 16);
  if (year !== undefined) score += Math.max(0, Math.min(12, (year - year_min) * 0.8));
  if (hand !== undefined) score += Math.max(-5, 7 - hand * 1.1);
  if (reliableModelNames.some(k => t.includes(k))) score += 12;
  if (automaticSignals.test(t)) score += 6;
  if (price < 4000) score -= 5;
  const warningList = warnings(t, year);
  if (warningList.length) score -= 3 * warningList.length;
  return { score: Math.round(score * 10) / 10, verification_needed: warningList, ...x };
}).sort((a, b) => b.score - a.score).slice(0, limit);

const out = {
  generated_at: new Date().toISOString(),
  filters: { price_max, target_price_max, year_min, year_max, mileage_max, hand_max, pages, limit, body_styles: "all" },
  warning: "Preliminary shortlist only. Ad text can omit transmission details; verify exact engine and gearbox by license/VIN. No ad is approved for purchase without inspection.",
  unique_listings_scanned: unique.size,
  clean_listings: clean.length,
  results: ranked
};
process.stdout.write(JSON.stringify(out, null, 2));
