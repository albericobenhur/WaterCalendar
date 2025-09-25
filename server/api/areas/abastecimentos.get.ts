import { defineEventHandler, getQuery, createError } from 'h3';

// Lista áreas de abastecimento (ID e Nome) filtrando por município e opcionalmente por bairro (fazemos contains no campo BAIRROS) 
export default defineEventHandler(async (event) => {
  const { municipio, bairro, q } = getQuery(event) as Record<string,string>;
  if(!municipio) throw createError({ statusCode:400, statusMessage:'Parâmetro municipio é obrigatório' });

  const clauses = [`MUNICIPIOS='${municipio.replace(/'/g, "''")}'`];
  if(bairro) clauses.push(`BAIRROS LIKE '%${bairro.replace(/'/g, "''")}%'`);
  if(q) clauses.push(`NOMABAST LIKE '%${q.replace(/'/g, "''").toUpperCase()}%'`);
  const where = clauses.join(' AND ');
  const base = 'https://geo.compesa.com.br:6443/arcgis/rest/services/Calendario/Calendario/MapServer/0/query';
  const params = new URLSearchParams({ f:'json', where, outFields:'ID,NOMABAST,BAIRROS,MUNICIPIOS', returnGeometry:'false' });
  const res = await fetch(`${base}?${params.toString()}`);
  if(!res.ok) throw createError({ statusCode: res.status, statusMessage:'Erro ao consultar áreas de abastecimento' });
  const data = await res.json();
  const items = (data.features||[]).map((f:any)=>({ id:f.attributes?.ID, nome:f.attributes?.NOMABAST, municipios:f.attributes?.MUNICIPIOS, bairros:f.attributes?.BAIRROS }));
  // Remover duplicados por id
  const map: Record<string, typeof items[0]> = {};
  for(const i of items){ if(i.id) map[i.id]=i; }
  return { municipio, bairro: bairro||null, areas: Object.values(map).sort((a,b)=> a.nome.localeCompare(b.nome,'pt-BR')) };
});
