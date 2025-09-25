import { defineEventHandler, getQuery, createError } from 'h3';

export default defineEventHandler(async (event) => {
  const { q } = getQuery(event) as Record<string,string>;
  if(!q || q.trim().length < 2) return { items: [] };
  const term = q.trim().replace(/'/g, "''");
  // LIKE case-insensitive no ArcGIS: usar UPPER(campo)
  const U = term.toUpperCase();
  const whereRaw = `(
    UPPER(NOMABAST) LIKE '%${U}%'
    OR UPPER(NOMECALEND) LIKE '%${U}%'
    OR UPPER(MUNICIPIOS) LIKE '%${U}%'
    OR UPPER(BAIRROS) LIKE '%${U}%'
  )`;
  const where = encodeURIComponent(whereRaw);
  const outFields = encodeURIComponent('*');
  // Forçar saída em 4326 para evitar conversão manual quando possível
  const url = `https://geo.compesa.com.br:6443/arcgis/rest/services/Calendario/Calendario/MapServer/0/query?f=json&where=${where}&returnGeometry=true&outSR=4326&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=${outFields}`;
  const res = await fetch(url);
  if(!res.ok) throw createError({ statusCode:res.status, statusMessage:'Falha busca remota' });
  const data = await res.json();
  interface RawItem { id?:string; nomeCalend?:string; nomeAbast?:string; municipio?:string; bairro?:string; center?:{x:number;y:number}|null }
  const rawItems: RawItem[] = (data.features||[]).map((f:any)=>({
    id: f.attributes?.ID as string | undefined,
    nomeCalend: f.attributes?.NOMECALEND as string | undefined,
    nomeAbast: f.attributes?.NOMABAST as string | undefined,
    municipio: f.attributes?.MUNICIPIOS as string | undefined,
    bairro: f.attributes?.BAIRROS as string | undefined,
    center: f.geometry ? centroidOfGeom(f.geometry) : null
  }));
  // Score simples: prioridade para match mais curto no nome de abastecimento / município
  const scored = rawItems.map((r:RawItem)=>({
    ...r,
    score: scoreMatch(r, U)
  })).sort((a:any,b:any)=> a.score - b.score).filter((r:RawItem)=> r.id);
  const items = scored.slice(0,25);
  const debug = (getQuery(event) as any).debug;
  return { q, count: items.length, items, where: debug ? whereRaw : undefined, rawCount: rawItems.length };
});

function centroidOfGeom(geom:any){
  // geometry could be point or polygon or multipatch etc.
  if(!geom) return null;
  if(typeof geom.x === 'number' && typeof geom.y === 'number') return { x: geom.x, y: geom.y };
  if(Array.isArray(geom.rings)){
    let xs:number[] = []; let ys:number[] = [];
    for(const ring of geom.rings) for(const [x,y] of ring){ xs.push(x); ys.push(y); }
    if(xs.length && ys.length){
      const x = (Math.min(...xs)+Math.max(...xs))/2;
      const y = (Math.min(...ys)+Math.max(...ys))/2;
      return { x, y };
    }
  }
  return null;
}

function scoreMatch(r:any, term:string){
  const fields = [r.nomeAbast, r.nomeCalend, r.municipio, r.bairro].filter(Boolean) as string[];
  if(!fields.length) return 9999;
  let best = 5000;
  for(const f of fields){
    const up = f.toUpperCase();
    const idx = up.indexOf(term);
    if(idx !== -1){
      // menor índice + diferença de tamanho
      const localScore = idx * 2 + Math.abs(up.length - term.length);
      if(localScore < best) best = localScore;
    }
  }
  return best;
}
