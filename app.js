/* app.js - UI, storage (IndexedDB with in-memory fallback), signature pad, PDF export. */
const C = Calc;
const $ = id => document.getElementById(id);

// ---------- Storage -------------------------------------------------------
// Everything is cached in `mem` (sync reads) and written through to IndexedDB.
// If IndexedDB is unavailable (private mode etc.) the app still works for the session.
const store = (() => {
  const mem = {}; let idb = null;
  const run = fn => { try { fn(); } catch (e) { /* ignore storage errors */ } };
  async function loadAll() {
    await new Promise(res => {
      try {
        const rq = indexedDB.open('sde-recon', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
        rq.onsuccess = () => { idb = rq.result; res(); };
        rq.onerror = () => res();
      } catch (e) { res(); }
    });
    if (!idb) return;
    await new Promise(res => {
      try {
        const cur = idb.transaction('kv').objectStore('kv').openCursor();
        cur.onsuccess = () => { const c = cur.result; if (c) { mem[c.key] = c.value; c.continue(); } else res(); };
        cur.onerror = () => res();
      } catch (e) { res(); }
    });
  }
  return {
    loadAll,
    get: k => mem[k],
    keys: () => Object.keys(mem),
    set(k, v) { mem[k] = v; run(() => idb && idb.transaction('kv', 'readwrite').objectStore('kv').put(v, k)); },
    del(k) { delete mem[k]; run(() => idb && idb.transaction('kv', 'readwrite').objectStore('kv').delete(k)); }
  };
})();

// ---------- State ---------------------------------------------------------
let sel = C.toISO(new Date());           // selected date (ISO)
const weekStart = () => C.mondayOf(C.parseISO(sel));
const weekDates = () => [0, 1, 2, 3, 4].map(i => C.addDays(weekStart(), i));
const dayIdx = () => Math.min((C.parseISO(sel).getDay() + 6) % 7, 4); // Sat/Sun -> Friday
const dayKey = d => 'day:' + C.toISO(d);
const cmKey = () => 'cm:' + C.toISO(weekStart());
const getSettings = () => store.get('settings') || {};

// Entry-form field definitions (key, label, type)
const FORM = [
  ['cc', 'Cases collected', 'n'], ['cv', 'Cash value (£)', 'm'],
  ['cs', 'Cases sold', 'n'], ['cr', 'Cash received (£)', 'm'],
  ['rc', 'Cases returned', 'n'], ['rv', 'Value (£) - credit for returns', 'm'],
  ['pi', 'Cash paid in (£)', 'm'], ['fd', 'FOC drawn', 'n'],
  ['fg', 'FOC given', 'n'], ['fr', 'FOC returned', 'n']
];
// Table header text, in the exact order of the paper form / PDF
const HEAD = ['Day of week and date', 'Cases collected', 'Cash Value', 'Cases Sold', 'Cash received',
  'Cases returned', 'Value', 'Cash paid in', 'Total (cash paid in and stock value credited)',
  'Cash difference', 'Stock difference', 'FOC drawn', 'FOC given', 'FOC returned', 'Stock difference'];

// ---------- Rendering -----------------------------------------------------
function renderFields() {
  const d = weekDates()[dayIdx()], rec = store.get(dayKey(d)) || {};
  $('dayTitle').textContent = `${C.DAYS[dayIdx()]} ${C.uk(d)}`;
  $('fields').innerHTML = '';
  for (const [k, label, type] of FORM) {
    const l = document.createElement('label'); l.textContent = label;
    const i = document.createElement('input');
    i.id = 'f_' + k; i.value = rec[k] || ''; i.autocomplete = 'off';
    i.inputMode = type === 'm' ? 'decimal' : 'numeric';   // numeric keypad on Android/iPhone
    i.addEventListener('input', () => {
      // keep only digits (and one decimal point for money)
      i.value = type === 'm' ? i.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1') : i.value.replace(/\D/g, '');
      saveDay();
    });
    l.appendChild(i); $('fields').appendChild(l);
  }
}

function saveDay() {
  const rec = {}; let any = false;
  for (const [k] of FORM) { const v = $('f_' + k).value.trim(); if (v !== '') { rec[k] = v; any = true; } }
  const key = dayKey(weekDates()[dayIdx()]);
  any ? store.set(key, rec) : store.del(key);
  renderSummary();
}

function renderTabs() {
  $('tabs').innerHTML = '';
  weekDates().forEach((d, i) => {
    const b = document.createElement('button');
    b.innerHTML = `${C.DAYS[i].slice(0, 3)}<br>${String(d.getDate()).padStart(2, '0')}`;
    b.className = (i === dayIdx() ? 'on ' : '') + (store.get(dayKey(d)) ? 'has' : '');
    b.onclick = () => { sel = C.toISO(d); renderAll(); };
    $('tabs').appendChild(b);
  });
}

function currentCalc() { return C.weekCalc(weekDates().map(d => store.get(dayKey(d)))); }

function renderSummary() {
  const c = currentCalc(), dates = weekDates();
  const tr = (cells, cls, label, onclick) => {
    const r = document.createElement('tr'); if (cls) r.className = cls;
    if (onclick) r.onclick = onclick;
    r.innerHTML = `<td>${label}</td>` + cells.map((t, j) => `<td${c.badCols.includes(j) && (cls === 'tot' || label.startsWith('Friday')) ? ' class="bad"' : ''}>${t}</td>`).join('');
    return r;
  };
  const t = $('tbl'); t.innerHTML = '';
  const th = document.createElement('thead');
  th.innerHTML = '<tr>' + HEAD.map(h => `<th>${h}</th>`).join('') + '</tr>';
  t.appendChild(th);
  const tb = document.createElement('tbody');
  dates.forEach((d, i) => tb.appendChild(tr(c.rows[i], i === dayIdx() ? 'sel' : '',
    `${C.DAYS[i]}<br><small>${C.uk(d)}</small>`, () => { sel = C.toISO(d); renderAll(); })));
  tb.appendChild(tr(c.total, 'tot', 'Total'));
  t.appendChild(tb);

  // Warning banner for any non-zero check
  const msgs = [];
  if (c.bad.cash) msgs.push(`Cash difference £${C.money(c.diff.cash)}`);
  if (c.bad.stock) msgs.push(`Stock difference ${c.diff.stock}`);
  if (c.bad.foc) msgs.push(`FOC stock difference ${c.diff.foc}`);
  if (c.bad.balance) msgs.push(`C&C balance £${C.money(c.diff.balance)} (should be 0.00)`);
  $('banner').hidden = !(c.anyData && msgs.length);
  $('banner').textContent = '⚠ ' + msgs.join(' · ') + ' - remember to DECLARE this difference.';
  renderTabs();
}

function renderAll() {
  $('date').value = sel;
  const ws = weekStart();
  $('weekLabel').textContent = `Week: ${C.uk(ws)} to ${C.uk(C.addDays(ws, 4))} (Mon-Fri)`;
  renderFields(); renderSummary();
  const cm = store.get(cmKey()) || {};
  $('cm_std').value = cm.std || ''; $('cm_foc').value = cm.foc || ''; $('cm_other').value = cm.other || '';
  $('sigState').textContent = store.get('sig') ? ' ✓' : '';
}

// ---------- Settings & comments ------------------------------------------
const SET = { s_name: 'name', s_ground: 'ground', s_cc: 'cc', s_period: 'period', s_week: 'week' };
for (const id in SET) $(id).addEventListener('input', () => {
  const s = getSettings(); s[SET[id]] = $(id).value; store.set('settings', s);
});
for (const [id, k] of [['cm_std', 'std'], ['cm_foc', 'foc'], ['cm_other', 'other']])
  $(id).addEventListener('input', () => {
    const cm = store.get(cmKey()) || {}; cm[k] = $(id).value; store.set(cmKey(), cm);
  });

// ---------- Navigation ----------------------------------------------------
$('date').onchange = () => { if ($('date').value) { sel = $('date').value; renderAll(); } };
$('prev').onclick = () => { sel = C.toISO(C.addDays(weekStart(), -7)); renderAll(); };
$('next').onclick = () => { sel = C.toISO(C.addDays(weekStart(), 7)); renderAll(); };

// ---------- Demo buttons --------------------------------------------------
$('sample').onclick = () => {
  const mon = C.parseISO(C.SAMPLE_WEEK);
  if (!confirm('Load the sample week 19/10/2026? This overwrites that week.')) return;
  C.SAMPLE.forEach((rec, i) => {
    const key = dayKey(C.addDays(mon, i));
    rec ? store.set(key, { ...rec }) : store.del(key);
  });
  sel = C.SAMPLE_WEEK; renderAll();
};
$('clear').onclick = () => {
  if (!confirm('Delete ALL entries, comments and the saved signature on this device? Settings are kept.')) return;
  store.keys().filter(k => !k.startsWith('settings')).forEach(k => store.del(k));
  renderAll();
};

// ---------- Signature pad -------------------------------------------------
const pad = $('pad'), g = pad.getContext('2d');
let drawing = false, inked = false;
const pos = e => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left) * pad.width / r.width, (e.clientY - r.top) * pad.height / r.height]; };
function resetPad() { g.clearRect(0, 0, pad.width, pad.height); g.lineWidth = 3; g.lineCap = 'round'; g.strokeStyle = '#111'; inked = false; }
pad.addEventListener('pointerdown', e => { drawing = true; pad.setPointerCapture(e.pointerId); g.beginPath(); g.moveTo(...pos(e)); });
pad.addEventListener('pointermove', e => { if (drawing) { g.lineTo(...pos(e)); g.stroke(); inked = true; } });
pad.addEventListener('pointerup', () => { drawing = false; });
$('sig').onclick = () => { resetPad(); $('sigDlg').showModal(); };
$('sigClear').onclick = resetPad;
$('sigCancel').onclick = () => $('sigDlg').close();
$('sigRemove').onclick = () => { store.del('sig'); $('sigDlg').close(); renderAll(); };
$('sigSave').onclick = () => { if (inked) store.set('sig', pad.toDataURL('image/png')); $('sigDlg').close(); renderAll(); };

// ---------- PDF export ----------------------------------------------------
$('pdf').onclick = () => {
  if (!window.jspdf) { alert('PDF library not loaded.'); return; }
  const s = getSettings(), c = currentCalc(), dates = weekDates();
  const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, M = 10;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('SDE STOCK AND CASH RECONCILIATION', W / 2, 14, { align: 'center' });
  doc.setFontSize(10);
  const hdr = (label, val, x, y) => { doc.setFont('helvetica', 'bold'); doc.text(label, x, y); doc.setFont('helvetica', 'normal'); doc.text(val || '', x + doc.getTextWidth(label) + 2, y); };
  hdr('SDE Name:', s.name, M, 23); hdr('Ground No:', s.ground, 110, 23); hdr('C&C:', s.cc, 190, 23);
  hdr('Period:', s.period, M, 30); hdr('Week:', s.week, 110, 30);

  const body = dates.map((d, i) => [`${C.DAYS[i]}\n${C.uk(d)}`, ...c.rows[i]]);
  body.push(['Total', ...c.total]);
  doc.autoTable({
    startY: 35, head: [HEAD], body, theme: 'grid', tableWidth: W - 2 * M, margin: { left: M, right: M },
    styles: { fontSize: 9, halign: 'center', valign: 'middle', lineColor: 0, lineWidth: 0.3, textColor: 0, minCellHeight: 11 },
    headStyles: { fillColor: 255, textColor: 0, fontStyle: 'bold', fontSize: 7 },
    columnStyles: { 0: { halign: 'left', cellWidth: 26 } },
    didParseCell: h => { if (h.section === 'body' && h.row.index === 5) h.cell.styles.fontStyle = 'bold'; }
  });

  // Comment lines
  const cm = store.get(cmKey()) || {};
  let y = doc.lastAutoTable.finalY + 7;
  doc.setFontSize(9);
  for (const [label, txt] of [['Comments - Standard acc:', cm.std], ['Comments - FOC account:', cm.foc], ['Comment - other:', cm.other]]) {
    doc.setFont('helvetica', 'bold'); doc.text(label, M, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(txt || '', W - 2 * M - 48);
    doc.text(lines, M + 48, y);
    y += Math.max(lines.length, 1) * 4.5;
    doc.setLineWidth(0.2); doc.line(M + 48, y - 3.2, W - M, y - 3.2); // writing line
    y += 2;
  }

  // Printed notes (verbatim, from config.js)
  doc.setFontSize(7.5); y += 2;
  for (const n of FORM_NOTES) {
    const lines = doc.splitTextToSize(n, W - 2 * M);
    if (y + lines.length * 3.4 > 185) { doc.addPage(); y = 15; }
    doc.text(lines, M, y); y += lines.length * 3.4 + 1;
  }

  // Signature + date
  if (y > 180) { doc.addPage(); y = 15; }
  y = Math.max(y + 18, 192);
  const sig = store.get('sig');
  if (sig) doc.addImage(sig, 'PNG', M + 2, y - 17, 50, 20);
  doc.setFontSize(9); doc.setLineWidth(0.3);
  doc.line(M, y + 4, M + 90, y + 4); doc.text('Signature', M, y + 8);
  doc.line(140, y + 4, 200, y + 4); doc.text('Date', 140, y + 8);
  if (sig) doc.text(C.uk(new Date()), 142, y + 2.5);

  const ground = (s.ground || 'NA').replace(/[^\w-]+/g, '_');
  doc.save(`SDE_Reconciliation_${ground}_${C.uk(weekStart()).replace(/\//g, '-')}.pdf`);
};

// ---------- Start ---------------------------------------------------------
(async function init() {
  await store.loadAll();
  const s = getSettings();
  for (const id in SET) $(id).value = s[SET[id]] || '';
  renderAll();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
