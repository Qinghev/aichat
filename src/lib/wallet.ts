import type { AppState, Wallet } from "../types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const defaultWallet = (): Wallet => ({
  balance: 5_000_000,
  weeklyAllowance: 20_000,
  lastWeeklyCreditAt: new Date().toISOString(),
  totalSent: 0,
  totalReceived: 0
});

export const normalizeWallet = (wallet?: Partial<Wallet>): Wallet => ({
  ...defaultWallet(),
  ...wallet,
  balance: Number.isFinite(wallet?.balance) ? Number(wallet?.balance) : 5_000_000,
  weeklyAllowance: Number.isFinite(wallet?.weeklyAllowance) ? Number(wallet?.weeklyAllowance) : 20_000,
  totalSent: Number.isFinite(wallet?.totalSent) ? Number(wallet?.totalSent) : 0,
  totalReceived: Number.isFinite(wallet?.totalReceived) ? Number(wallet?.totalReceived) : 0,
  lastWeeklyCreditAt: wallet?.lastWeeklyCreditAt || new Date().toISOString()
});

export const applyWeeklyWalletCredit = (state: AppState, now = new Date()): AppState => {
  const wallet = normalizeWallet(state.wallet);
  const last = new Date(wallet.lastWeeklyCreditAt);
  if (Number.isNaN(last.getTime())) {
    return { ...state, wallet: { ...wallet, lastWeeklyCreditAt: now.toISOString() } };
  }

  const weeks = Math.floor((now.getTime() - last.getTime()) / WEEK_MS);
  if (weeks <= 0) return { ...state, wallet };

  return {
    ...state,
    wallet: {
      ...wallet,
      balance: wallet.balance + weeks * wallet.weeklyAllowance,
      lastWeeklyCreditAt: new Date(last.getTime() + weeks * WEEK_MS).toISOString()
    }
  };
};

export const formatMoney = (amount: number) => `¥${Math.max(0, Math.round(amount)).toLocaleString("zh-CN")}`;

export const pickRedPacketAmount = (seed: string) => {
  const options = [18, 52, 66, 88, 188, 520, 666, 888];
  const index = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0) % options.length;
  return options[index];
};
