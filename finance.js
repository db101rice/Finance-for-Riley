// Pure money math. Everything compounds monthly.

/**
 * Invest `monthly` dollars at the end of every month from `startAge` until `endAge`.
 * Returns one point per year of age from `fromAge` to `endAge`.
 */
export function growthByAge({ monthly, annualRate, startAge, fromAge = 15, endAge = 65 }) {
  const r = annualRate / 100 / 12;
  let balance = 0;
  let contributed = 0;
  const points = [{ age: fromAge, balance: 0, contributed: 0 }];
  for (let age = fromAge; age < endAge; age++) {
    for (let m = 0; m < 12; m++) {
      balance *= 1 + r;
      if (age >= startAge) {
        balance += monthly;
        contributed += monthly;
      }
    }
    points.push({ age: age + 1, balance, contributed });
  }
  return points;
}

/** Standard fixed loan payment. */
export function loanPayment(principal, annualRate, months) {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

/**
 * Walk a loan month by month. `extra` is added to every payment.
 * Returns totals plus a per-year breakdown of principal vs interest paid.
 */
export function amortize({ principal, annualRate, years, extra = 0 }) {
  const months = Math.round(years * 12);
  const r = annualRate / 100 / 12;
  const payment = loanPayment(principal, annualRate, months);
  let balance = principal;
  let totalInterest = 0;
  let month = 0;
  const byYear = [];
  while (balance > 0.005 && month < months) {
    const interest = balance * r;
    const principalPaid = Math.min(payment + extra - interest, balance);
    balance -= principalPaid;
    totalInterest += interest;
    const y = Math.floor(month / 12);
    if (!byYear[y]) byYear[y] = { year: y + 1, principal: 0, interest: 0 };
    byYear[y].principal += principalPaid;
    byYear[y].interest += interest;
    month++;
  }
  return { payment, months: month, totalInterest, totalPaid: principal + totalInterest, byYear };
}

export const CARD_MIN_PERCENT = 1; // minimum = interest + 1% of balance
export const CARD_MIN_FLOOR = 25;  // ...but never less than $25
const CARD_MAX_MONTHS = 50 * 12;

/**
 * Pay down a credit card. `plan` is "min" or a fixed dollar amount per month.
 * Returns months to pay off (null if it never gets paid off), interest paid,
 * and the balance at the start of each month.
 */
export function payDownCard({ balance, apr, plan }) {
  const r = apr / 100 / 12;
  let bal = balance;
  let interestPaid = 0;
  let month = 0;
  const balances = [bal];
  while (bal > 0.005 && month < CARD_MAX_MONTHS) {
    const interest = bal * r;
    let pay = plan === 'min'
      ? Math.max(interest + bal * CARD_MIN_PERCENT / 100, CARD_MIN_FLOOR)
      : plan;
    if (plan !== 'min' && month === 0 && pay <= interest) {
      return { months: null, interestPaid: null, balances: null, firstMonthInterest: interest };
    }
    bal += interest;
    pay = Math.min(pay, bal);
    bal -= pay;
    interestPaid += interest;
    month++;
    balances.push(bal);
  }
  return { months: bal > 0.005 ? null : month, interestPaid, balances };
}

export const FREQUENCIES = {
  daily: { label: 'Every day', perMonth: 365 / 12 },
  thrice: { label: '3× a week', perMonth: (3 * 52) / 12 },
  weekly: { label: 'Once a week', perMonth: 52 / 12 },
  monthly: { label: 'Once a month', perMonth: 1 },
};

/** A habit's cost: what you spent vs. what it would have grown to if invested. */
export function habitByYear({ cost, frequency, annualRate, years }) {
  const monthly = cost * FREQUENCIES[frequency].perMonth;
  const r = annualRate / 100 / 12;
  let invested = 0;
  const points = [{ year: 0, spent: 0, invested: 0 }];
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) invested = invested * (1 + r) + monthly;
    points.push({ year: y, spent: monthly * 12 * y, invested });
  }
  return { monthly, points };
}
