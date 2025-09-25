import { defineEventHandler, getQuery, createError } from 'h3';

// Retorna lista de bairros para um município (campo BAIRROS ou COD_BAIRRO)
export default defineEventHandler(async (event) => {
  const { municipio, q } = getQuery(event) as Record<string,string>;
  if(!municipio) throw createError({ statusCode:400, statusMessage:'Parâmetro municipio é obrigatório' });

  // Filtramos pelo campo MUNICIPIOS = 'xxx'
  const baseClause = `MUNICIPIOS='${municipio.replace(/'/g, "''")}'`;
  const where = q ? `${baseClause} AND BAIRROS LIKE '%${q.replace(/'/g, "''").toUpperCase()}%'` : baseClause;
  const base = 'https://geo.compesa.com.br:6443/arcgis/rest/services/Calendario/Calendario/MapServer/0/query';
  const params = new URLSearchParams({ f:'json', where, outFields:'BAIRROS,COD_BAIRRO', returnGeometry:'false' });
  const res = await fetch(`${base}?${params.toString()}`);
  if(!res.ok) throw createError({ statusCode: res.status, statusMessage:'Erro ao consultar bairros' });
  const data = await res.json();
  const bairrosSet = new Set<string>();
  const codMap: Record<string,string> = {}; // nome -> lista codigos
  for(const f of data.features || []) {
    const braw = f.attributes?.BAIRROS as string | undefined;
    const craw = f.attributes?.COD_BAIRRO as string | undefined;
    if(braw) {
      const names = braw.split(',').map(s=>s.trim()).filter(Boolean);
      const codes = (craw||'').split(',').map(s=>s.trim()).filter(Boolean);
      names.forEach((n,i)=>{ bairrosSet.add(n); if(codes[i]) codMap[n] = codes[i]; });
    }
  }
  return { municipio, bairros: Array.from(bairrosSet).sort((a,b)=>a.localeCompare(b,'pt-BR')), codigos: codMap };
});
