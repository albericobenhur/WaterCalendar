import { defineEventHandler, createError } from 'h3';

/*
  Endpoint de municípios
  - Faz tentativa inicial usando returnDistinctValues (mais rápido se suportado).
  - Se falhar ou parecer incompleto, faz paginação manual (resultOffset/resultRecordCount) até esgotar.
  - Cache simples em memória por 30 minutos para reduzir latência e carga no serviço ArcGIS.
*/

interface ArcGisFeature { attributes?: { [k:string]: any } }
interface ArcGisResponse { features?: ArcGisFeature[]; exceededTransferLimit?: boolean }

const SERVICE_URL = 'https://geo.compesa.com.br:6443/arcgis/rest/services/Calendario/Calendario/MapServer/0/query';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos
let cacheData: { municipios: string[]; expires: number } | null = null;

export default defineEventHandler(async (event) => {
  const { q } = (event.context.params ? {} : event) && (event as any).req ? getQuerySafe(event) : {} as any;
  // se houver q, ignorar cache (busca dinâmica)
  const queryText = typeof q === 'string' && q.trim() ? q.trim() : '';
  if(!queryText && cacheData && cacheData.expires > Date.now()) {
    return cacheData;
  }
  // Cache hit
  if(!queryText && cacheData && cacheData.expires > Date.now()) {
    return cacheData;
  }

  let municipios: string[] | null = null;
  // 1) Tentar distinct direto
  try {
  municipios = await tryDistinct(queryText);
  } catch (_e) {
    // Ignora e cai no fallback
  }

  // 2) Fallback com paginação se necessário
  if(!municipios || municipios.length === 0) {
    municipios = await fetchAllPaged(queryText);
  }

  const payload = { municipios: municipios.sort((a,b)=> a.localeCompare(b,'pt-BR')), expires: Date.now() + CACHE_TTL_MS };
  cacheData = payload; // salvar cache
  return payload;
});

async function tryDistinct(q:string): Promise<string[]> {
  const params = new URLSearchParams({
    f: 'json',
    where: buildWhere(q),
    returnDistinctValues: 'true',
    outFields: 'MUNICIPIOS',
    returnGeometry: 'false'
  });
  const res = await fetch(`${SERVICE_URL}?${params.toString()}`);
  if(!res.ok) throw createError({ statusCode: res.status, statusMessage: 'Falha distinct municípios' });
  const data: ArcGisResponse = await res.json();
  return collectMunicipios(data.features || []);
}

async function fetchAllPaged(q:string): Promise<string[]> {
  const set = new Set<string>();
  const pageSize = 1000; // maxRecordCount reportado pelo serviço
  let offset = 0;
  while(true) {
    const params = new URLSearchParams({
      f: 'json',
      where: buildWhere(q),
      outFields: 'MUNICIPIOS',
      returnGeometry: 'false',
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
      orderByFields: 'MUNICIPIOS ASC'
    });
    const res = await fetch(`${SERVICE_URL}?${params.toString()}`);
    if(!res.ok) throw createError({ statusCode: res.status, statusMessage: 'Erro ao paginar municípios' });
    const data: ArcGisResponse = await res.json();
    const features = data.features || [];
    collectMunicipios(features).forEach(m => set.add(m));
    if(features.length < pageSize) break; // última página
    offset += pageSize;
    if(offset > 10000) break; // sanidade: evita loop infinito se serviço se comportar diferente
  }
  return Array.from(set);
}

function collectMunicipios(features: ArcGisFeature[]): string[] {
  const result: string[] = [];
  for(const f of features) {
    const raw = (f.attributes?.MUNICIPIOS as string | undefined)?.trim();
    if(!raw) continue;
    // Normaliza delimitadores e remove espaços duplicados
    raw.split(',').map(s=>s.trim()).filter(Boolean).forEach(v=> result.push(v));
  }
  return result;
}

function buildWhere(q:string){
  if(!q) return "MUNICIPIOS IS NOT NULL";
  const safe = q.replace(/'/g, "''");
  return `MUNICIPIOS LIKE '%${safe}%'`;
}

// Helper seguro para extrair query (evita necessidade de importar getQuery fora escopo nuxt/h3 se não disponível globalmente)
function getQuerySafe(event:any){
  try { return event?.req?.query || event?.context?.query || {}; } catch { return {}; }
}
