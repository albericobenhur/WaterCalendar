<template>
  <div class="hierarchy">
    <SearchSelect
      label="Município"
      :items="municipios"
      v-model="selectedMunicipio"
      placeholder="Digite para filtrar"
      @select="onMunicipioSelect"
      @search="onMunicipioSearch"
      :loading="loadingMunicipios"
    />
    <SearchSelect
      v-if="selectedMunicipio"
      label="Bairro"
      :items="bairros"
      v-model="selectedBairro"
      placeholder="(Opcional) Filtrar bairro"
      @select="onBairroSelect"
      @search="onBairroSearch"
      :disabled="!selectedMunicipio || loadingBairros"
      :loading="loadingBairros"
    />
    <SearchSelect
      v-if="selectedMunicipio"
      label="Área de Abastecimento"
      :items="areas"
      v-model="selectedArea"
      placeholder="Selecione a área"
      option-label="nome"
      option-value="id"
      @select="emitSelection"
      @search="onAreaSearch"
      :disabled="!areas.length || loadingAreas"
      :loading="loadingAreas"
    />
  </div>
</template>

<script setup lang="ts">
interface Area { id:string; nome:string }
const emit = defineEmits<{ (e:'select', id:string): void }>();

const municipios = ref<string[]>([]);
const bairros = ref<string[]>([]);
const areas = ref<Area[]>([]);
const loadingMunicipios = ref(false);
const loadingBairros = ref(false);
const loadingAreas = ref(false);
let municipioSearchTimer: any; let bairroSearchTimer: any; let areaSearchTimer: any;

const selectedMunicipio = ref('');
const selectedBairro = ref('');
const selectedArea = ref('');

onMounted(loadMunicipios);

async function loadMunicipios(){
  try {
    loadingMunicipios.value = true;
    const { data, error } = await useFetch('/api/areas/municipios');
    if(error.value) { municipios.value = []; return; }
    const list = (data.value as any)?.municipios;
    municipios.value = Array.isArray(list) ? list : [];
  } finally { loadingMunicipios.value = false; }
}

function onMunicipioSearch(q:string){
  clearTimeout(municipioSearchTimer); municipioSearchTimer = setTimeout(()=> reloadMunicipios(q), 300);
}
async function reloadMunicipios(q:string){
  try {
    loadingMunicipios.value = true;
    const { data, error } = await useFetch('/api/areas/municipios', { params: q? { q }: {} });
    if(!error.value) {
      const list = (data.value as any)?.municipios;
      municipios.value = Array.isArray(list) ? list : [];
    }
  } finally { loadingMunicipios.value = false; }
}

async function onMunicipioSelect(){
  selectedBairro.value = '';
  selectedArea.value = '';
  bairros.value = [];
  areas.value = [];
  if(!selectedMunicipio.value) return;
  try {
    loadingBairros.value = true;
    const { data, error } = await useFetch('/api/areas/bairros', { params:{ municipio: selectedMunicipio.value }});
    if(!error.value) {
      const list = (data.value as any)?.bairros;
      bairros.value = Array.isArray(list) ? list : [];
    }
  } finally { loadingBairros.value = false; }
  await loadAreas();
}

function onBairroSearch(q:string){
  if(!selectedMunicipio.value) return;
  clearTimeout(bairroSearchTimer); bairroSearchTimer = setTimeout(()=> reloadBairros(q), 300);
}
async function reloadBairros(q:string){
  try {
    loadingBairros.value = true;
    const params:any = { municipio: selectedMunicipio.value };
    if(q) params.q = q;
    const { data, error } = await useFetch('/api/areas/bairros', { params });
    if(!error.value) {
      const list = (data.value as any)?.bairros;
      bairros.value = Array.isArray(list) ? list : [];
    }
  } finally { loadingBairros.value = false; }
}

async function onBairroSelect(){
  selectedArea.value = '';
  await loadAreas();
}

function onAreaSearch(q:string){
  if(!selectedMunicipio.value) return;
  clearTimeout(areaSearchTimer); areaSearchTimer = setTimeout(()=> reloadAreas(q), 300);
}
async function reloadAreas(q:string){
  try {
    loadingAreas.value = true;
    const params:any = { municipio: selectedMunicipio.value };
    if(selectedBairro.value) params.bairro = selectedBairro.value;
    if(q) params.q = q;
    const { data, error } = await useFetch('/api/areas/abastecimentos', { params });
    if(!error.value) {
      const list = (data.value as any)?.areas;
      areas.value = Array.isArray(list) ? list : [];
    }
  } finally { loadingAreas.value = false; }
}

async function loadAreas(){
  if(!selectedMunicipio.value) return;
  try {
    loadingAreas.value = true;
    const params:any = { municipio: selectedMunicipio.value };
    if(selectedBairro.value) params.bairro = selectedBairro.value;
    const { data, error } = await useFetch('/api/areas/abastecimentos', { params });
    if(!error.value) {
      const list = (data.value as any)?.areas;
      areas.value = Array.isArray(list) ? list : [];
    }
  } finally { loadingAreas.value = false; }
}

function emitSelection(){ if(selectedArea.value) emit('select', selectedArea.value); }
</script>

<style scoped>
.hierarchy { display:flex; flex-direction:column; gap:.75rem; }
.row { display:flex; flex-direction:column; gap:.35rem; }
label { font-size:.7rem; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:#475569; }
select { padding:.55rem .7rem; border:1px solid #cbd5e1; border-radius:8px; background:#fff; font-size:.9rem; }
select:focus { outline:2px solid #3b82f6; }
</style>
