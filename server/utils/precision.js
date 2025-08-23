/**
 * 财务精度计算工具类
 * 存储精度：4位小数（数据库级别）
 * 计算精度：6位小数（中间计算）
 * 显示精度：4位小数（用户界面）
 */
class PrecisionCalculator {
    // 精度常量
    static STORAGE_DECIMALS = 4;    // 数据库存储精度
    static CALCULATION_DECIMALS = 6; // 中间计算精度
    static DISPLAY_DECIMALS = 4;     // 用户界面显示精度

    /**
     * 四舍五入到指定小数位
     * @param {number} number - 要处理的数字
     * @param {number} decimals - 小数位数
     * @returns {number} 处理后的数字
     */
    static round(number, decimals = this.CALCULATION_DECIMALS) {
        if (isNaN(number) || number === null || number === undefined) {
            return 0;
        }
        const factor = Math.pow(10, decimals);
        return Math.round((number + Number.EPSILON) * factor) / factor;
    }

    /**
     * 财务计算专用：加法
     * @param {number} a - 加数
     * @param {number} b - 被加数
     * @returns {number} 计算结果（6位小数精度）
     */
    static add(a, b) {
        const factor = Math.pow(10, this.CALCULATION_DECIMALS);
        return Math.round((a * factor + b * factor)) / factor;
    }

    /**
     * 财务计算专用：减法
     * @param {number} a - 被减数
     * @param {number} b - 减数
     * @returns {number} 计算结果（6位小数精度）
     */
    static subtract(a, b) {
        const factor = Math.pow(10, this.CALCULATION_DECIMALS);
        return Math.round((a * factor - b * factor)) / factor;
    }

    /**
     * 财务计算专用：乘法
     * @param {number} a - 乘数
     * @param {number} b - 被乘数
     * @returns {number} 计算结果（6位小数精度）
     */
    static multiply(a, b) {
        const factor = Math.pow(10, this.CALCULATION_DECIMALS);
        return Math.round(a * b * factor) / factor;
    }

    /**
     * 财务计算专用：除法
     * @param {number} a - 被除数
     * @param {number} b - 除数
     * @returns {number} 计算结果（6位小数精度）
     */
    static divide(a, b) {
        if (b === 0 || isNaN(b)) return 0;
        const factor = Math.pow(10, this.CALCULATION_DECIMALS);
        return Math.round((a / b) * factor) / factor;
    }

    /**
     * 显示格式化（4位小数）
     * @param {number} number - 要格式化的数字
     * @returns {string} 格式化后的字符串
     */
    static formatDisplay(number) {
        if (isNaN(number) || number === null || number === undefined) {
            return '0.0000';
        }
        return parseFloat(number).toFixed(this.DISPLAY_DECIMALS);
    }

    /**
     * 数据库存储格式化（4位小数）
     * @param {number} number - 要格式化的数字
     * @returns {number} 格式化后的数字
     */
    static formatStorage(number) {
        if (isNaN(number) || number === null || number === undefined) {
            return 0;
        }
        return this.round(number, this.STORAGE_DECIMALS);
    }

    /**
     * 中间计算格式化（6位小数）
     * @param {number} number - 要格式化的数字
     * @returns {number} 格式化后的数字
     */
    static formatCalculation(number) {
        if (isNaN(number) || number === null || number === undefined) {
            return 0;
        }
        return this.round(number, this.CALCULATION_DECIMALS);
    }

    /**
     * 加权平均价格计算
     * @param {number} currentStock - 当前库存
     * @param {number} currentStockValue - 当前库存价值（直接使用，不重新计算）
     * @param {number} incomingQuantity - 入库数量
     * @param {number} incomingUnitPrice - 入库单价
     * @returns {number} 新的加权平均单价
     */
    static calculateWeightedAveragePrice(currentStock, currentStockValue, incomingQuantity, incomingUnitPrice) {
        // 使用6位小数进行中间计算
        const currentValue = this.formatCalculation(currentStockValue);
        const incomingValue = this.multiply(incomingQuantity, incomingUnitPrice);
        const totalValue = this.add(currentValue, incomingValue);
        const totalQuantity = this.add(currentStock, incomingQuantity);
        
        if (totalQuantity === 0) {
            return 0;
        }
        
        return this.divide(totalValue, totalQuantity);
    }

    /**
     * 库存价值计算
     * @param {number} quantity - 数量
     * @param {number} unitPrice - 单价
     * @returns {number} 库存价值
     */
    static calculateStockValue(quantity, unitPrice) {
        return this.multiply(quantity, unitPrice);
    }

    /**
     * 检查两个数值是否在精度范围内相等
     * @param {number} a - 数值a
     * @param {number} b - 数值b
     * @param {number} tolerance - 容差（默认0.0001）
     * @returns {boolean} 是否相等
     */
    static isEqual(a, b, tolerance = 0.0001) {
        return Math.abs(a - b) < tolerance;
    }

    /**
     * 验证数值是否有效
     * @param {number} number - 要验证的数值
     * @returns {boolean} 是否有效
     */
    static isValidNumber(number) {
        return !isNaN(number) && number !== null && number !== undefined && isFinite(number);
    }
}

module.exports = PrecisionCalculator;
