<template>
  <main class="layout">
    <h1>Calendário de Abastecimento</h1>
    <div class="mode-toggle">
      <button :class="{ active: mode==='lista' }" @click="mode='lista'">Por Localidade</button>
      <button :class="{ active: mode==='mapa' }" @click="mode='mapa'">Por Mapa</button>
    </div>
    <div v-if="mode==='lista'" class="panel">
      <AreaHierarchySelector @select="onSelect" />
    </div>
    <div v-else class="panel">
      <ClientOnly>
        <MapPicker @select="onSelectMap" />
        <template #fallback>
          <p class="loading-msg">Carregando mapa...</p>
        </template>
      </ClientOnly>
    </div>
    <div v-if="areaId" class="selected-area">ID Selecionado: <strong>{{ areaId }}</strong></div>
    <WaterCalendar :area="areaId" />
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const areaId = ref('');
const mode = ref<'lista'|'mapa'>('lista');
function onSelect(v:string){ areaId.value = v; }
function onSelectMap(v:string){ areaId.value = v; mode.value='lista'; }
</script>

<style scoped>
.layout { max-width:760px; margin:0 auto; display:flex; flex-direction:column; gap:1.25rem; padding:1.25rem 1rem 3rem; }
.layout h1 { font-size:1.25rem; font-weight:700; letter-spacing:-.5px; }
.selected-area { font-size:.75rem; background:#e2e8f0; padding:.4rem .6rem; border-radius:6px; width:max-content; }
.mode-toggle { display:flex; gap:.5rem; }
.mode-toggle button { flex:1; background:#f1f5f9; border:1px solid #cbd5e1; padding:.55rem .75rem; border-radius:8px; font-size:.7rem; font-weight:600; cursor:pointer; letter-spacing:.05em; text-transform:uppercase; }
.mode-toggle button.active { background:#0ea5e9; color:#fff; border-color:#0ea5e9; }
.mode-toggle button:hover:not(.active) { background:#e2e8f0; }
.panel { background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:.85rem .9rem; }
.loading-msg { font-size:.7rem; color:#475569; }
</style>
