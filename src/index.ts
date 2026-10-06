import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_KEY = process.env.REEF_API_KEY;
const BASE = process.env.REEF_BASE_URL || "https://api.reefapi.com";

if (!API_KEY) {
  console.error("Missing REEF_API_KEY");
  process.exit(1);
}

async function reef(path: string, body: Record<string, unknown>) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY!,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok || data?.ok === false) {
    throw new Error(data?.error?.message || `ReefAPI error ${r.status}`);
  }
  return data;
}

const server = new McpServer({
  name: "yad2-car-hunter",
  version: "0.1.0"
});

const searchSchema = {
  price_max: z.number().int().positive().optional().describe("Maximum price in ILS"),
  price_min: z.number().int().nonnegative().optional(),
  year_min: z.number().int().min(1980).max(2030).optional(),
  year_max: z.number().int().min(1980).max(2030).optional(),
  mileage_max: z.number().int().positive().optional(),
  mileage_min: z.number().int().nonnegative().optional(),
  hand_max: z.number().int().positive().optional(),
  manufacturer_id: z.number().int().optional(),
  model_id: z.number().int().optional(),
  engine_cc_min: z.number().int().optional(),
  engine_cc_max: z.number().int().optional(),
  fuel: z.string().optional(),
  gearbox: z.string().optional(),
  family_type: z.string().optional(),
  area_id: z.number().int().optional(),
  top_area_id: z.number().int().optional(),
  seller_type: z.string().optional(),
  only_with_price: z.boolean().default(true),
  only_with_images: z.boolean().optional(),
  sort: z.string().optional(),
  page: z.number().int().min(1).default(1)
};

server.tool(
  "search_yad2_cars",
  "Search live Yad2 vehicle listings through ReefAPI. Returns listing URLs and structured vehicle data.",
  searchSchema,
  async (args) => {
    const res = await reef("/yad2/v1/cars/search", args);
    return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
  }
);

server.tool(
  "get_yad2_listing",
  "Get the full live Yad2 record for a listing ID or Yad2 listing URL.",
  {
    ad_id: z.string().min(1).describe("Yad2 ad id or listing URL"),
    include_pii: z.boolean().default(false)
  },
  async ({ ad_id, include_pii }) => {
    const res = await reef("/yad2/v1/listing", { ad_id, vertical: "cars", include_pii });
    return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
  }
);

function n(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const x = Number(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(x) ? x : undefined;
  }
}

function listingArray(data: any): any[] {
  if (Array.isArray(data?.listings)) return data.listings;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function textOf(x: any) {
  return [x?.title, x?.manufacturer?.name, x?.manufacturer, x?.model?.name, x?.model, x?.gearbox, x?.family_type]
    .filter(Boolean).join(" ").toLowerCase();
}

server.tool(
  "find_best_yad2_deals",
  "Search several live Yad2 pages and rank promising used-car ads. This is a shortlist heuristic, not a mechanical inspection.",
  {
    price_max: z.number().int().positive().default(12000),
    year_min: z.number().int().min(1980).max(2030).default(2007),
    mileage_max: z.number().int().positive().default(220000),
    hand_max: z.number().int().positive().default(5),
    top_area_id: z.number().int().optional().describe("Yad2 top-area id; omit for broad search"),
    gearbox: z.string().optional(),
    pages: z.number().int().min(1).max(10).default(3),
    limit: z.number().int().min(1).max(50).default(15),
    prefer_hatchback: z.boolean().default(true)
  },
  async ({ price_max, year_min, mileage_max, hand_max, top_area_id, gearbox, pages, limit, prefer_hatchback }) => {
    const all: any[] = [];
    for (let page = 1; page <= pages; page++) {
      const body: Record<string, unknown> = {
        price_max, year_min, mileage_max, hand_max,
        only_with_price: true, only_with_images: true, page
      };
      if (top_area_id !== undefined) body.top_area_id = top_area_id;
      if (gearbox) body.gearbox = gearbox;
      const res = await reef("/yad2/v1/cars/search", body);
      all.push(...listingArray(res.data));
    }

    const dedup = new Map<string, any>();
    for (const x of all) {
      const id = String(x.ad_id ?? x.id ?? x.token ?? x.url ?? JSON.stringify(x));
      if (!dedup.has(id)) dedup.set(id, x);
    }

    const preferred = ["sx4", "סוויפט", "swift", "מאזדה 2", "mazda 2", "טידה", "tiida", "גטס", "getz", "i10"];
    const caution = ["dsg", "powershift", "edc", "robot", "רובוט", "turbo", "טורבו", "stage 1"];

    const ranked = [...dedup.values()].map(x => {
      const price = n(x.price) ?? price_max;
      const km = n(x.mileage ?? x.km);
      const year = n(x.year ?? x.vehicle_year);
      const hand = n(x.hand);
      const t = textOf(x);
      let score = 50;
      score += Math.max(0, (price_max - price) / price_max * 18);
      if (km !== undefined) score += Math.max(-10, (mileage_max - km) / mileage_max * 14);
      if (year !== undefined) score += Math.max(0, Math.min(12, (year - year_min) * 1.2));
      if (hand !== undefined) score += Math.max(-5, 6 - hand * 1.2);
      if (preferred.some(k => t.includes(k))) score += 8;
      if (prefer_hatchback && /(hatch|האצ.?בק|5 דלת)/i.test(t)) score += 4;
      if (caution.some(k => t.includes(k))) score -= 12;
      return { score: Math.round(score * 10) / 10, ...x };
    }).sort((a,b) => b.score - a.score).slice(0, limit);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          searched_pages: pages,
          unique_listings_scanned: dedup.size,
          note: "Heuristic ranking only. Ask the assistant to assess exact engine/gearbox reliability and inspect listing details before purchase.",
          results: ranked
        }, null, 2)
      }]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
