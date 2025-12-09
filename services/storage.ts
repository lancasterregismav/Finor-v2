import { Transaction, AppSettings, Payable } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

const KEYS = {
  TRANSACTIONS: 'finor_transactions',
  PAYABLES: 'finor_payables',
  SETTINGS: 'finor_settings'
};

export class StorageService {
  static getTransactions(): Transaction[] {
    try {
      const data = localStorage.getItem(KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading transactions', e);
      return [];
    }
  }

  static saveTransactions(transactions: Transaction[]): void {
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }

  static getPayables(): Payable[] {
    try {
      const data = localStorage.getItem(KEYS.PAYABLES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading payables', e);
      return [];
    }
  }

  static savePayables(payables: Payable[]): void {
    localStorage.setItem(KEYS.PAYABLES, JSON.stringify(payables));
  }

  static getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(KEYS.SETTINGS);
      if (!data) return DEFAULT_SETTINGS;
      
      const settings = JSON.parse(data);
      // Merge with default to ensure new fields exist if schema changes
      return { ...DEFAULT_SETTINGS, ...settings };
    } catch (e) {
      console.error('Error loading settings', e);
      return DEFAULT_SETTINGS;
    }
  }

  static saveSettings(settings: AppSettings): void {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  }

  static exportData(): string {
    const data = {
      transactions: this.getTransactions(),
      payables: this.getPayables(),
      settings: this.getSettings(),
      exportDate: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  static async importData(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);
      if (data.transactions) this.saveTransactions(data.transactions);
      if (data.payables) this.savePayables(data.payables);
      if (data.settings) this.saveSettings(data.settings);
      return true;
    } catch (e) {
      console.error('Error importing data', e);
      return false;
    }
  }
}