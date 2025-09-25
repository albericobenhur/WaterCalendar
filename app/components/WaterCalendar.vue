<template>
  <div class="calendar-card" v-if="days.length">
    <header class="cal-header">
      <button class="nav" @click="prevMonth" :disabled="loading">‹</button>
      <h2>{{ monthYearLabel }}</h2>
      <button class="nav" @click="nextMonth" :disabled="loading">›</button>
    </header>
    <div class="grid-head">
      <span v-for="d in weekDays" :key="d" class="dow">{{ d }}</span>
    </div>
    <div class="grid-body" :class="{ loading }">
      <div v-for="d in days" :key="d.date" class="cell" :data-status="d.status" :class="{ other: !d.currentMonth, today: d.isToday, clickable: dayHasEvents(d) }" :title="d.tooltip" @click="openDetails(d)">
        <span class="num">{{ d.day }}</span>
        <span v-if="dayHasEvents(d)" class="badge">{{ eventCount(d) }}</span>
      </div>
    </div>
    <footer class="legend">
      <div v-for="l in legend" :key="l.key" class="legend-item">
        <span class="swatch" :data-status="l.key"></span> {{ l.label }}
      </div>
    </footer>
    <transition name="fade">
      <div v-if="detailsOpen" class="details-overlay" @click.self="closeDetails">
        <div class="details-panel">
          <header class="d-head">
            <h3>Detalhes do dia {{ selectedDayLabel }}</h3>
            <button class="close" @click="closeDetails">×</button>
          </header>
          <div v-if="selectedEvents.length" class="events-list">
            <div v-for="(ev,i) in selectedEvents" :key="i" class="event-item" :data-status="ev.status">
              <div class="ev-status" :data-status="ev.status"></div>
              <div class="ev-body">
                <p class="ev-desc">{{ ev.DESCRICAO_SERVICO || 'Sem descrição' }}</p>
                <p class="ev-meta">
                  <span>{{ formatRange(ev.INICIO_PREVISTO, ev.TERMINO_PREVISTO) }}</span>
                  <span v-if="ev.NATUREZA_SERVICOS"> • {{ ev.NATUREZA_SERVICOS }}</span>
                  <span v-if="ev.NUMERO_COMUNICADO"> • Comunicado: {{ ev.NUMERO_COMUNICADO }}</span>
                </p>
              </div>
            </div>
          </div>
          <p v-else class="empty-details">Sem eventos para este dia.</p>
        </div>
      </div>
    </transition>
  </div>
  <div v-else class="empty" :class="{ loading }">
    <p v-if="!loading">Selecione uma área acima.</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
interface CalendarDay { date:string; day:number; currentMonth:boolean; status:DayStatus; isToday:boolean; tooltip:string }
interface LegendItem { key:DayStatus; label:string }

type DayStatus = 'sem-abastecimento' | 'abastecimento-parcial' | 'manutencao' | 'abastecimento';

const props = defineProps<{ area: string }>();

const today = new Date();
const current = ref(new Date(today.getFullYear(), today.getMonth(), 1));
const days = ref<CalendarDay[]>([]);
const legend = ref<LegendItem[]>([
  { key:'abastecimento', label:'Abastecimento' },
  { key:'abastecimento-parcial', label:'Abastecimento parcial' },
  { key:'manutencao', label:'Sistema em manutenção' },
  { key:'sem-abastecimento', label:'Sem abastecimento' }
]);
const loading = ref(false);
// Detalhes por dia vindos da API (dayDetails[yyyy-mm-dd] = array de eventos)
const dayDetails = ref<Record<string, any[]>>({});
const detailsOpen = ref(false);
const selectedDayKey = ref<string>('');
const selectedEvents = ref<any[]>([]);

const weekDays = ['Do','Se','Te','Qa','Qi','Sx','Sa'];
const monthYearLabel = computed(() => current.value.toLocaleDateString('pt-BR', { month:'long', year:'numeric' }));

watch(() => [props.area, current.value.getMonth(), current.value.getFullYear()], fetchData, { immediate: true });

async function fetchData() {
  if(!props.area) { days.value = []; return; }
  loading.value = true;
  try {
    const y = current.value.getFullYear();
    const m = current.value.getMonth() + 1;
  const qs = new URLSearchParams({ area: props.area, year: String(y), month: String(m) });
  const res = await fetch(`/api/calendar?${qs.toString()}`);
  if(!res.ok) throw new Error('Erro ao buscar calendário');
    const payload = await res.json();
    dayDetails.value = payload.dayDetails || {};
    days.value = buildCalendarDays(payload.days, y, current.value.getMonth());
  } catch (e) {
    console.error(e);
  } finally { loading.value = false; }
}

function buildCalendarDays(dayMap: Record<string, DayStatus>, year:number, monthIndex:number): CalendarDay[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=Domingo
  const daysInMonth = new Date(year, monthIndex+1, 0).getDate();

  // Data inicial do grid: domingo anterior (ou o próprio dia se domingo)
  const gridStart = new Date(year, monthIndex, 1 - startWeekday);
  // Número de células: 42 (6 semanas) para garantir altura estável
  const totalCells = 42; // 6 * 7

  const result: CalendarDay[] = [];
  for(let i=0;i<totalCells;i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const currentMonth = date.getMonth() === monthIndex;
  const key = date.toISOString().substring(0,10);
    const status = currentMonth ? (dayMap[key] || 'sem-abastecimento') : 'sem-abastecimento';
    result.push({
      date: date.toISOString(),
      day: date.getDate(),
      currentMonth,
      status,
      isToday: isSameDate(date, today),
      tooltip: currentMonth ? humanTooltip(status) : ''
    });
  }
  // Se a última linha for totalmente de dias fora do mês e já temos 5 linhas, podemos reduzir para 35 células
  // (opcional – mantendo sempre 42 para estabilidade visual)
  return result;
}

// localKey removida em favor de chave UTC consistente com backend

function isSameDate(a:Date,b:Date){return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();}
function humanTooltip(status:DayStatus){
  switch(status){
    case 'abastecimento': return 'Dia de abastecimento';
    case 'abastecimento-parcial': return 'Abastecimento parcial';
    case 'manutencao': return 'Sistema em manutenção';
    default: return 'Sem abastecimento';
  }
}

function prevMonth(){ current.value = new Date(current.value.getFullYear(), current.value.getMonth()-1, 1); }
function nextMonth(){ current.value = new Date(current.value.getFullYear(), current.value.getMonth()+1, 1); }

function dayHasEvents(d:CalendarDay){
  if(!d.currentMonth) return false;
  const key = d.date.substring(0,10);
  return Array.isArray(dayDetails.value[key]) && dayDetails.value[key].length>0;
}
function eventCount(d:CalendarDay){
  const key = d.date.substring(0,10);
  return (dayDetails.value[key]?.length) || 0;
}
function openDetails(d:CalendarDay){
  if(!dayHasEvents(d)) return;
  selectedDayKey.value = d.date.substring(0,10);
  selectedEvents.value = [...(dayDetails.value[selectedDayKey.value]||[])];
  detailsOpen.value = true;
}
function closeDetails(){ detailsOpen.value = false; }
const selectedDayLabel = computed(()=>{
  if(!selectedDayKey.value) return '';
  const date = new Date(selectedDayKey.value + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
});
function formatRange(startMs:number, endMs:number){
  if(!startMs || !endMs) return '';
  const s = new Date(startMs); const e = new Date(endMs);
  const opts: Intl.DateTimeFormatOptions = { hour:'2-digit', minute:'2-digit' };
  const sameDay = s.toDateString() === e.toDateString();
  const dayFmt: Intl.DateTimeFormatOptions = { day:'2-digit', month:'2-digit' };
  if(sameDay) return `${s.toLocaleDateString('pt-BR', dayFmt)} ${s.toLocaleTimeString('pt-BR', opts)} - ${e.toLocaleTimeString('pt-BR', opts)}`;
  return `${s.toLocaleDateString('pt-BR', dayFmt)} ${s.toLocaleTimeString('pt-BR', opts)} → ${e.toLocaleDateString('pt-BR', dayFmt)} ${e.toLocaleTimeString('pt-BR', opts)}`;
}
</script>

<style scoped>
.calendar-card { background:#fff; border-radius:18px; box-shadow:0 4px 16px -4px rgba(0,0,0,.1); padding:1rem 1rem 0.5rem; display:flex; flex-direction:column; gap:.75rem; }
.cal-header { display:flex; align-items:center; justify-content:space-between; }
.cal-header h2 { font-size:1rem; font-weight:700; text-transform:capitalize; }
.nav { background:#fff; border:1px solid #e2e8f0; width:2rem; height:2rem; border-radius:8px; cursor:pointer; font-weight:700; }
.nav:hover { background:#f1f5f9; }
.grid-head, .grid-body { display:grid; grid-template-columns:repeat(7,1fr); }
.dow { font-size:.65rem; text-align:center; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:#64748b; padding:.25rem 0; }
.grid-body { gap:.35rem; }
.cell { aspect-ratio:1/1; position:relative; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:.8rem; font-weight:600; background:#f1f5f9; color:#334155; transition:.25s; }
.cell.today { outline:2px solid #2563eb; }
.cell.other { opacity:.35; }
.cell[data-status='abastecimento'] { background:#0ea5e9; color:#fff; }
.cell[data-status='abastecimento-parcial'] { background:repeating-linear-gradient(135deg,#0ea5e9 0 8px,#38bdf8 8px 16px); color:#fff; }
.cell[data-status='manutencao'] { background:#f87171; color:#fff; }
.cell[data-status='sem-abastecimento'] { background:#f1f5f9; }
.cell:hover { transform:translateY(-2px); box-shadow:0 3px 8px -2px rgba(0,0,0,.15); }
.cell.clickable { cursor:pointer; }
.cell .badge { position:absolute; top:4px; right:4px; background:#1e293b; color:#fff; font-size:.55rem; line-height:1; padding:2px 4px; border-radius:8px; font-weight:600; }
.legend { display:flex; flex-wrap:wrap; gap:.75rem; padding:.5rem 0 .75rem; font-size:.65rem; }
.legend-item { display:flex; align-items:center; gap:.35rem; }
.swatch { width:14px; height:14px; border-radius:4px; background:#f1f5f9; border:1px solid #cbd5e1; }
.swatch[data-status='abastecimento'] { background:#0ea5e9; border-color:#0ea5e9; }
.swatch[data-status='abastecimento-parcial'] { background:repeating-linear-gradient(135deg,#0ea5e9 0 6px,#38bdf8 6px 12px); border-color:#0ea5e9; }
.swatch[data-status='manutencao'] { background:#f87171; border-color:#f87171; }
.empty { text-align:center; color:#64748b; font-size:.85rem; }
.grid-body.loading { opacity:.4; filter:grayscale(.4); }

/* Overlay de detalhes */
.details-overlay { position:fixed; inset:0; background:rgba(15,23,42,.55); backdrop-filter:blur(2px); display:flex; align-items:flex-start; justify-content:center; padding:4rem 1rem 2rem; z-index:100; }
.details-panel { background:#fff; width:100%; max-width:640px; border-radius:18px; box-shadow:0 8px 40px -10px rgba(0,0,0,.35); display:flex; flex-direction:column; max-height:70vh; }
.d-head { display:flex; align-items:center; justify-content:space-between; padding:1rem 1.1rem .75rem; border-bottom:1px solid #e2e8f0; }
.d-head h3 { font-size:.9rem; font-weight:700; }
.close { background:transparent; border:none; font-size:1.2rem; cursor:pointer; line-height:1; }
.events-list { overflow:auto; padding:.75rem 1rem 1rem; display:flex; flex-direction:column; gap:.65rem; }
.event-item { display:flex; gap:.6rem; padding:.55rem .65rem; border:1px solid #e2e8f0; border-radius:10px; position:relative; background:#fff; }
.ev-status { width:6px; border-radius:4px; background:#94a3b8; }
.event-item[data-status='abastecimento'] .ev-status { background:#0ea5e9; }
.event-item[data-status='abastecimento-parcial'] .ev-status { background:#0ea5e9; background-image:repeating-linear-gradient(135deg,#0ea5e9 0 6px,#38bdf8 6px 12px); }
.event-item[data-status='manutencao'] .ev-status { background:#f87171; }
.ev-body { flex:1; display:flex; flex-direction:column; gap:.25rem; }
.ev-desc { font-size:.75rem; font-weight:600; color:#0f172a; }
.ev-meta { font-size:.6rem; color:#475569; display:flex; flex-wrap:wrap; gap:.35rem; }
.empty-details { padding:1rem; font-size:.7rem; color:#64748b; }
.fade-enter-active,.fade-leave-active { transition:opacity .15s ease; }
.fade-enter-from,.fade-leave-to { opacity:0; }
</style>
