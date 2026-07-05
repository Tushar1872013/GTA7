/**
 * EconomySystem — Phase 5
 *
 * Central economy manager. Tracks player money, bank balance, and provides
 * transaction methods. Income from houses/businesses is deposited here.
 *
 * - Cash: spendable on vehicles, houses, businesses, items
 * - Bank: stored money (safe from "robbery" events)
 * - Transaction history
 */
export class EconomySystem {
  constructor({ hud }) {
    this.hud = hud;
    this.cash = 5000;        // starting money
    this.bank = 0;
    this.transactions = [];  // { type: 'income'|'expense', amount, desc, time }
    this.maxHistory = 50;
  }

  add(amount, desc = 'Income') {
    this.cash += amount;
    this.transactions.unshift({ type: 'income', amount, desc, time: Date.now() });
    if (this.transactions.length > this.maxHistory) this.transactions.pop();
  }

  spend(amount, desc = 'Purchase') {
    if (this.cash < amount) return false;
    this.cash -= amount;
    this.transactions.unshift({ type: 'expense', amount, desc, time: Date.now() });
    if (this.transactions.length > this.maxHistory) this.transactions.pop();
    return true;
  }

  deposit(amount) {
    if (this.cash < amount) return false;
    this.cash -= amount;
    this.bank += amount;
    return true;
  }

  withdraw(amount) {
    if (this.bank < amount) return false;
    this.bank -= amount;
    this.cash += amount;
    return true;
  }

  getTotal() {
    return this.cash + this.bank;
  }

  getRecentTransactions(n = 10) {
    return this.transactions.slice(0, n);
  }

  // Save/load
  save() {
    return { cash: this.cash, bank: this.bank };
  }

  load(data) {
    if (data) {
      this.cash = data.cash || 0;
      this.bank = data.bank || 0;
    }
  }
}
