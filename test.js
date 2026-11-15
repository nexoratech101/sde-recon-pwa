// Run: node test.js  - checks calculations against the figures on the paper form.
const C = require('./calc.js');
const assert = require('assert');

const c = C.weekCalc(C.SAMPLE);
assert.deepStrictEqual(c.total,
  ['82', '819.10', '49', '461.40', '33', '357.68', '461.42', '819.10', '0.02', '0', '0', '0', '0', '0']);
assert.strictEqual(c.diff.balance, 0);                       // C&C balance
assert.deepStrictEqual(c.badCols, [8]);                      // only cash diff is non-zero
assert.deepStrictEqual(c.rows[0], Array(14).fill('-'));      // blank Monday
assert.strictEqual(c.rows[1][8], '0.00');                    // Tue shows 0 diffs
assert.strictEqual(c.rows[4][8], '0.02');                    // Fri shows settlement diff
assert.strictEqual(c.rows[4][7], '819.10');                  // 461.42 + 357.68

// Dates
assert.strictEqual(C.toISO(C.mondayOf(C.parseISO('2026-10-24'))), '2026-10-19'); // Sat -> Mon
assert.strictEqual(C.toISO(C.mondayOf(C.parseISO('2026-10-25'))), '2026-10-19'); // Sun -> Mon
assert.strictEqual(C.uk(C.parseISO('2026-10-19')), '19/10/2026');
assert.strictEqual(C.parseISO(C.SAMPLE_WEEK).getDay(), 1);   // 19/10/2026 is a Monday
console.log('All tests passed');
