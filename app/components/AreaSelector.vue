<template>
  <div class="area-selector">
    <label class="label" for="areaInput">Área de Abastecimento</label>
    <div class="input-row">
      <input id="areaInput" v-model="areaLocal" type="text" placeholder="Ex: ARDV136690" @keyup.enter="emitSelect" />
      <button class="btn" @click="emitSelect">Buscar</button>
    </div>
    <p class="hint">Digite o código da área (ID_AREA_ABASTECIMENTO). Você pode salvar favoritos futuramente.</p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'select', value: string): void }>();

const areaLocal = ref(props.modelValue);
watch(() => props.modelValue, v => { if (v !== areaLocal.value) areaLocal.value = v; });

function emitSelect() {
  emit('update:modelValue', areaLocal.value.trim());
  emit('select', areaLocal.value.trim());
}
</script>

<style scoped>
.area-selector { display:flex; flex-direction:column; gap:.5rem; }
.label { font-size:.85rem; text-transform:uppercase; font-weight:600; letter-spacing:.05em; }
.input-row { display:flex; gap:.5rem; }
input { flex:1; padding:.65rem .75rem; border:1px solid #cbd5e1; border-radius:8px; font-size:.95rem; }
input:focus { outline:2px solid #3b82f6; }
.btn { background:#2563eb; color:#fff; border:none; border-radius:8px; padding:.65rem 1rem; font-weight:600; cursor:pointer; }
.btn:hover { background:#1d4ed8; }
.hint { font-size:.7rem; color:#64748b; line-height:1.1; }
</style>
