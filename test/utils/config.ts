import BigNumber from "bignumber.js";

export const WITHDRAW_ALL_TIMEOUT = 3 * 24 * 60 * 60;
export const INITIAL_HOUSE_STAKE = new BigNumber('10e18');
export const MIN_BANKROLL = new BigNumber('8e18');
export const MIN_STAKE = new BigNumber('1e16');
export const MAX_STAKE = new BigNumber('5e17');
export const MIN_VALUE = new BigNumber('1e13');
export const MAX_BALANCE = MIN_BANKROLL.div(2);
export const NOT_ENDED_FINE = new BigNumber('1e15');
export const CONFLICT_END_FINE = new BigNumber('1e15');
export const SERVER_TIMEOUT = 6 * 3600;
export const USER_TIMEOUT = 6 * 3600;
export const PROFIT_TRANSFER_TIMESPAN_MIN = 24 * 60 * 60;
export const PROFIT_TRANSFER_TIMESPAN_MAX = 6 * 30 * 24 * 60 * 60;
export const PROFIT_TRANSFER_TIMESPAN = 14 * 24 * 60 * 60;
