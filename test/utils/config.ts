import BN from "bn.js";

export const WITHDRAW_ALL_TIMEOUT = 3 * 24 * 60 * 60;
export const INITIAL_HOUSE_STAKE = new BN((10e18).toString());
export const MIN_BANKROLL = new BN((9e18).toString());
export const MIN_STAKE = new BN((1e16).toString());
export const MAX_STAKE = new BN((200e18).toString());
export const MIN_VALUE = new BN((1e13).toString());
export const MAX_BALANCE = MIN_BANKROLL.divn(2);
export const NOT_ENDED_FINE = new BN((4e16).toString());
export const CONFLICT_END_FINE = new BN((1e16).toString());
export const SERVER_TIMEOUT = 12 * 3600;
export const USER_TIMEOUT = 48 * 3600;
export const PROFIT_TRANSFER_TIMESPAN_MIN = 24 * 60 * 60;
export const PROFIT_TRANSFER_TIMESPAN_MAX = 6 * 30 * 24 * 60 * 60;
export const PROFIT_TRANSFER_TIMESPAN = 14 * 24 * 60 * 60;
