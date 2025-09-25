<template>
  <div class="map-picker">
    <div class="external-search">
      <div class="search-wrapper">
        <input
          v-model="searchTerm"
          class="search-input"
          type="text"
          placeholder="Buscar endereço ou cidade..."
          @input="onSearchInput"
          @focus="openResults"
        />
        <button v-if="searchTerm" class="clear-btn" @click="clearSearch" aria-label="Limpar">✕</button>
      </div>
      <ul v-if="showResults" class="search-results" @mousedown.prevent>
        <li v-if="searchLoading" class="state">Buscando...</li>
        <li v-else-if="!searchResults.length" class="state">Nenhum resultado</li>
        <li v-for="(r,i) in searchResults" :key="r.key + '-' + i" @click="selectResult(r)">
          <strong>{{ r.primary }}</strong>
          <span v-if="r.secondary" class="secondary">{{ r.secondary }}</span>
        </li>
      </ul>
    </div>
    <div class="toolbar">
      <span class="hint">Clique no mapa para localizar a área de abastecimento.</span>
      <button class="reload" @click="reset" :disabled="loading">Limpar</button>
    </div>
    <div ref="mapEl" class="map"></div>
    <div class="status" v-if="loading">Buscando área...</div>
    <div class="status error" v-else-if="error">{{ error }}</div>
    <div class="result" v-else-if="feature">
      <p><strong>Área:</strong> {{ feature.id }}</p>
      <p v-if="feature.nomeCalend"><strong>Calendário:</strong> {{ feature.nomeCalend }}</p>
      <p v-if="feature.nomeAbast"><strong>Abastecimento:</strong> {{ feature.nomeAbast }}</p>
      <button class="use" @click="emitSelect">Usar esta área</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const emit = defineEmits<{(e:'select', id:string):void }>();

const mapEl = ref<HTMLDivElement|null>(null);
let map: any = null; // Leaflet instance
let marker: any = null;
const loading = ref(false);
const error = ref<string>('');
const feature = ref<{id:string; nomeCalend?:string; nomeAbast?:string} | null>(null);
// --- External search state ---
const searchTerm = ref('');
const searchResults = ref<any[]>([]);
const searchLoading = ref(false);
const showResults = ref(false);
let searchTimer: any = null;
let provider: any = null;
let leafletRef: any = null; // store leaflet instance

async function ensureLeaflet(){
  // dynamic import apenas no client
  // @ts-ignore
  if(!process.client) return;
  if((window as any).L) return (window as any).L;
  // @ts-ignore - aceitar módulo sem tipos
  const mod: any = await import('leaflet');
  const L: any = (mod && mod.default) ? mod.default : (window as any).L || mod;
  // CSS manual (fallback se não adicionado global)
  const id='leaflet-css';
  if(!document.getElementById(id)){
    const link = document.createElement('link');
    link.id = id; link.rel='stylesheet';
    link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  return L;
}

function reset(){
  feature.value=null; error.value=''; loading.value=false;
  if(marker && map) { map.removeLayer(marker); marker=null; }
}

async function init(){
  const L = await ensureLeaflet();
  if(!mapEl.value) return;
  leafletRef = L;
  map = L.map(mapEl.value).setView([-8.05, -34.9], 11); // Recife região aproximada
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  // Injetar estilos base do geosearch (aproveitando fonte existente)
  injectGeoSearchStyles();
  map.on('click', async (e:any)=>{
    const { lat, lng } = e.latlng;
    handleClick(lat, lng, L);
  });
  document.addEventListener('click', handleOutside, true);
}

async function handleClick(lat:number, lon:number, L:any){
  error.value=''; feature.value=null; loading.value=true;
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
    const res = await fetch(`/api/geo/area?${params.toString()}`);
    if(!res.ok) throw new Error('Falha na consulta');
    const data = await res.json();
    if(!data.features.length){
      error.value='Nenhuma área encontrada neste ponto';
    } else {
      feature.value = data.features[0];
      if(marker) map.removeLayer(marker);
      marker = L.marker([lat, lon]).addTo(map);
    }
  } catch(e:any) {
    error.value = e.message || 'Erro inesperado';
  } finally { loading.value=false; }
}

function emitSelect(){
  if(feature.value?.id) emit('select', feature.value.id);
}

onMounted(()=>{ init(); });
onBeforeUnmount(()=>{ if(map){ map.remove(); map=null; } document.removeEventListener('click', handleOutside, true); clearTimeout(searchTimer); });

function injectGeoSearchStyles(){
  const id = 'leaflet-geosearch-css';
  if(document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
  .map-picker .external-search { position:relative; display:flex; flex-direction:column; gap:.35rem; }
  .map-picker .search-wrapper { position:relative; }
  .map-picker .search-input { width:100%; background:#fff; border:1px solid #cbd5e1; border-radius:10px; padding:.55rem .75rem; font-size:.75rem; }
  .map-picker .search-input:focus { outline:2px solid #0ea5e9; outline-offset:1px; }
  .map-picker .clear-btn { position:absolute; right:6px; top:50%; transform:translateY(-50%); background:transparent; border:none; cursor:pointer; font-size:.75rem; color:#475569; }
  .map-picker .clear-btn:hover { color:#0f172a; }
  .map-picker .search-results { position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #e2e8f0; border-radius:12px; margin:4px 0 0; padding:4px; list-style:none; max-height:260px; overflow:auto; box-shadow:0 8px 24px -6px rgba(0,0,0,.18); z-index:60; }
  .map-picker .search-results li { padding:.5rem .55rem; border-radius:8px; cursor:pointer; font-size:.65rem; display:flex; flex-direction:column; gap:2px; }
  .map-picker .search-results li:hover { background:#eff6ff; color:#1d4ed8; }
  .map-picker .search-results li.state { cursor:default; font-style:italic; color:#64748b; }
  .map-picker .search-results .secondary { font-size:.55rem; color:#475569; }
  `;
  document.head.appendChild(style);
}

async function ensureProvider(){
  if(provider) return provider;
  try {
    // @ts-ignore
    const geo: any = await import('leaflet-geosearch');
    provider = new geo.OpenStreetMapProvider();
  } catch (e) {
    console.warn('Falha ao carregar provider de busca', e);
  }
  return provider;
}

function onSearchInput(){
  openResults();
  clearTimeout(searchTimer);
  const term = searchTerm.value.trim();
  if(term.length < 3){ searchResults.value=[]; return; }
  searchTimer = setTimeout(()=> runSearch(term), 400);
}
function openResults(){ showResults.value = true; }
function clearSearch(){ searchTerm.value=''; searchResults.value=[]; showResults.value=false; }

async function runSearch(term:string){
  searchLoading.value = true;
  try {
    const prov = await ensureProvider();
    if(!prov){ searchResults.value=[]; return; }
    const res = await prov.search({ query: term });
    searchResults.value = (res||[]).map((r:any)=> ({
      key: r.raw?.osm_id || r.x+','+r.y,
      label: r.label,
      primary: r.label.split(',')[0] || r.label,
      secondary: r.label.split(',').slice(1).join(', ').trim(),
      lat: r.y,
      lon: r.x
    }));
  } catch(e:any){
    console.warn('Erro busca geocoding', e);
    searchResults.value=[];
  } finally { searchLoading.value=false; }
}

function selectResult(r:any){
  searchTerm.value = r.label;
  showResults.value = false;
  if(map && leafletRef){
    map.flyTo([r.lat, r.lon], 14);
    handleClick(r.lat, r.lon, leafletRef);
  }
}
function handleOutside(e:MouseEvent){
  if(!showResults.value) return;
  const root = (mapEl.value?.closest('.map-picker')) as HTMLElement | null;
  if(root && !root.contains(e.target as Node)) showResults.value = false;
}
</script>

<style scoped>
.map-picker { display:flex; flex-direction:column; gap:.5rem; background:#fff; padding:.75rem; border:1px solid #e2e8f0; border-radius:14px; }
.toolbar { display:flex; align-items:center; justify-content:space-between; gap:.75rem; }
.hint { font-size:.65rem; color:#475569; }
.reload { background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:.4rem .6rem; font-size:.65rem; cursor:pointer; }
.reload:hover { background:#e2e8f0; }
.map { width:100%; height:300px; border-radius:10px; overflow:hidden; }
.status { font-size:.65rem; color:#475569; }
.status.error { color:#b91c1c; }
.result { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:.6rem .7rem; font-size:.65rem; display:flex; flex-direction:column; gap:.25rem; }
.use { align-self:flex-start; background:#0ea5e9; color:#fff; border:none; font-size:.65rem; padding:.4rem .7rem; border-radius:6px; cursor:pointer; }
.use:hover { background:#0284c7; }
</style>