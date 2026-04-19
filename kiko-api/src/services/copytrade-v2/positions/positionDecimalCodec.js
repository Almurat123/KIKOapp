"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canStoreDecimal3818 = canStoreDecimal3818;
exports.encodePositionTokenAmount = encodePositionTokenAmount;
var MAX_DECIMAL_38_18_INTEGER_DIGITS = 20;
var MAX_DECIMAL_38_18_FRACTION_DIGITS = 18;
function normalizeDecimalString(value) {
    if (value === null || value === undefined)
        return null;
    var trimmed = String(value).trim();
    if (!trimmed)
        return null;
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(trimmed))
        return null;
    var negative = trimmed.startsWith('-');
    var unsigned = negative || trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
    var _a = unsigned.split('.'), integerRaw = _a[0], _b = _a[1], fractionRaw = _b === void 0 ? '' : _b;
    var integerPart = integerRaw.replace(/^0+(?=\d)/, '') || '0';
    var fractionPart = fractionRaw.replace(/0+$/, '');
    var normalized = fractionPart ? "".concat(integerPart, ".").concat(fractionPart) : integerPart;
    if (normalized === '0')
        return '0';
    return negative ? "-".concat(normalized) : normalized;
}
function canStoreDecimal3818(value) {
    var normalized = normalizeDecimalString(value);
    if (!normalized)
        return false;
    var unsigned = normalized.startsWith('-') ? normalized.slice(1) : normalized;
    var _a = unsigned.split('.'), integerPart = _a[0], _b = _a[1], fractionPart = _b === void 0 ? '' : _b;
    if (integerPart.length >= MAX_DECIMAL_38_18_INTEGER_DIGITS)
        return false;
    if (fractionPart.length > MAX_DECIMAL_38_18_FRACTION_DIGITS)
        return false;
    return true;
}
function encodePositionTokenAmount(params) {
    var exactAmount = normalizeDecimalString(params.exactAmount);
    if (!exactAmount) {
        return { reasonCode: 'POSITION_AMOUNT_UNAVAILABLE' };
    }
    if (canStoreDecimal3818(exactAmount)) {
        return {
            exactAmount: exactAmount,
            decimalAmount: exactAmount,
            reasonCode: 'POSITION_DECIMAL_SAFE',
        };
    }
    return {
        exactAmount: exactAmount,
        reasonCode: 'POSITION_DECIMAL_OVERFLOW_PREVENTED',
    };
}
