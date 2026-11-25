import { growthByAge, amortize, payDownCard, habitByYear, FREQUENCIES, CARD_MIN_FLOOR, CARD_MIN_PERCENT } from './finance.js';
import { lineChart, stackedBars, cssVar, clearActive } from './charts.js';

// ---------- formatting ----------
const money = (v) => '$' + Math.round(v).toLocaleString('en-US');
const moneyCents = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function moneyShort(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return '$' + +(v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
  if (a >= 1e3) return '$' + +(v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k';
  return '$' + Math.round(v);
}
function duration(months) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} year${y === 1 ? '' : 's'}`);
  if (m) parts.push(`${m} month${m === 1 ? '' : 's'}`);
  return parts.join(' ') || '0 months';
}
const pct = (v) => `${+v.toFixed(2)}%`;
const colors = () => [cssVar('--series-1'), cssVar('--series-2'), cssVar('--series-3')];

// ---------- tiny UI helpers ----------
function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** A labelled range slider bound to `state[key]`. */
function slider(state, key, { label, min, max, step, format }, onChange) {
  const node = h(`
    <label class="slider">
      <span class="slider-top"><span>${label}</span><output></output></span>
      <input type="range" min="${min}" max="${max}" step="${step}">
    </label>`);
  const input = node.querySelector('input');
  const out = node.querySelector('output');
  const sync = () => {
    out.textContent = format(state[key]);
    const p = ((state[key] - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--fill', `${p}%`);
  };
  input.value = state[key];
  sync();
  input.addEventListener('input', () => {
    state[key] = Number(input.value);
    sync();
    onChange();
  });
  node.set = (attrs) => {
    for (const [k, v] of Object.entries(attrs)) input[k] = v;
    state[key] = Number(input.value);
    sync();
  };
  return node;
}

/** A row of toggle buttons. */
function segmented(options, current, onPick, cls = 'segmented') {
  const node = h(`<div class="${cls}" role="group"></div>`);
  const buttons = options.map(({ value, label }) => {
    const b = h(`<button type="button">${label}</button>`);
    b.addEventListener('click', () => {
      select(value);
      onPick(value);
    });
    node.appendChild(b);
    return { b, value };
  });
  const select = (v) => buttons.forEach(({ b, value }) => b.setAttribute('aria-pressed', String(value === v)));
  select(current);
  node.select = select;
  return node;
}

function scheduler(fn) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
}

// The page skeleton every topic shares: controls, hero number, tiles, chart, takeaway.
function topicLayout(intro) {
  return h(`
    <section class="topic">
      <p class="intro">${intro}</p>
      <div class="card controls"></div>
      <div class="card result">
        <div class="hero"><div class="hero-pre"></div><div class="hero-num"></div><div class="hero-post"></div></div>
        <div class="tiles"></div>
        <div class="chart-wrap"><div class="chart-title"></div><div class="chart-box"></div><p class="chart-hint">Touch the chart to see exact numbers.</p></div>
      </div>
      <div class="card takeaway"><span class="emoji">💡</span><p></p></div>
    </section>`);
}

function setHero(root, pre, num, post) {
  root.querySelector('.hero-pre').textContent = pre;
  root.querySelector('.hero-num').textContent = num;
  root.querySelector('.hero-post').innerHTML = post;
}
function setTiles(root, tiles) {
  root.querySelector('.tiles').innerHTML = tiles
    .map((t) => `<div class="tile${t.cls ? ' ' + t.cls : ''}"><div class="tile-label">${t.label}</div><div class="tile-value">${t.value}</div>${t.sub ? `<div class="tile-sub">${t.sub}</div>` : ''}</div>`)
    .join('');
}
const setTakeaway = (root, html) => (root.querySelector('.takeaway p').innerHTML = html);

// ---------- Topic 1: Start early ----------
function startEarly() {
  const s = { monthly: 100, rate: 7, ageA: 15, ageB: 25 };
  const root = topicLayout('Two people invest the <b>same amount every month</b> until age 65. The only difference is when they start. Move the sliders and watch the gap.');
  const controls = root.querySelector('.controls');
  const render = scheduler(draw);
  controls.append(
    slider(s, 'monthly', { label: 'Invest each month', min: 25, max: 500, step: 25, format: money }, render),
    slider(s, 'rate', { label: 'Yearly return', min: 4, max: 10, step: 0.5, format: pct }, render),
    slider(s, 'ageA', { label: 'Person 1 starts at age', min: 15, max: 60, step: 1, format: (v) => v }, render),
    slider(s, 'ageB', { label: 'Person 2 starts at age', min: 15, max: 60, step: 1, format: (v) => v }, render),
  );
  root.appendChild(h(`
    <div class="card note">
      <h3>What's a Roth IRA?</h3>
      <p>Once you earn money from a job, you can put up to what you earned (capped at the yearly limit) into a <b>Roth IRA</b>.
      It grows <b>tax-free</b>, and you take it out <b>tax-free</b> when you retire. Starting one as a teen is the head start this chart shows.</p>
    </div>`));
  root.querySelector('.chart-title').textContent = 'Money by age';

  function draw() {
    const [c1, c2] = colors();
    const a = growthByAge({ monthly: s.monthly, annualRate: s.rate, startAge: s.ageA });
    const b = growthByAge({ monthly: s.monthly, annualRate: s.rate, startAge: s.ageB });
    const endA = a[a.length - 1];
    const endB = b[b.length - 1];
    const [early, late] = s.ageA <= s.ageB ? [{ age: s.ageA, end: endA }, { age: s.ageB, end: endB }] : [{ age: s.ageB, end: endB }, { age: s.ageA, end: endA }];

    setHero(root, `Start at ${early.age} and at 65 you'd have`, money(early.end.balance), `You only put in <b>${money(early.end.contributed)}</b>. The other <b>${money(early.end.balance - early.end.contributed)}</b> is growth.`);
    const tile = (name, age, end) => ({
      label: `${name} (starts at ${age})`,
      value: money(end.balance),
      sub: `put in ${money(end.contributed)}`,
    });
    setTiles(root, [tile('Person 1', s.ageA, endA), tile('Person 2', s.ageB, endB)]);

    lineChart(root.querySelector('.chart-box'), {
      xs: a.map((p) => p.age),
      series: [
        { name: `Person 1 (starts at ${s.ageA})`, color: c1, values: a.map((p) => p.balance) },
        { name: `Person 2 (starts at ${s.ageB})`, color: c2, values: b.map((p) => p.balance) },
      ],
      yFormat: moneyShort,
      tipFormat: money,
      xFormat: (v) => `${v}`,
      tipTitle: (v) => `Age ${v}`,
      directLabels: true,
      ariaLabel: 'Line chart of money by age for both people',
    });

    if (early.age === late.age) {
      setTakeaway(root, 'Both start at the same age, so they end up with the same money. Try moving one of the age sliders.');
    } else {
      const extraIn = early.end.contributed - late.end.contributed;
      const extraOut = early.end.balance - late.end.balance;
      const ratio = early.end.balance / Math.max(1, late.end.balance);
      setTakeaway(root, `Starting <b>${late.age - early.age} years earlier</b> means <b>${ratio.toFixed(1)}× more money</b> at 65. The early starter put in only <b>${money(extraIn)}</b> more, but ends up with <b>${money(extraOut)}</b> more. That's compound growth: your money earns money, then that money earns money too.`);
    }
  }
  return { root, draw };
}

// ---------- Topic 2: Loans ----------
const LOAN_PRESETS = {
  car: { label: '🚗 Car', thing: 'car', amount: [5000, 80000, 500, 25000], rate: 8, years: [1, 8, 6], extraMax: 500 },
  student: { label: '🎓 Student loan', thing: 'student loan', amount: [5000, 150000, 1000, 30000], rate: 6.5, years: [1, 25, 10], extraMax: 500 },
  mortgage: { label: '🏠 Mortgage', thing: 'house loan', amount: [50000, 1000000, 5000, 300000], rate: 6.5, years: [5, 30, 30], extraMax: 1000 },
};

function loans() {
  const s = { preset: 'car', amount: 25000, rate: 8, years: 6, extra: 50 };
  const root = topicLayout('When you borrow money, you pay it back <b>plus interest</b>. Interest is the price of borrowing. See what things really cost.');
  const controls = root.querySelector('.controls');
  const render = scheduler(draw);
  const sAmount = slider(s, 'amount', { label: 'Borrow', min: 5000, max: 80000, step: 500, format: money }, render);
  const sRate = slider(s, 'rate', { label: 'Interest rate (APR)', min: 0, max: 20, step: 0.25, format: pct }, render);
  const sYears = slider(s, 'years', { label: 'Pay back over', min: 1, max: 8, step: 1, format: (v) => `${v} year${v === 1 ? '' : 's'}` }, render);
  const sExtra = slider(s, 'extra', { label: 'Pay a little extra each month', min: 0, max: 500, step: 10, format: money }, render);
  const applyPreset = (key) => {
    const p = LOAN_PRESETS[key];
    s.preset = key;
    sAmount.set({ min: p.amount[0], max: p.amount[1], step: p.amount[2], value: p.amount[3] });
    sRate.set({ value: p.rate });
    sYears.set({ min: p.years[0], max: p.years[1], value: p.years[2] });
    sExtra.set({ max: p.extraMax, value: 50 });
    render();
  };
  controls.append(
    segmented(Object.entries(LOAN_PRESETS).map(([value, p]) => ({ value, label: p.label })), s.preset, applyPreset, 'chips'),
    sAmount, sRate, sYears, sExtra,
  );
  root.querySelector('.chart-title').textContent = 'Where each year of payments goes';

  function draw() {
    const [c1, c2] = colors();
    const p = LOAN_PRESETS[s.preset];
    const base = amortize({ principal: s.amount, annualRate: s.rate, years: s.years });
    const withExtra = amortize({ principal: s.amount, annualRate: s.rate, years: s.years, extra: s.extra });

    setHero(root, `A ${money(s.amount)} ${p.thing} really costs`, money(base.totalPaid), `That's <b>${money(base.totalInterest)}</b> of interest, money that just disappears.`);
    const savedMonths = base.months - withExtra.months;
    const savedInterest = base.totalInterest - withExtra.totalInterest;
    setTiles(root, [
      { label: 'Monthly payment', value: moneyCents(base.payment), sub: `for ${duration(base.months)}` },
      { label: 'Total interest', value: money(base.totalInterest), sub: `${Math.round((base.totalInterest / s.amount) * 100)}% on top of the loan` },
      s.extra > 0 && savedInterest > 0.5
        ? { label: `Pay ${money(s.extra)} extra a month`, value: `Save ${money(savedInterest)}`, sub: `Paid off ${duration(savedMonths)} sooner`, cls: 'wide good' }
        : { label: 'Pay a little extra', value: 'Move the slider', sub: 'to see what extra payments save', cls: 'wide' },
    ]);

    stackedBars(root.querySelector('.chart-box'), {
      categories: base.byYear.map((y) => `Yr ${y.year}`),
      series: [
        { name: 'Paying off the loan', color: c1, values: base.byYear.map((y) => y.principal) },
        { name: 'Interest', color: c2, values: base.byYear.map((y) => y.interest) },
      ],
      yFormat: moneyShort,
      tipFormat: money,
      tipTitle: (i) => `Year ${i + 1}`,
      ariaLabel: 'Stacked bars of loan payoff and interest for each year',
    });

    const per1 = base.totalPaid / s.amount;
    const y1 = base.byYear[0];
    const firstYearPct = y1 ? Math.round((y1.interest / (y1.interest + y1.principal)) * 100) : 0;
    setTakeaway(root, s.rate === 0
      ? 'At 0% interest, borrowing costs nothing extra. That almost never happens, so try a real rate.'
      : `For every <b>$1</b> you borrow, you pay back <b>${moneyCents(per1)}</b>. In year 1, <b>${firstYearPct}%</b> of your payments go to interest, so early on you're mostly paying the lender, not paying down the loan. Shorter loans, lower rates and extra payments all cut the interest.`);
  }
  return { root, draw };
}

// ---------- Topic 3: Credit cards ----------
function creditCards() {
  const s = { balance: 2000, apr: 24, plan: 'min' };
  const root = topicLayout(`Credit cards charge some of the <b>highest interest</b> there is. The bill shows a small "minimum payment". Here's what happens if that's all you pay.`);
  const controls = root.querySelector('.controls');
  const render = scheduler(draw);
  const PLANS = [
    { value: 'min', label: 'Minimum', phrase: 'only the minimum', amount: 'min' },
    { value: '100', label: '$100/mo', phrase: '$100 a month', amount: 100 },
    { value: '200', label: '$200/mo', phrase: '$200 a month', amount: 200 },
  ];
  controls.append(
    slider(s, 'balance', { label: 'Card balance', min: 500, max: 10000, step: 100, format: money }, render),
    slider(s, 'apr', { label: 'Interest rate (APR)', min: 10, max: 36, step: 0.5, format: pct }, render),
    h('<div class="control-label">How you pay it back</div>'),
    segmented(PLANS, s.plan, (v) => { s.plan = v; render(); }),
  );
  root.appendChild(h(`
    <div class="card note">
      <h3>The golden rule</h3>
      <p>Pay the <b>full balance every month</b> and you pay <b>$0 interest</b>. Used that way, a credit card is free and builds your credit score.</p>
      <p class="fine">"Minimum" here is interest + ${CARD_MIN_PERCENT}% of the balance (at least $${CARD_MIN_FLOOR}), which is how many cards work.</p>
    </div>`));
  root.querySelector('.chart-title').textContent = 'What you still owe';

  function draw() {
    const cs = colors();
    const results = PLANS.map((p) => ({ ...p, r: payDownCard({ balance: s.balance, apr: s.apr, plan: p.amount }) }));
    const chosen = results.find((p) => p.value === s.plan);

    if (chosen.r.months == null) {
      setHero(root, `Paying ${chosen.phrase}, you'd pay it off`, 'Never 😬', `The card adds <b>${money(chosen.r.firstMonthInterest)}</b> of interest a month. That's more than you pay, so the balance keeps growing.`);
    } else {
      setHero(root, `Paying ${chosen.phrase}, it takes`, duration(chosen.r.months), `and costs <b>${money(chosen.r.interestPaid)}</b> in interest, on top of the ${money(s.balance)} you spent.`);
    }
    setTiles(root, results.map((p) => ({
      label: p.label,
      value: p.r.months == null ? 'Never' : duration(p.r.months).replace(/ years?/, 'y').replace(/ months?/, 'm'),
      sub: p.r.months == null ? 'interest > payment' : `${money(p.r.interestPaid)} interest`,
      cls: p.value === s.plan ? 'selected' : '',
    })));

    const payable = results.filter((p) => p.r.balances);
    const box = root.querySelector('.chart-box');
    if (payable.length) {
      const len = Math.max(...payable.map((p) => p.r.balances.length));
      const xs = Array.from({ length: len }, (_, i) => i);
      lineChart(box, {
        xs,
        series: payable.map((p) => ({
          name: p.label,
          color: cs[PLANS.indexOf(PLANS.find((q) => q.value === p.value))],
          values: xs.map((i) => p.r.balances[i] ?? 0),
        })),
        yFormat: moneyShort,
        tipFormat: money,
        xUnit: 12,
        xFormat: (m) => (m === 0 ? 'now' : `${m / 12}y`),
        tipTitle: (m) => (m === 0 ? 'Today' : `After ${duration(m)}`),
        ariaLabel: 'Line chart of card balance over time for each way of paying',
      });
    } else {
      box.innerHTML = '<p class="empty">None of these payments beat the interest. The balance would grow forever.</p>';
    }

    const min = results[0].r;
    const big = results[2].r;
    let msg;
    if (min.months != null && big.months != null && min.months > big.months) {
      msg = `Paying <b>$200</b> instead of the minimum saves <b>${money(min.interestPaid - big.interestPaid)}</b> and gets you debt-free <b>${duration(min.months - big.months)} sooner</b>. The minimum payment is designed to keep you paying for a long time.`;
    } else {
      msg = 'The bigger the payment, the less interest the card company gets. Pay the full balance and you pay nothing extra.';
    }
    setTakeaway(root, msg);
  }
  return { root, draw };
}

// ---------- Topic 4: Small habits ----------
const HABITS = {
  coffee: { label: '☕ Coffee', cost: 5, frequency: 'daily' },
  energy: { label: '⚡ Energy drink', cost: 3, frequency: 'daily' },
  food: { label: '🍔 Fast food', cost: 12, frequency: 'thrice' },
  game: { label: '🎮 Game skins', cost: 20, frequency: 'monthly' },
};

function habits() {
  const START_AGE = 15;
  const END_AGE = 65;
  const s = { habit: 'coffee', cost: 5, frequency: 'daily', rate: 7 };
  const root = topicLayout('Little things you buy all the time add up. What if you invested that money instead, from now until 65?');
  const controls = root.querySelector('.controls');
  const render = scheduler(draw);
  const sCost = slider(s, 'cost', { label: 'It costs', min: 1, max: 50, step: 0.5, format: moneyCents }, () => { chips.select(null); render(); });
  const freq = segmented(Object.entries(FREQUENCIES).map(([value, f]) => ({ value, label: f.label })), s.frequency, (v) => { s.frequency = v; chips.select(null); render(); });
  const chips = segmented(Object.entries(HABITS).map(([value, x]) => ({ value, label: x.label })), s.habit, (key) => {
    s.habit = key;
    sCost.set({ value: HABITS[key].cost });
    s.frequency = HABITS[key].frequency;
    freq.select(s.frequency);
    render();
  }, 'chips');
  controls.append(
    chips,
    sCost,
    h('<div class="control-label">How often</div>'),
    freq,
    slider(s, 'rate', { label: 'Yearly return if invested', min: 4, max: 10, step: 0.5, format: pct }, render),
  );
  root.querySelector('.chart-title').textContent = 'Spent vs. invested, by age';

  function draw() {
    const [c1, c2] = colors();
    const years = END_AGE - START_AGE;
    const { monthly, points } = habitByYear({ cost: s.cost, frequency: s.frequency, annualRate: s.rate, years });
    const end = points[points.length - 1];
    setHero(root, `Invested instead, by age ${END_AGE} it would be`, money(end.invested), `You'd spend <b>${money(monthly * 12)}</b> a year on it, <b>${money(end.spent)}</b> in total.`);
    setTiles(root, [10, 20, 40].map((y) => ({
      label: `In ${y} years`,
      value: moneyShort(points[y].invested),
      sub: `age ${START_AGE + y} · spent ${moneyShort(points[y].spent)}`,
    })));

    lineChart(root.querySelector('.chart-box'), {
      xs: points.map((p) => p.year),
      series: [
        { name: 'If invested', color: c1, values: points.map((p) => p.invested) },
        { name: 'Money spent', color: c2, values: points.map((p) => p.spent) },
      ],
      yFormat: moneyShort,
      tipFormat: money,
      xFormat: (y) => `${START_AGE + y}`,
      tipTitle: (y) => `Age ${START_AGE + y}`,
      directLabels: true,
      ariaLabel: 'Line chart of money spent compared with the same money invested',
    });

    const ratio = end.invested / Math.max(1, end.spent);
    setTakeaway(root, `That's <b>${money(monthly)}</b> a month. Invested instead, the <b>${money(end.spent)}</b> you'd spend turns into <b>${money(end.invested)}</b>, about <b>${ratio.toFixed(0)}× as much</b>. You don't have to give up everything you like. Just know what it really costs, and choose on purpose.`);
  }
  return { root, draw };
}

// ---------- routing ----------
const TOPICS = {
  early: { title: 'Start Early', emoji: '🚀', blurb: 'Why starting at 15 beats starting at 25', make: startEarly },
  loans: { title: 'Loans', emoji: '🚗', blurb: 'What a car, college or house really costs', make: loans },
  cards: { title: 'The Credit Card Trap', emoji: '💳', blurb: 'Why the "minimum payment" is a trap', make: creditCards },
  habits: { title: 'Small Habits Add Up', emoji: '☕', blurb: 'What $5 a day really costs you', make: habits },
};

const app = document.getElementById('app');
const titleEl = document.getElementById('title');
const backEl = document.getElementById('back');
let current = null;

function home() {
  const root = h(`
    <section class="home">
      <div class="greeting">
        <h2>Hey Riley 👋</h2>
        <p>Money grows when you save it and shrinks when you borrow it. Pick a topic, move the sliders and see for yourself.</p>
      </div>
      <nav class="topic-cards"></nav>
    </section>`);
  const nav = root.querySelector('nav');
  for (const [key, t] of Object.entries(TOPICS)) {
    nav.appendChild(h(`<a class="topic-card" href="#/${key}"><span class="tc-emoji">${t.emoji}</span><span class="tc-text"><b>${t.title}</b><span>${t.blurb}</span></span><span class="tc-arrow">›</span></a>`));
  }
  return { root, draw: () => {} };
}

function route() {
  clearActive();
  const key = location.hash.replace(/^#\/?/, '');
  const topic = TOPICS[key];
  current = topic ? topic.make() : home();
  titleEl.textContent = topic ? `${topic.emoji} ${topic.title}` : "Riley's Money Lab";
  document.title = topic ? `${topic.title} · Riley's Money Lab` : "Riley's Money Lab";
  backEl.hidden = !topic;
  app.replaceChildren(current.root);
  current.draw();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => current && current.draw(), 150);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => current && current.draw());
route();

if ('serviceWorker' in navigator && window.isSecureContext) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    // Home-screen apps often resume without reloading, so check for a new
    // version every time the app comes back to the front.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update();
    });
  });
  // A new version took over: reload once so it shows right away.
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) {
      reloaded = true;
      location.reload();
    }
  });
}
