
import { Transaction, AppSettings, Payable } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

const KEYS = {
  TRANSACTIONS: 'finor_transactions_v2',
  SETTINGS: 'finor_settings_v2',
  PAYABLES: 'finor_payables_v1',
};

export const StorageService = {
  getTransactions: (): Transaction[] => {
    try {
      const data = localStorage.getItem(KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Error reading transactions", e);
      return [];
    }
  },

  saveTransactions: (transactions: Transaction[]) => {
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
  },

  getPayables: (): Payable[] => {
    try {
      const data = localStorage.getItem(KEYS.PAYABLES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Error reading payables", e);
      return [];
    }
  },

  savePayables: (payables: Payable[]) => {
    localStorage.setItem(KEYS.PAYABLES, JSON.stringify(payables));
  },

  getSettings: (): AppSettings => {
    try {
      const data = localStorage.getItem(KEYS.SETTINGS);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  },

  // Backup functionalities
  exportData: () => {
    const data = {
      transactions: StorageService.getTransactions(),
      payables: StorageService.getPayables(),
      settings: StorageService.getSettings(),
      version: '1.1',
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  },

  importData: async (jsonString: string): Promise<boolean> => {
    try {
      const data = JSON.parse(jsonString);
      if (data.transactions && Array.isArray(data.transactions)) {
        localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(data.transactions));
      }
      if (data.payables && Array.isArray(data.payables)) {
        localStorage.setItem(KEYS.PAYABLES, JSON.stringify(data.payables));
      }
      if (data.settings) {
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
      }
      return true;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  }
};
