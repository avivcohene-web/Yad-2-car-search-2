import { readFileSync } from "node:fs";
const API_KEY = process.env.REEF_API_KEY;
const BASE = process.env.REEF_BASE_URL || "https://api.reefapi.com";
if (!API_KEY) throw new Error("REEF_API_KEY is missing");

function arg(name: string, fallback: string) {
  const p = process.argv.find(x => x.startsWith(`--${name}=`));
  const v = p ? p.slice(name.length + 3) : "";
  return v ? v : fallback;
}
const price_max = Number(arg("price-max","12000"));
const year_min = Number(arg("year-min","2007"));
const mileage_max = Number(arg("mileage-max","220000"));
const hand_max = Number(arg("hand-max","5"));
const pages = Math.min(10, Math.max(1, Number(arg("pages","3"))));
const limit = Math.min(50, Math.max(1, Number(arg("limit","20"))));

async function reef(path:string, body:Record<string,unknown>) {
  const r=await fetch(`${BASE}${path}`,{
    method:"POST",
    headers:{"x-api-key":API_KEY!,"content-type":"application/json"},
    body:JSON.stringify(body)
  });
  const txt=await r.text();
  let data:any; try { data=JSON.parse(txt); } catch { throw new Error(`HTTP ${r.status}: ${txt.slice(0,500)}`); }
  if(!r.ok || data?.ok===false) throw new Error(data?.error?.message || `HTTP ${r.status}`);
  return data;
}
function arr(d:any):any[]{ return Array.isArray(d?.listings)?d.listings:Array.isArray(d?.items)?d.items:Array.isArray(d)?d:[]; }
function num(v:any){ if(typeof v==="number") return v; if(typeof v==="string"){const x=Number(v.replace(/[^0-9.]/g,"")); if(Number.isFinite(x))return x;} }
function txt(x:any){return [x?.title,x?.manufacturer?.name,x?.manufacturer,x?.model?.name,x?.model,x?.gearbox,x?.family_type,x?.description].filter(Boolean).join(" ").toLowerCase();}
const preferred=["sx4","swift","סוויפט","mazda 2","מאזדה 2","tiida","טידה","getz","גטס","i10","sirion","סיריון"];
const risky=["dsg","powershift","edc","robot","רובוט","stage 1","stage1"];
const all:any[]=[];
for(let page=1;page<=pages;page++){
  const r=await reef("/yad2/v1/cars/search",{price_max,year_min,year_max,mileage_max,hand_max,only_with_price:true,only_with_images:true,page});
  all.push(...arr(r.data));
}
const map=new Map<string,any>();
for(const x of all){const id=String(x.ad_id??x.id??x.token??x.url??JSON.stringify(x));if(!map.has(id))map.set(id,x);}
const clean=[...map.values()].filter(x=>{
 const price=num(x.price), year=num(x.year??x.vehicle_year), km=num(x.mileage??x.km), hand=num(x.hand);
 if(price===undefined || price<100 || price>price_max) return false;
 if(x.price_not_published===true || x.price_placeholder===true || x.payment_installments) return false;
 if(year===undefined || year<year_min || year>year_max) return false;
 if(km!==undefined && km>mileage_max) return false;
 if(hand!==undefined && hand>hand_max) return false;
 return true;
});
const results=clean.map(x=>{
 const price=num(x.price)??price_max, km=num(x.mileage??x.km), year=num(x.year??x.vehicle_year), hand=num(x.hand), t=txt(x);
 let score=50;
 score+=Math.max(0,(price_max-price)/price_max*18);
 if(km!==undefined)score+=Math.max(-10,(mileage_max-km)/mileage_max*14);
 if(year!==undefined)score+=Math.max(0,Math.min(12,(year-year_min)*1.2));
 if(hand!==undefined)score+=Math.max(-5,6-hand*1.2);
 if(preferred.some(k=>t.includes(k)))score+=8;
 if(/hatch|האצ.?בק|5 דלת/i.test(t))score+=4;
 if(risky.some(k=>t.includes(k)))score-=12;
 return {score:Math.round(score*10)/10,...x};
}).sort((a,b)=>b.score-a.score).slice(0,limit);
const out={generated_at:new Date().toISOString(),filters:{price_max,year_min,year_max,mileage_max,hand_max,pages,limit},unique_listings_scanned:map.size,clean_listings:clean.length,results};
process.stdout.write(JSON.stringify(out,null,2));
