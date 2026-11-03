/* ---------- language: English and Chinese, switchable at any time ---------- */
const STRINGS = {
  en: {
    title: 'Dockhand', lang: '中文', soundOn: 'Sound on', soundOff: 'Sound off', rules: 'Rules',
    today: 'Today', thisBoat: 'This boat', tide: 'Tide', seconds: '{s}s', full: 'full',
    boatOf: 'Boat {i}/{n}', roll: 'Roll', pitch: 'Pitch', freeboard: 'Freeboard',
    rotate: 'Rotate', sail: 'Sail', more: '{n} more to come',
    canvasLabel: 'A dock and a cargo boat. Click the deck to drop the crate.',
    manifestTitle: 'Boat {i}: {name}', manifest: 'Manifest', colCargo: 'Cargo', colWeight: 'Weight', colQty: 'Qty',
    tall: ' (tall)', tons: '{n} t', sum: '{n} crates, {w} t', once: 'You only see this once', start: 'Start loading',
    touchHint: 'Drag anywhere to move the crane, tap to drop',
    notFlat: 'Not flat', tooHigh: 'Too high', noRoom: 'No room',
    capsized: 'Capsized', swamped: 'Swamped', paid: '+{v} freight', lost: 'Lost overboard −{v}',
    dayDone: 'Day done', sank: 'sank', crates: '{n} crates', lostShort: '−{n} lost',
    total: 'Today {s}', newBest: 'new best', best: 'best {b}', again: 'Another day',
    ruleList: [
      'Desktop: click to drop; R, right-click or the wheel rotates',
      'Phone: drag anywhere to move the crane, tap to drop',
      'Stack up to three high: 2nd layer <em>×1.5</em>, 3rd layer <em>×2</em>',
      'A fully covered deck <em>×1.3</em>',
      'Tilt into the red and the top crates slide off',
      'A crate in the sea is <em>charged</em> at its value',
      'Capsize or swamp and the boat scores 0',
    ],
    boats: ['Skiff', 'Narrowboat', 'Flat barge'],
    cargo: { wood: 'Crate', long: 'Long crate', big: 'Big crate', iron: 'Iron box', tall: 'Cabinet', fruit: 'Fruit basket',
      lumber: 'Lumber', machine: 'Machine', drum: 'Oil drum', fridge: 'Fridge', hay: 'Hay bale' },
  },
  zh: {
    title: '码头装货', lang: 'EN', soundOn: '声音 开', soundOff: '声音 关', rules: '规则',
    today: '今日运费', thisBoat: '这船能赚', tide: '潮水', seconds: '{s} 秒', full: '满载',
    boatOf: '第 {i}/{n} 条', roll: '左右', pitch: '前后', freeboard: '离水',
    rotate: '转向', sail: '开船结算', more: '后面还有 {n} 箱',
    canvasLabel: '码头和货船，点击甲板放下货箱',
    manifestTitle: '第 {i} 条船：{name}', manifest: '货单', colCargo: '货物', colWeight: '每箱重', colQty: '数量',
    tall: '（高）', tons: '{n} 吨', sum: '共 {n} 箱 {w} 吨', once: '货单只看这一次', start: '开始装货',
    touchHint: '空白处拖动移动吊车，轻点放下',
    notFlat: '底下不平', tooHigh: '太高了', noRoom: '放不下',
    capsized: '翻船了', swamped: '进水了', paid: '运费 +{v}', lost: '落海 −{v}',
    dayDone: '收工', sank: '沉了', crates: '{n} 箱', lostShort: '赔{n}',
    total: '今天运费 {s}', newBest: '新纪录', best: '最好 {b}', again: '再来一天',
    ruleList: [
      '电脑：单击放下，R 键、右键或滚轮转向',
      '手机：空白处拖动移动吊车，轻点放下',
      '最多叠三层，第二层 <em>×1.5</em>，第三层 <em>×2</em>',
      '甲板铺满 <em>×1.3</em>',
      '倾斜进红区，顶上的箱子会滑走',
      '箱子掉进海里，按价值<em>倒扣</em>',
      '翻船或进水，这船记 0',
    ],
    boats: ['小舢板', '窄货船', '平底驳'],
    cargo: { wood: '木箱', long: '长木箱', big: '大货箱', iron: '铁箱', tall: '高柜', fruit: '果筐',
      lumber: '木料', machine: '机器', drum: '油桶', fridge: '冰柜', hay: '草垛' },
  },
};
/* a single-language build (build.py --lang zh) pins this and drops the switch */
const ONLY_LANG = null;
let LANG = (() => {
  if (ONLY_LANG) return ONLY_LANG;
  try { const saved = localStorage.getItem('dock-lang'); if (saved && STRINGS[saved]) return saved; } catch (e) { /* storage blocked */ }
  return /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
})();
/* tx('boatOf', { i: 1, n: 3 }) → 'Boat 1/3' */
function tx(key, vars) {
  let s = STRINGS[LANG][key];
  if (s == null && STRINGS.en) s = STRINGS.en[key];
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
const cargoName = type => STRINGS[LANG].cargo[type];
const boatName = idx => STRINGS[LANG].boats[idx];
/* fill every static label, then let the game redraw anything it built itself */
function applyLang() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  document.title = tx('title');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tx(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-label]').forEach(el => el.setAttribute('aria-label', tx(el.dataset.i18nLabel)));
  const ul = document.getElementById('rulesList');
  ul.innerHTML = STRINGS[LANG].ruleList.map(r => `<li>${r}</li>`).join('');
  const btn = document.getElementById('lang');
  if (!btn) return;
  btn.textContent = tx('lang');
  btn.setAttribute('aria-label', LANG === 'zh' ? 'Switch to English' : '切换到中文');
}
function setLang(l) {
  LANG = l;
  try { localStorage.setItem('dock-lang', l); } catch (e) { /* storage blocked */ }
  applyLang();
  if (typeof onLangChange === 'function') onLangChange();
}
applyLang();
