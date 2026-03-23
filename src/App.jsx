import { useState, useEffect, useCallback, useMemo } from "react";

const OPENSEA_KEY = "8e94b5cf550d4689aa7f76e93ccb706f";
const SLUG = "normies";
const NORMIES_API = "https://api.normies.art";
const CONTRACT = "0x9eb6e2025b64f340691e424b7fe7022ffde12438";

const TIERS = [
  { id:1, label:"T1", min:0,   max:490,      minPct:1, maxPct:4, color:"#4ade80", bg:"rgba(74,222,128,0.08)",  border:"rgba(74,222,128,0.3)"  },
  { id:2, label:"T2", min:491, max:890,      minPct:2, maxPct:4, color:"#fb923c", bg:"rgba(251,146,60,0.08)",  border:"rgba(251,146,60,0.3)"  },
  { id:3, label:"T3", min:891, max:Infinity, minPct:3, maxPct:4, color:"#f87171", bg:"rgba(248,113,113,0.08)", border:"rgba(248,113,113,0.3)" },
];
function getTier(px) { return TIERS.find(t => px >= t.min && px <= t.max) || TIERS[0]; }

// THE formula: cost per pixel in USD
// existingAP already burned into this NFT → counts as free pixels
function calcCPP(pixelCount, existingAP, priceEth, ethUsd) {
  const tier       = getTier(pixelCount);
  const priceUsd   = priceEth * ethUsd;
  const newApMin   = Math.floor(pixelCount * tier.minPct / 100);
  const newApMax   = Math.floor(pixelCount * tier.maxPct / 100);
  const totalApMin = (existingAP || 0) + newApMin;
  const totalApMax = (existingAP || 0) + newApMax;
  return {
    tier, priceUsd,
    newApMin, newApMax,
    totalApMin, totalApMax,
    costPerPxBest:  totalApMax > 0 ? priceUsd / totalApMax : Infinity,
    costPerPxWorst: totalApMin > 0 ? priceUsd / totalApMin : Infinity,
  };
}

async function fetchJ(url, opts={}) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function fetchEthPrice() {
  try {
    const d = await fetchJ("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    return d?.ethereum?.usd ?? null;
  } catch {
    try {
      const d = await fetchJ("https://api.coinbase.com/v2/prices/ETH-USD/spot");
      return parseFloat(d?.data?.amount) || null;
    } catch { return null; }
  }
}
const HEADERS = { "X-API-KEY": OPENSEA_KEY, accept: "application/json" };
const fetchListings  = () => fetchJ(`https://api.opensea.io/api/v2/listings/collection/${SLUG}/all?limit=50&order_by=eth_price&order_direction=asc`, { headers: HEADERS });
const fetchStats     = () => fetchJ(`https://api.opensea.io/api/v2/collections/${SLUG}/stats`, { headers: HEADERS });
const fetchMeta      = (id) => fetchJ(`${NORMIES_API}/normie/${id}/metadata`);

function parseEthPrice(l) {
  try { const v=l.price?.current?.value, d=l.price?.current?.decimals??18; return parseFloat(v)/Math.pow(10,d); }
  catch { return null; }
}
function parseTokenId(l) {
  try { return l.protocol_data?.parameters?.offer?.[0]?.identifierOrCriteria; }
  catch { return null; }
}

const fmtUsd = (n) => !isFinite(n)||n==null ? "—" : n<0.01 ? `$${n.toFixed(4)}` : n<1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
const fmtEth = (n) => n==null ? "—" : `${parseFloat(n).toFixed(4)} ETH`;

function Bar({ pct, color, h=3 }) {
  return (
    <div style={{height:h,background:"rgba(255,255,255,0.06)",borderRadius:99,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${Math.min(100,pct)}%`,background:color,borderRadius:99,transition:"width 0.5s ease"}}/>
    </div>
  );
}

function CPPBox({ label, value, sub, color }) {
  return (
    <div style={{background:`${color}0c`,border:`1px solid ${color}2e`,borderRadius:7,padding:"7px 10px",flex:1}}>
      <div style={{color:"#444",fontSize:8,letterSpacing:"0.06em",marginBottom:3}}>{label}</div>
      <div style={{color,fontSize:15,fontWeight:700,lineHeight:1}}>{value}</div>
      {sub && <div style={{color:"#444",fontSize:8,marginTop:3}}>{sub}</div>}
    </div>
  );
}

function NFTCard({ item, rank, ethUsd, bestCPP }) {
  const [hov,setHov] = useState(false);
  const { tokenId, priceEth, pixelCount, existingAP, traits, imageUrl, loading, error } = item;
  const calc = (pixelCount!=null&&priceEth&&ethUsd) ? calcCPP(pixelCount,existingAP||0,priceEth,ethUsd) : null;
  const { tier } = calc ?? { tier: TIERS[0] };
  const rel = calc && bestCPP>0 ? Math.min(1, bestCPP/calc.costPerPxBest) : 0;
  const scoreColor = rel>0.7?"#4ade80":rel>0.4?"#fb923c":"#f87171";
  const isBest = rank<=3;

  return (
    <div
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={()=>window.open(`https://opensea.io/assets/ethereum/${CONTRACT}/${tokenId}`,"_blank")}
      style={{
        background: hov?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.022)",
        border: hov?`1px solid ${tier.color}55`:isBest?"1px solid rgba(250,204,21,0.2)":"1px solid rgba(255,255,255,0.07)",
        borderRadius:10, overflow:"hidden", cursor:"pointer",
        transition:"all 0.2s ease",
        transform: hov?"translateY(-3px)":"none",
        boxShadow: hov?`0 10px 28px ${tier.color}18`:"none",
        animation:`cardIn 0.35s ease ${Math.min(rank-1,14)*30}ms both`,
      }}
    >
      <div style={{position:"relative"}}>
        {/* badges */}
        <div style={{position:"absolute",top:7,left:7,zIndex:2,display:"flex",gap:4}}>
          <span style={{background:"rgba(0,0,0,0.75)",color:"#555",fontSize:9,fontFamily:"monospace",padding:"2px 5px",borderRadius:3}}>#{rank}</span>
          {isBest&&<span style={{background:"rgba(250,204,21,0.15)",color:"#fbbf24",border:"1px solid rgba(250,204,21,0.3)",fontSize:9,padding:"2px 5px",borderRadius:3}}>🔥 TOP</span>}
        </div>
        {(existingAP>0)&&(
          <div style={{position:"absolute",top:7,right:7,zIndex:2}}>
            <span style={{background:"rgba(139,92,246,0.2)",color:"#a78bfa",border:"1px solid rgba(139,92,246,0.4)",fontSize:9,padding:"2px 6px",borderRadius:3}}>{existingAP} AP ✓</span>
          </div>
        )}
        {/* image */}
        <div style={{aspectRatio:"1/1",background:"#0a0a12"}}>
          {imageUrl?(
            <img src={imageUrl} alt={`#${tokenId}`} style={{width:"100%",height:"100%",objectFit:"cover",imageRendering:"pixelated",display:"block"}}/>
          ):loading?(
            <div style={{width:"100%",height:"100%",background:"linear-gradient(90deg,#0e0e1c 25%,#18182c 50%,#0e0e1c 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}}/>
          ):(
            <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#1a1a2a",fontSize:24}}>?</div>
          )}
          {hov&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:tier.color,fontSize:10}}>OPENSEA ↗</span>
          </div>}
        </div>
      </div>

      <div style={{padding:"10px 11px 12px",display:"flex",flexDirection:"column",gap:7}}>
        {/* Name + tier badge */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:13,color:"#ccc",fontWeight:700}}>Normie #{tokenId}</span>
          {calc&&<span style={{background:tier.bg,border:`1px solid ${tier.border}`,color:tier.color,fontSize:8,padding:"2px 6px",borderRadius:4}}>{tier.label}·{pixelCount}px</span>}
        </div>

        {/* Price */}
        <div style={{display:"flex",alignItems:"baseline",gap:6}}>
          <span style={{fontSize:16,color:"#f0f0f0",fontWeight:700}}>{fmtEth(priceEth)}</span>
          {ethUsd&&priceEth&&<span style={{fontSize:10,color:"#444"}}>≈{fmtUsd(priceEth*ethUsd)}</span>}
        </div>

        {loading&&(
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {[70,55,80].map((w,i)=>(
              <div key={i} style={{height:9,width:`${w}%`,background:"#161628",borderRadius:3,animation:`shimmer 1.4s ${i*0.15}s infinite`,backgroundSize:"200% 100%"}}/>
            ))}
          </div>
        )}

        {!loading&&!error&&calc&&(<>
          {/* Pixel bar */}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{color:"#444",fontSize:8}}>PIXEL COUNT</span>
              <span style={{color:tier.color,fontSize:8}}>{pixelCount}/1600</span>
            </div>
            <Bar pct={(pixelCount/1600)*100} color={tier.color}/>
          </div>

          {/* COST PER PIXEL — main metric */}
          <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:"8px 9px",border:"1px solid rgba(255,255,255,0.05)"}}>
            <div style={{fontSize:8,color:"#333",letterSpacing:"0.07em",marginBottom:6}}>KOSTEN PRO PIXEL (USD)</div>
            <div style={{display:"flex",gap:6}}>
              <CPPBox label="BEST (4% luck)" value={fmtUsd(calc.costPerPxBest)}  sub={`${calc.totalApMax} AP gesamt`} color="#4ade80"/>
              <CPPBox label={`WORST (${tier.minPct}% luck)`} value={fmtUsd(calc.costPerPxWorst)} sub={`${calc.totalApMin} AP gesamt`} color="#f87171"/>
            </div>
            {/* AP breakdown */}
            <div style={{marginTop:6,display:"flex",gap:4,flexWrap:"wrap"}}>
              {(existingAP>0)&&<span style={{fontSize:8,color:"#a78bfa",background:"rgba(139,92,246,0.1)",border:"1px solid rgba(139,92,246,0.2)",padding:"1px 6px",borderRadius:3}}>+{existingAP} bestehende AP</span>}
              <span style={{fontSize:8,color:"#555",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",padding:"1px 6px",borderRadius:3}}>+{calc.newApMin}–{calc.newApMax} aus Burn</span>
              <span style={{fontSize:8,color:"#666",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",padding:"1px 6px",borderRadius:3}}>= {calc.totalApMin}–{calc.totalApMax} AP total</span>
            </div>
          </div>

          {/* Value bar */}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{color:"#444",fontSize:8}}>DEAL-QUALITÄT</span>
              <span style={{color:scoreColor,fontSize:8}}>{(rel*100).toFixed(0)}% von besten</span>
            </div>
            <Bar pct={rel*100} color={scoreColor}/>
          </div>

          {/* Traits */}
          {traits?.length>0&&(
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
              {traits.slice(0,4).map((t,i)=>(
                <span key={i} style={{background:"rgba(255,255,255,0.03)",color:"#444",fontSize:7,padding:"1px 5px",borderRadius:3,border:"1px solid rgba(255,255,255,0.05)"}}>{t.value}</span>
              ))}
            </div>
          )}
        </>)}

        {!loading&&error&&<div style={{color:"#2a2a3a",fontSize:8}}>metadata nicht verfügbar</div>}
      </div>
    </div>
  );
}

export default function App() {
  const [items,        setItems]        = useState([]);
  const [ethUsd,       setEthUsd]       = useState(null);
  const [floor,        setFloor]        = useState(null);
  const [status,       setStatus]       = useState("idle");
  const [loadError,    setLoadError]    = useState(null);
  const [loadedCount,  setLoadedCount]  = useState(0);
  const [totalCount,   setTotalCount]   = useState(0);
  const [lastRefresh,  setLastRefresh]  = useState(null);

  const [search,      setSearch]      = useState("");
  const [sortBy,      setSortBy]      = useState("costBest");
  const [filterTier,  setFilterTier]  = useState(0);
  const [maxPriceEth, setMaxPriceEth] = useState("");
  const [onlyWithAP,  setOnlyWithAP]  = useState(false);

  const load = useCallback(async () => {
    setStatus("loading"); setLoadError(null); setItems([]);
    setLoadedCount(0); setTotalCount(0);

    const [ethPrice] = await Promise.all([
      fetchEthPrice().catch(()=>null),
      fetchStats().then(s=>setFloor(s?.total?.floor_price)).catch(()=>null),
    ]);
    setEthUsd(ethPrice);

    let listings=[];
    try {
      const data = await fetchListings();
      listings = (data.listings||[])
        .map(l=>({tokenId:parseTokenId(l),priceEth:parseEthPrice(l)}))
        .filter(i=>i.tokenId!=null&&i.priceEth>0);
    } catch(e) {
      setLoadError("OpenSea Listings konnten nicht geladen werden (CORS blockiert).\nNutze ein CORS-Browser-Plugin oder einen Backend-Proxy.\n\n"+e.message);
      setStatus("error"); return;
    }

    const skeletons = listings.map(i=>({...i,loading:true}));
    setItems(skeletons); setTotalCount(skeletons.length); setStatus("done");
    setLastRefresh(new Date());

    const enriched=[...skeletons]; let done=0;
    await Promise.all(skeletons.map(async(item,idx)=>{
      try {
        const meta  = await fetchMeta(item.tokenId);
        const attrs = meta.attributes||[];
        const pixelCount  = parseInt(attrs.find(a=>a.trait_type==="Pixel Count")?.value)||null;
        const existingAP  = (() => {
          const a = attrs.find(a=>typeof a.trait_type==="string"&&(
            a.trait_type.toLowerCase().includes("action point")||
            a.trait_type.toLowerCase()==="ap"||
            a.trait_type.toLowerCase().includes("canvas point")
          ));
          return a ? parseInt(a.value)||0 : 0;
        })();
        const traits = attrs.filter(a=>a.trait_type!=="Pixel Count"&&a.trait_type!=="Level"&&typeof a.value==="string");
        enriched[idx]={...item,loading:false,pixelCount,existingAP,traits,imageUrl:`${NORMIES_API}/normie/${item.tokenId}/image.png`};
      } catch { enriched[idx]={...item,loading:false,error:true}; }
      done++; setLoadedCount(done); setItems([...enriched]);
    }));
  }, []);

  useEffect(()=>{load();},[load]);

  const displayed = useMemo(()=>{
    let list = items.filter(i=>!i.loading&&!i.error&&i.pixelCount!=null&&i.priceEth!=null);
    if(search.trim()) list=list.filter(i=>String(i.tokenId).includes(search.trim()));
    if(maxPriceEth&&parseFloat(maxPriceEth)>0) list=list.filter(i=>i.priceEth<=parseFloat(maxPriceEth));
    if(filterTier>0){const t=TIERS[filterTier-1];list=list.filter(i=>i.pixelCount>=t.min&&i.pixelCount<=t.max);}
    if(onlyWithAP) list=list.filter(i=>(i.existingAP||0)>0);
    list.sort((a,b)=>{
      const ca=ethUsd?calcCPP(a.pixelCount,a.existingAP||0,a.priceEth,ethUsd):null;
      const cb=ethUsd?calcCPP(b.pixelCount,b.existingAP||0,b.priceEth,ethUsd):null;
      if(sortBy==="costBest")  return (ca?.costPerPxBest ??999)-(cb?.costPerPxBest ??999);
      if(sortBy==="costWorst") return (ca?.costPerPxWorst??999)-(cb?.costPerPxWorst??999);
      if(sortBy==="price")     return a.priceEth-b.priceEth;
      if(sortBy==="pixels")    return b.pixelCount-a.pixelCount;
      return 0;
    });
    return list;
  },[items,search,maxPriceEth,filterTier,onlyWithAP,sortBy,ethUsd]);

  const bestCPP = useMemo(()=>{
    if(!ethUsd||!displayed.length) return 1;
    const costs=displayed.map(i=>calcCPP(i.pixelCount,i.existingAP||0,i.priceEth,ethUsd).costPerPxBest).filter(isFinite);
    return costs.length?Math.min(...costs):1;
  },[displayed,ethUsd]);

  const inProgress = loadedCount<totalCount&&status==="done";
  const medals=["🥇","🥈","🥉"];

  return (
    <div style={{minHeight:"100vh",background:"#060610",color:"#c0c0d8",fontFamily:"'IBM Plex Mono',monospace"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes cardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        input,button{font-family:'IBM Plex Mono',monospace;}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#0a0a14}
        ::-webkit-scrollbar-thumb{background:#252540}
      `}</style>

      {/* Header */}
      <header style={{background:"rgba(6,6,16,0.97)",backdropFilter:"blur(16px)",borderBottom:"1px solid rgba(255,255,255,0.06)",position:"sticky",top:0,zIndex:40,padding:"0 20px"}}>
        <div style={{maxWidth:1300,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:54}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>🎮</span>
            <div>
              <div style={{fontSize:14,color:"#4ade80",fontWeight:700,letterSpacing:"0.04em"}}>NORMIES PIXEL HUNTER</div>
              <div style={{fontSize:8,color:"#333",letterSpacing:"0.08em"}}>GÜNSTIGSTE PIXEL PRO USD · BURN VALUE CALCULATOR</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            {ethUsd&&<span style={{fontSize:11,color:"#555"}}>ETH <span style={{color:"#fb923c"}}>${ethUsd?.toLocaleString()}</span></span>}
            {floor&&<span style={{fontSize:11,color:"#555"}}>FLOOR <span style={{color:"#4ade80"}}>{parseFloat(floor).toFixed(4)} ETH</span></span>}
            {lastRefresh&&<span style={{fontSize:8,color:"#333"}}>{lastRefresh.toLocaleTimeString()}</span>}
            <button onClick={load} style={{background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.3)",color:"#4ade80",padding:"5px 13px",borderRadius:6,fontSize:10,cursor:"pointer",letterSpacing:"0.04em"}}>↺ REFRESH</button>
          </div>
        </div>
      </header>

      <div style={{maxWidth:1300,margin:"0 auto",padding:"20px 20px"}}>

        {/* Formula box */}
        <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 16px",marginBottom:18,animation:"fadeIn 0.4s ease"}}>
          <div style={{fontSize:8,color:"#333",letterSpacing:"0.08em",marginBottom:9}}>▸ FORMEL: KOSTEN PRO PIXEL</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8}}>
            <div style={{fontSize:9,color:"#555",lineHeight:1.7}}>
              <span style={{color:"#4ade80"}}>BEST</span> = Preis (USD) ÷ (besteh. AP + Pixel × 4%)<br/>
              <span style={{color:"#333"}}>→ beste Luck beim Reveal</span>
            </div>
            <div style={{fontSize:9,color:"#555",lineHeight:1.7}}>
              <span style={{color:"#f87171"}}>WORST</span> = Preis (USD) ÷ (besteh. AP + Pixel × min%)<br/>
              <span style={{color:"#333"}}>→ schlechteste Luck</span>
            </div>
            <div style={{fontSize:9,color:"#555",lineHeight:1.7}}>
              <span style={{color:"#a78bfa"}}>BESTEH. AP</span> = bereits reingeburnte APs → senken Kosten pro Pixel<br/>
              <span style={{color:"#333"}}>direkt aus Normies Metadata</span>
            </div>
            <div style={{fontSize:9,color:"#555",lineHeight:1.7}}>
              {TIERS.map(t=>(
                <span key={t.id} style={{color:t.color,display:"block"}}>{t.label}: {t.min}–{t.max===Infinity?"1600":t.max}px → {t.minPct}%–{t.maxPct}% AP</span>
              ))}
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 16px",marginBottom:18,display:"flex",flexWrap:"wrap",gap:10,alignItems:"center"}}>
          {/* Search */}
          <div style={{display:"flex",alignItems:"center",gap:6,flex:"1 1 160px"}}>
            <span style={{color:"#333",fontSize:11}}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Token ID..." style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,color:"#c0c0d8",padding:"5px 9px",fontSize:10,outline:"none",width:"100%"}}/>
          </div>
          {/* Max ETH */}
          <div style={{display:"flex",alignItems:"center",gap:6,flex:"1 1 140px"}}>
            <span style={{color:"#444",fontSize:9,whiteSpace:"nowrap"}}>MAX ETH</span>
            <input type="number" value={maxPriceEth} onChange={e=>setMaxPriceEth(e.target.value)} placeholder="0.05" step="0.005" min="0" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,color:"#c0c0d8",padding:"5px 9px",fontSize:10,outline:"none",width:"100%"}}/>
          </div>
          {/* Sort */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {[{k:"costBest",l:"$/px BEST"},{k:"costWorst",l:"$/px WORST"},{k:"price",l:"PREIS"},{k:"pixels",l:"PIXEL"}].map(s=>(
              <button key={s.k} onClick={()=>setSortBy(s.k)} style={{background:sortBy===s.k?"rgba(74,222,128,0.12)":"rgba(255,255,255,0.03)",border:sortBy===s.k?"1px solid rgba(74,222,128,0.35)":"1px solid rgba(255,255,255,0.07)",color:sortBy===s.k?"#4ade80":"#444",padding:"4px 9px",borderRadius:5,fontSize:9,cursor:"pointer",transition:"all 0.15s"}}>
                {sortBy===s.k?"▼ ":""}{s.l}
              </button>
            ))}
          </div>
          {/* Tier filter */}
          <div style={{display:"flex",gap:4}}>
            {[{id:0,label:"ALLE",color:"#555"},...TIERS.map(t=>({id:t.id,label:t.label,color:t.color}))].map(f=>(
              <button key={f.id} onClick={()=>setFilterTier(f.id)} style={{background:filterTier===f.id?`${f.color}14`:"rgba(255,255,255,0.02)",border:filterTier===f.id?`1px solid ${f.color}44`:"1px solid rgba(255,255,255,0.06)",color:filterTier===f.id?f.color:"#444",padding:"4px 8px",borderRadius:5,fontSize:9,cursor:"pointer",transition:"all 0.15s"}}>
                {f.label}
              </button>
            ))}
          </div>
          {/* Only AP */}
          <label style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:9,color:onlyWithAP?"#a78bfa":"#444"}}>
            <input type="checkbox" checked={onlyWithAP} onChange={e=>setOnlyWithAP(e.target.checked)} style={{accentColor:"#a78bfa"}}/>
            NUR MIT AP
          </label>
          <div style={{marginLeft:"auto",fontSize:9,color:"#333"}}>{displayed.length} Ergebnisse</div>
        </div>

        {/* Top 3 */}
        {displayed.length>=3&&ethUsd&&(
          <div style={{marginBottom:18,animation:"fadeIn 0.5s ease"}}>
            <div style={{fontSize:8,color:"#333",letterSpacing:"0.08em",marginBottom:8}}>▸ TOP 3 DEALS</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8}}>
              {displayed.slice(0,3).map((item,i)=>{
                const c=calcCPP(item.pixelCount,item.existingAP||0,item.priceEth,ethUsd);
                return (
                  <div key={item.tokenId} onClick={()=>window.open(`https://opensea.io/assets/ethereum/${CONTRACT}/${item.tokenId}`,"_blank")}
                    style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(250,204,21,0.15)",borderRadius:9,padding:"10px 13px",cursor:"pointer",display:"flex",gap:10,alignItems:"center"}}>
                    <span style={{fontSize:22}}>{medals[i]}</span>
                    <div>
                      <div style={{fontSize:12,color:"#ccc",fontWeight:700}}>Normie #{item.tokenId}</div>
                      <div style={{fontSize:13,color:"#4ade80",fontWeight:700}}>{fmtUsd(c.costPerPxBest)} / px</div>
                      <div style={{fontSize:8,color:"#444",marginTop:2}}>{fmtEth(item.priceEth)} · {item.pixelCount}px · {c.totalApMax}AP (best)</div>
                      {(item.existingAP>0)&&<div style={{fontSize:8,color:"#a78bfa"}}>+{item.existingAP} besteh. AP</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Progress */}
        {inProgress&&(
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#333",marginBottom:4}}>
              <span>Lade Pixel-Daten...</span><span>{loadedCount}/{totalCount}</span>
            </div>
            <div style={{height:2,background:"rgba(255,255,255,0.05)",borderRadius:99}}>
              <div style={{height:"100%",width:`${(loadedCount/totalCount)*100}%`,background:"#4ade80",borderRadius:99,transition:"width 0.3s ease"}}/>
            </div>
          </div>
        )}

        {/* Loading */}
        {status==="loading"&&items.length===0&&(
          <div style={{textAlign:"center",padding:80,color:"#333"}}>
            <div style={{fontSize:28,animation:"blink 1s infinite",marginBottom:10}}>▌</div>
            <div style={{fontSize:11}}>VERBINDE MIT OPENSEA + COINGECKO...</div>
          </div>
        )}

        {/* Error */}
        {status==="error"&&(
          <div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:22,maxWidth:600}}>
            <div style={{color:"#f87171",fontSize:12,marginBottom:8}}>⚠ FEHLER</div>
            <pre style={{color:"#555",fontSize:9,whiteSpace:"pre-wrap",lineHeight:1.7}}>{loadError}</pre>
            <button onClick={load} style={{marginTop:12,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",color:"#f87171",padding:"5px 14px",borderRadius:6,fontSize:10,cursor:"pointer"}}>RETRY</button>
          </div>
        )}

        {/* Grid */}
        {displayed.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:12}}>
            {displayed.map((item,idx)=>(
              <NFTCard key={item.tokenId} item={item} rank={idx+1} ethUsd={ethUsd} bestCPP={bestCPP}/>
            ))}
          </div>
        )}

        {/* Skeleton grid while loading */}
        {items.filter(i=>i.loading).length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:12,marginTop:displayed.length>0?12:0}}>
            {items.filter(i=>i.loading).slice(0,8).map((item,i)=>(
              <div key={item.tokenId} style={{border:"1px solid rgba(255,255,255,0.04)",borderRadius:10,overflow:"hidden",opacity:0.4}}>
                <div style={{aspectRatio:"1/1",background:"linear-gradient(90deg,#0c0c1a 25%,#14142a 50%,#0c0c1a 75%)",backgroundSize:"200% 100%",animation:`shimmer 1.5s ${i*0.1}s infinite`}}/>
                <div style={{padding:"10px 11px"}}>
                  <div style={{fontSize:12,color:"#2a2a4a"}}>Normie #{item.tokenId}</div>
                  <div style={{fontSize:9,color:"#1a1a2a",marginTop:3}}>{fmtEth(item.priceEth)} · lädt...</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {status==="done"&&displayed.length===0&&loadedCount===totalCount&&totalCount>0&&(
          <div style={{textAlign:"center",padding:60,color:"#333",fontSize:10}}>KEINE LISTINGS PASSEN ZU DEINEM FILTER</div>
        )}

        {lastRefresh&&(
          <div style={{marginTop:48,textAlign:"center",fontSize:8,color:"#1a1a2a",letterSpacing:"0.06em"}}>
            SYNC {lastRefresh.toLocaleTimeString()} · OPENSEA + api.normies.art + COINGECKO · {CONTRACT.slice(0,12)}...
          </div>
        )}
      </div>
    </div>
  );
}
