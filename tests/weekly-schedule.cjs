const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const context = {};
vm.runInNewContext(html.slice(html.indexOf('const formatYen'), html.indexOf('const roundSettlementToHundred')) + '\nthis.qa = { weeklySchedule, correctSchedule, preferSundayRaces, repairWeeklySchedule };', context);
const { weeklySchedule, correctSchedule, preferSundayRaces, repairWeeklySchedule } = context.qa;
const initial = vm.runInNewContext(html.match(/const initialRaces = (\[[\s\S]*?\n          \]);/)[1]);
const plain = value => JSON.parse(JSON.stringify(value));
const canonical = initial.map((race, index) => ({ ...race, race: weeklySchedule[race.date], investment: (index + 1) * 100, payout: index * 200, note: `保持確認${index}` }));

const verify = (result, beforeRecords = canonical) => {
  assert.equal(result.length, 55);
  const byDate = new Map();
  const byName = new Map();
  result.forEach(race => {
    assert.equal(race.race, weeklySchedule[race.date]);
    assert.equal(new Date(race.date).getDay(), 0);
    byDate.set(race.date, (byDate.get(race.date) || 0) + 1);
    byName.set(race.race, (byName.get(race.race) || 0) + 1);
  });
  assert.equal(byDate.size, 51);
  for (const [date, count] of byDate) assert.equal(count, ['2026/5/31', '2026/12/27'].includes(date) ? 3 : 1);
  for (const [name, count] of byName) assert.equal(count, ['日本ダービー', '有馬記念'].includes(name) ? 3 : 1);
  result.forEach(race => {
    const before = beforeRecords.find(item => item.investment === race.investment);
    if (before) for (const field of ['payout', 'buyer', 'commander', 'note']) assert.equal(race[field], before[field]);
  });
};

verify(canonical);
const duplicateName = canonical.map(race => race.date === '2026/10/4' ? { ...race, race: 'アイルランドT' } : { ...race });
verify(repairWeeklySchedule(duplicateName));
const duplicateDate = canonical.map(race => race.date === '2026/10/4' ? { ...race, date: '2026/10/11', race: 'アイルランドT' } : { ...race });
const snapshot = plain(duplicateDate);
const fixed = repairWeeklySchedule(duplicateDate);
verify(fixed);
assert.deepEqual(plain(duplicateDate), snapshot);
assert.deepEqual(plain(repairWeeklySchedule(fixed)), plain(fixed));
assert.equal(fixed.find(race => race.date === '2026/10/4').investment, canonical.find(race => race.date === '2026/10/4').investment);
verify(repairWeeklySchedule(preferSundayRaces(preferSundayRaces(correctSchedule(initial)))), []);
console.log('重複名・重複日付・旧補正の再適用を修復。ダービーと有馬以外の重複なし、金額・担当者保持、補正は再実行しても不変。');
