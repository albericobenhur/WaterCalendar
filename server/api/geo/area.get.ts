import { defineEventHandler, getQuery, createError } from 'h3';

// Simple WebMercator projection (spherical) from lon/lat in degrees
function projectWebMercator(lon:number, lat:number){
  const R = 6378137.0;
  const x = lon * Math.PI / 180 * R;
  const y = Math.log(Math.tan(Math.PI/4 + (lat * Math.PI/180)/2)) * R;
  return { x, y };
}

export default defineEventHandler(async (event) => {
  const { lat, lon } = getQuery(event) as Record<string,string>;
  if(!lat || !lon) throw createError({ statusCode:400, statusMessage:'Parâmetros obrigatórios: lat, lon' });
  const latNum = parseFloat(lat); const lonNum = parseFloat(lon);
  if(Number.isNaN(latNum) || Number.isNaN(lonNum)) throw createError({ statusCode:400, statusMessage:'lat/lon inválidos' });

  // Limites básicos de coordenadas
  if(latNum > 90 || latNum < -90 || lonNum > 180 || lonNum < -180) throw createError({ statusCode:400, statusMessage:'lat/lon fora do intervalo' });

  const { x, y } = projectWebMercator(lonNum, latNum);
  // Layer 0: campos relevantes NOMECALEND, NOMABAST, ID
  const geom = encodeURIComponent(JSON.stringify({ x, y, spatialReference:{ wkid:102100 }}));
  const outFields = encodeURIComponent('OBJECTID,NOMECALEND,NOMABAST,ID');
  const url = `https://geo.compesa.com.br:6443/arcgis/rest/services/Calendario/Calendario/MapServer/0/query?f=json&returnGeometry=false&spatialRel=esriSpatialRelIntersects&geometry=${geom}&geometryType=esriGeometryPoint&inSR=102100&outFields=${outFields}&outSR=102100`;

  const res = await fetch(url);
  if(!res.ok) throw createError({ statusCode:res.status, statusMessage:'Falha na consulta remota' });
  const data = await res.json();
  const features = (data.features || []).map((f: any) => ({
    id: f.attributes?.ID as string | undefined,
    nomeCalend: f.attributes?.NOMECALEND as string | undefined,
    nomeAbast: f.attributes?.NOMABAST as string | undefined,
  })).filter((f: { id?: string }) => !!f.id);

  return { lat: latNum, lon: lonNum, mercator:{ x, y }, count: features.length, features };
});
