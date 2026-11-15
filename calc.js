/* calc.js - pure calculation + date helpers (no DOM). Works in browser and Node (tests).
   Money is held as integer PENCE internally so sums never suffer float errors. */
(function (root) {
  // Input fields: key -> type ('n' = whole number, 'm' = money)
  const FIELDS = { cc: 'n', cv: 'm', cs: 'n', cr: 'm', rc: 'n', rv: 'm', pi: 'm', fd: 'n', fg: 'n', fr: 'n' };

  // Parse raw typed text. Blank/invalid -> null (means "not entered").
  const toP = v => (v === '' || v == null || isNaN(+v)) ? null : Math.round(+v * 100);
  const toN = v => (v === '' || v == null || isNaN(+v)) ? null : Math.trunc(+v);

  const money = p => p == null ? '-' : (p / 100).toFixed(2);
  const int = n => n == null ? '-' : String(n);

  // ---- Week calculation -------------------------------------------------
  // recs: array of 5 raw day records (Mon..Fri), each {cc,cv,...} of strings or undefined.
  function weekCalc(recs) {
    const days = [];
    for (let i = 0; i < 5; i++) {
      const r = recs[i] || {}, v = {};
      let any = false;
      for (const k in FIELDS) {
        v[k] = FIELDS[k] === 'm' ? toP(r[k]) : toN(r[k]);
        if (v[k] !== null) any = true;
      }
      days.push({ v, blank: !any });
    }
    // Total row = sum of each input column across the week
    const t = {};
    for (const k in FIELDS) t[k] = days.reduce((a, d) => a + (d.v[k] || 0), 0);
    t.tot = t.pi + t.rv; // cash paid in + value credited

    // Differences use WEEK cumulative totals
    const diff = {
      cash: t.pi - t.cr,          // Cash paid in - Cash received
      stock: t.cc - t.cs - t.rc,  // Collected - Sold - Returned
      foc: t.fd - t.fg - t.fr,    // FOC drawn - given - returned
      balance: t.cv - t.tot       // C&C balance: must be 0
    };
    const bad = { cash: diff.cash !== 0, stock: diff.stock !== 0, foc: diff.foc !== 0, balance: diff.balance !== 0 };
    const anyData = days.some(d => !d.blank);

    // 14 display cells per row (columns 2..15 of the form)
    const cellsFor = (v, tot, dCash, dStock, dFoc) => [
      int(v.cc), money(v.cv), int(v.cs), money(v.cr), int(v.rc), money(v.rv), money(v.pi),
      money(tot), dCash, dStock, int(v.fd), int(v.fg), int(v.fr), dFoc
    ];
    const rows = days.map((d, i) => {
      const tot = (d.v.pi == null && d.v.rv == null) ? null : (d.v.pi || 0) + (d.v.rv || 0);
      // Friday (i==4) = settlement row: shows week differences. Mon-Thu show 0 (or "-" if blank).
      if (i === 4) return cellsFor(d.v, tot, money(diff.cash), String(diff.stock), String(diff.foc));
      const z = d.blank ? ['-', '-', '-'] : ['0.00', '0', '0'];
      return cellsFor(d.v, tot, z[0], z[1], z[2]);
    });
    const total = cellsFor(t, t.tot, money(diff.cash), String(diff.stock), String(diff.foc));
    // Column indexes (within the 14 cells) that get red highlighting when non-zero
    const badCols = [];
    if (bad.cash) badCols.push(8);
    if (bad.stock) badCols.push(9);
    if (bad.foc) badCols.push(13);
    return { days, totals: t, diff, bad, rows, total, badCols, anyData };
  }

  // ---- Dates (local time, no timezone surprises) -------------------------
  const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const mondayOf = d => addDays(d, -((d.getDay() + 6) % 7)); // Sun->prev Mon
  const uk = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // ---- Demo data: week of 19/10/2026 from the paper form -----------------
  const SAMPLE_WEEK = '2026-10-19';
  const z = { fd: '0', fg: '0', fr: '0' };
  const SAMPLE = [
    null, // Monday blank
    { cc: '48', cv: '462.35', cs: '17', cr: '160.79', ...z },
    { cc: '20', cv: '206.94', cs: '14', cr: '135.73', ...z },
    { cc: '14', cv: '149.81', cs: '17', cr: '153.05', ...z },
    { cc: '0', cv: '0', cs: '1', cr: '11.83', rc: '33', rv: '357.68', pi: '461.42', ...z }
  ];

  const api = { FIELDS, weekCalc, parseISO, toISO, addDays, mondayOf, uk, DAYS, SAMPLE, SAMPLE_WEEK, money };
  if (typeof module !== 'undefined') module.exports = api; else root.Calc = api;
})(this);
