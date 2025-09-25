<template>
  <div class="map-picker">
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

async function ensureLeaflet(){
  // dynamic import apenas no client
  // @ts-ignore
  if(!process.client) return;
  if((window as any).L) return (window as any).L;
  const L = await import('leaflet');
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
  map = L.map(mapEl.value).setView([-8.05, -34.9], 11); // Recife região aproximada
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  map.on('click', async (e:any)=>{
    const { lat, lng } = e.latlng;
    handleClick(lat, lng, L);
  });
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
onBeforeUnmount(()=>{ if(map){ map.remove(); map=null; } });
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