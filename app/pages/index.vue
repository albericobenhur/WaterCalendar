<template>
  <main class="layout">
    <h1>Calendário de Abastecimento</h1>
    <AreaHierarchySelector @select="onSelect" />
    <div v-if="areaId" class="selected-area">ID Selecionado: <strong>{{ areaId }}</strong></div>
    <WaterCalendar :area="areaId" />
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const areaId = ref('');
function onSelect(v:string){ areaId.value = v; }
</script>

<style scoped>
.layout { max-width:600px; margin:0 auto; display:flex; flex-direction:column; gap:1.25rem; padding:1.25rem 1rem 3rem; }
.layout h1 { font-size:1.25rem; font-weight:700; letter-spacing:-.5px; }
.selected-area { font-size:.75rem; background:#e2e8f0; padding:.4rem .6rem; border-radius:6px; width:max-content; }
</style>
