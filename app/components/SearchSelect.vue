<template>
  <div class="search-select" :class="{ disabled }">
    <label v-if="label">{{ label }}</label>
    <div class="box" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.enter.prevent="confirmSelection" @click="open = true">
      <input
        ref="inputEl"
        :placeholder="placeholder"
        v-model="query"
        :disabled="disabled"
        @focus="onFocus"
        @input="onInput"
        @blur="onBlur"
        @keydown.esc.prevent="onEsc"
        class="input"
        autocomplete="off"
      />
      <button
        v-if="clearableComputed && query"
        type="button"
        class="clear"
        @mousedown.prevent="clearInput"
        aria-label="Limpar"
      >✕</button>
      <button type="button" class="toggle" @mousedown.prevent="toggle" :disabled="disabled">▾</button>
    </div>
    <transition name="fade">
      <ul v-if="open && filtered.length" class="dropdown" ref="listEl">
        <li
          v-for="(opt,i) in filtered"
          :key="keyOf(opt,i)"
          :class="{ active: i === activeIndex }"
          @mousedown.prevent="select(opt)"
        >
          <slot name="option" :option="opt" :highlighted="highlightedLabel(opt)">
            <span v-html="highlightedLabel(opt)"></span>
          </slot>
        </li>
      </ul>
    </transition>
    <p v-if="loading" class="hint">Carregando...</p>
    <p v-else-if="!disabled && !filtered.length && query" class="hint empty">Nenhum resultado</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
interface BaseOption { [k:string]: any }
const props = defineProps<{
  items: BaseOption[] | string[];
  modelValue: string;
  label?: string;
  placeholder?: string;
  optionLabel?: string; // nome do campo texto quando for objeto
  optionValue?: string; // nome do campo id quando for objeto
  disabled?: boolean;
  loading?: boolean;
  minChars?: number;
  debounceMs?: number; // tempo de debounce para emitir busca
  clearable?: boolean; // exibe botão de limpar
  highlight?: boolean; // destaca termo buscado
}>();
const emit = defineEmits<{ (e:'update:modelValue', v:string): void; (e:'search', q:string): void; (e:'select', payload:any): void }>();

const open = ref(false);
const query = ref('');
const activeIndex = ref(-1);
const inputEl = ref<HTMLInputElement|null>(null);
const listEl = ref<HTMLElement|null>(null);
let blurTimeout: any;
let searchTimeout: any;

const clearableComputed = computed(()=> props.clearable !== false); // default true
const highlightComputed = computed(()=> props.highlight !== false); // default true

onMounted(()=>{ syncFromModel(); });
watch(()=>props.modelValue, syncFromModel);

function syncFromModel(){
  if(!props.modelValue) return;
  // tenta localizar item para exibir label correspondente
  const opt = normalized().find(o => valueOf(o) === props.modelValue);
  if(opt) query.value = labelOf(opt);
}

function normalized(): any[] {
  return Array.isArray(props.items) ? props.items : [];
}
function labelOf(o:any){
  if(typeof o === 'string') return o;
  return props.optionLabel ? o?.[props.optionLabel] : String(o);
}
function valueOf(o:any){
  if(typeof o === 'string') return o;
  return props.optionValue ? o?.[props.optionValue] : labelOf(o);
}
function keyOf(o:any,i:number){ return valueOf(o) ?? i; }

const filtered = computed(()=> {
  const list = normalized();
  if(!query.value) return list.slice(0,200);
  const q = query.value.toLowerCase();
  return list.filter(o => labelOf(o).toLowerCase().includes(q)).slice(0,200);
});

function onInput(){
  activeIndex.value = -1;
  open.value = true;
  clearTimeout(searchTimeout);
  if((props.minChars||0) <= query.value.length) {
    const delay = props.debounceMs ?? 300;
    searchTimeout = setTimeout(()=> emit('search', query.value), delay);
  }
}
function onFocus(){ open.value = true; }
function onBlur(){ blurTimeout = setTimeout(()=> open.value=false, 120); }
function toggle(){ if(props.disabled) return; open.value = !open.value; if(open.value) inputEl.value?.focus(); }
function move(dir:number){ if(!open.value) { open.value = true; return; } const len = filtered.value.length; if(!len) return; activeIndex.value = (activeIndex.value + dir + len) % len; scrollActiveIntoView(); }
function scrollActiveIntoView(){ nextTick(()=> { const el = listEl.value?.children[activeIndex.value] as HTMLElement; el?.scrollIntoView({ block:'nearest' }); }); }
function confirmSelection(){ if(activeIndex.value >=0) select(filtered.value[activeIndex.value]); }
function select(opt:any){ clearTimeout(blurTimeout); const val = valueOf(opt); emit('update:modelValue', val); emit('select', opt); query.value = labelOf(opt); open.value = false; }

function clearInput(){
  query.value = '';
  activeIndex.value = -1;
  emit('update:modelValue', '');
  // Emite busca vazia para permitir limpar resultados no pai
  clearTimeout(searchTimeout);
  emit('search', '');
  open.value = false;
  nextTick(()=> inputEl.value?.focus());
}
function onEsc(){
  if(query.value) {
    clearInput();
  } else {
    open.value = false;
  }
}

function escapeHtml(str:string){
  return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s] as string));
}
function highlightedLabel(opt:any){
  const text = labelOf(opt) || '';
  if(!highlightComputed.value || !query.value) return escapeHtml(text);
  const q = query.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const re = new RegExp(`(${q})`, 'ig');
    const parts = text.split(re);
    // parts: even indexes = normal, odd = matches
  return parts.map((p: string, i: number)=> i % 2 === 1 ? `<mark>${escapeHtml(p)}</mark>` : escapeHtml(p)).join('');
  } catch { return escapeHtml(text); }
}

// Fechar ao clicar fora
onMounted(()=>{
  document.addEventListener('click', handleOutside, true);
});
onBeforeUnmount(()=> document.removeEventListener('click', handleOutside, true));
onBeforeUnmount(()=> clearTimeout(searchTimeout));
function handleOutside(e:MouseEvent){
  if(!open.value) return;
  const root = (inputEl.value?.closest('.search-select')) as HTMLElement | null;
  if(root && !root.contains(e.target as Node)) open.value = false;
}
</script>

<style scoped>
.search-select { position:relative; display:flex; flex-direction:column; gap:.35rem; }
.search-select.disabled { opacity:.6; pointer-events:none; }
label { font-size:.65rem; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:#475569; }
.box { display:flex; background:#fff; border:1px solid #cbd5e1; border-radius:8px; align-items:center; }
.box:focus-within { outline:2px solid #3b82f6; outline-offset:1px; }
.input { flex:1; padding:.55rem .65rem; border:none; background:transparent; font-size:.9rem; }
.input:focus { outline:none; }
.toggle { background:transparent; border:none; cursor:pointer; padding:0 .5rem; font-size:.9rem; }
ul.dropdown { position:absolute; top:100%; left:0; right:0; background:#fff; box-shadow:0 8px 24px -6px rgba(0,0,0,.15); border:1px solid #e2e8f0; border-radius:10px; margin:4px 0 0; max-height:260px; overflow:auto; list-style:none; padding:4px; z-index:20; }
ul.dropdown li { padding:.45rem .55rem; border-radius:6px; cursor:pointer; font-size:.8rem; line-height:1.1; }
ul.dropdown li:hover, ul.dropdown li.active { background:#eff6ff; color:#1d4ed8; }
.clear { background:transparent; border:none; cursor:pointer; padding:0 .35rem; font-size:.85rem; color:#64748b; }
.clear:hover { color:#0f172a; }
mark { background:#fde68a; color:inherit; padding:0 2px; border-radius:2px; }
.hint { font-size:.6rem; color:#64748b; }
.hint.empty { color:#be123c; }
.fade-enter-active,.fade-leave-active { transition:opacity .15s ease; }
.fade-enter-from,.fade-leave-to { opacity:0; }
</style>