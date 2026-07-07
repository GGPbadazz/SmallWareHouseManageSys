/**
 * 前端精度计算工具类
 * 与后端保持一致的计算精度
 */

// 精度常量
const STORAGE_DECIMALS = 2;    // 数据库存储精度（总金额、库存价值）
const PRICE_DECIMALS = 4;       // 单价精度
const CALCULATION_DECIMALS = 6; // 中间计算精度
// 注意：显示时不做格式化，直接显示数据库原值（这样可以区分2位和4位的产品）

/**
 * 四舍五入到指定小数位
 */
export function round(number, decimals = CALCULATION_DECIMALS) {
  if (isNaN(number) || number === null || number === undefined) {
    return 0;
  }
  const factor = Math.pow(10, decimals);
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

/**
 * 精确加法
 */
export function add(a, b) {
  const factor = Math.pow(10, CALCULATION_DECIMALS);
  return Math.round((a * factor + b * factor)) / factor;
}

/**
 * 精确减法
 */
export function subtract(a, b) {
  const factor = Math.pow(10, CALCULATION_DECIMALS);
  return Math.round((a * factor - b * factor)) / factor;
}

/**
 * 精确乘法
 */
export function multiply(a, b) {
  const factor = Math.pow(10, CALCULATION_DECIMALS);
  return Math.round(a * b * factor) / factor;
}

/**
 * 精确除法
 */
export function divide(a, b) {
  if (b === 0 || isNaN(b)) return 0;
  const factor = Math.pow(10, CALCULATION_DECIMALS);
  return Math.round((a / b) * factor) / factor;
}

/**
 * 格式化为存储精度（2位小数）- 用于总金额、库存价值
 */
export function formatStorage(number) {
  if (isNaN(number) || number === null || number === undefined) {
    return 0;
  }
  return round(number, STORAGE_DECIMALS);
}

/**
 * 格式化单价（4位小数）
 */
export function formatPrice(number) {
  if (isNaN(number) || number === null || number === undefined) {
    return 0;
  }
  return round(number, PRICE_DECIMALS);
}

/**
 * 格式化价格显示（按实际精度显示，不强制格式化）
 * 说明：数据库是几位就显示几位，这样可以区分已转换（2位）和未转换（4位）的产品
 */
export function formatPriceDisplay(price) {
  if (typeof price !== 'number') price = parseFloat(price) || 0;
  if (price === 0) return '0';
  if (price === Math.floor(price)) return price.toString();
  // 直接返回原值，去掉末尾的0即可（不强制精度）
  return price.toString().replace(/\.?0+$/, '');
}

export default {
  round,
  add,
  subtract,
  multiply,
  divide,
  formatStorage,
  formatPrice,
  formatPriceDisplay,
  STORAGE_DECIMALS,
  PRICE_DECIMALS,
  CALCULATION_DECIMALS
};
