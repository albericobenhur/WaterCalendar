import type { H3Event } from 'h3';
import { defineEventHandler, getQuery, createError } from 'h3';

// Status mapping heuristics based on DESCRICAO_SERVICO text
// Pode ser refinado posteriormente com regras mais específicas.
function classify(descricao: string): DayStatus {
  const desc = (descricao || '').toLowerCase();
  if(desc.includes('rompimento') || desc.includes('conserto') || desc.includes('manuten')) return 'manutencao';
  if(desc.includes('parcial')) return 'abastecimento-parcial';
  if(desc.includes('abastec')) return 'abastecimento';
  return 'abastecimento-parcial'; // fallback provisório quando há evento mas sem palavra-chave clara
}

type DayStatus = 'sem-abastecimento' | 'abastecimento-parcial' | 'manutencao' | 'abastecimento';

interface ArcGisFeature { attributes: Record<string, any> }
interface ArcGisResponse { features: ArcGisFeature[] }

export default defineEventHandler(async (event: H3Event) => {
  const { area, month, year } = getQuery(event) as Record<string,string>;
  if(!area || !month || !year) throw createError({ statusCode:400, statusMessage:'Parâmetros obrigatórios: area, month, year' });
  const m = parseInt(month,10); const y = parseInt(year,10);
  if(isNaN(m) || isNaN(y) || m<1 || m>12) throw createError({ statusCode:400, statusMessage:'Parâmetros inválidos' });

  // Camadas (layers) e mapeamento de campos observados
  const layers = [
    { layer:2, areaField:'ID_AREA_ABASTECIMENTO', startField:'INICIO_PREVISTO', endField:'TERMINO_PREVISTO', statusSource:'DESCRICAO_SERVICO', extra:['DESCRICAO_SERVICO'] },
    { layer:5, areaField:'ID', startField:'Inicio', endField:'Termino', statusSource:'colapso', extra:['colapso'] }
  ];
  const mm = String(m).padStart(2,'0');
  const yearStr = String(y);

  interface Aggregated { layer:number; attrs:Record<string,any> }
  const aggregated: Aggregated[] = [];
  const attempts:any[] = [];

  for(const cfg of layers) {
    const whereRaw = `(${cfg.areaField}='${area}') AND (DATEPART(MONTH,${cfg.startField})='${mm}' OR DATEPART(MONTH,${cfg.endField} )='${mm}') AND (DATEPART(YEAR,${cfg.startField})='${yearStr}')`;
    const outFields = [cfg.startField, cfg.endField, ...cfg.extra].join(',');
    const url = `https://geo.compesa.com.br:6443/arcgis/rest/services/Calendario/Calendario/MapServer/${cfg.layer}/query?f=json&where=${encodeURIComponent(whereRaw)}&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=${encodeURIComponent(outFields)}`;
    let json:ArcGisResponse|undefined; let status=0; let ok=false;
    try {
      const res = await fetch(url);
      status = res.status;
      if(res.ok) { json = await res.json() as ArcGisResponse; ok=true; }
    } catch(e:any) {
      attempts.push({ layer:cfg.layer, error:e.message });
      continue;
    }
    attempts.push({ layer:cfg.layer, where: whereRaw, status, count: json?.features?.length||0 });
    if(ok && json?.features?.length) {
      for(const f of json.features) aggregated.push({ layer:cfg.layer, attrs: f.attributes || {} });
    }
  }

  const dayStatus: Record<string, DayStatus> = {};
  const dayDetails: Record<string, any[]> = {};

  for(const row of aggregated) {
    const { layer, attrs } = row;
    const startVal = attrs['INICIO_PREVISTO'] ?? attrs['Inicio'];
    const endVal = attrs['TERMINO_PREVISTO'] ?? attrs['Termino'];
    if(!startVal || !endVal) continue;
    const start = new Date(startVal);
    const end = new Date(endVal);
    let statusClass: DayStatus;
    if(layer === 2) statusClass = classify(attrs.DESCRICAO_SERVICO || '');
    else if(layer === 5) statusClass = attrs.colapso ? 'manutencao' : 'abastecimento';
    else statusClass = 'abastecimento-parcial';

    for(let dt = new Date(start); dt <= end; dt.setUTCDate(dt.getUTCDate()+1)) {
      if(dt.getUTCFullYear() !== y || (dt.getUTCMonth()+1) !== m) continue;
      const key = dt.toISOString().substring(0,10);
      const current = dayStatus[key];
      if(!current) dayStatus[key] = statusClass; else if(priority(statusClass) < priority(current)) dayStatus[key] = statusClass;
      (dayDetails[key] ||= []).push({ ...attrs, status: statusClass, _layer: layer });
    }
  }

  const debug = (getQuery(event) as any).debug;
  return { area, year:y, month:m, days: dayStatus, dayDetails, totalEvents: aggregated.length, attempts: debug ? attempts : undefined };
});

function priority(s:DayStatus){
  switch(s){
    case 'manutencao': return 0;
    case 'abastecimento-parcial': return 1;
    case 'abastecimento': return 2;
    default: return 3;
  }
}

// Mantido apenas se necessário no futuro
// function localKey(d:Date){
//   const y = d.getFullYear();
//   const m = String(d.getMonth()+1).padStart(2,'0');
//   const day = String(d.getDate()).padStart(2,'0');
//   return `${y}-${m}-${day}`;
// }
