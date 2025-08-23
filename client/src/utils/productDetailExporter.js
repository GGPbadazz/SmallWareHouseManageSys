import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * 产品出入库明细Excel导出工具类
 */
export class ProductDetailExporter {
  constructor(product, transactions, period) {
    this.product = product;
    this.transactions = transactions;
    this.period = period;
    this.workbook = new ExcelJS.Workbook();
    
    // 设置工作簿属性
    this.workbook.creator = '库存管理系统';
    this.workbook.lastModifiedBy = '库存管理系统';
    this.workbook.created = new Date();
    this.workbook.modified = new Date();
  }

  /**
   * 格式化数量显示
   */
  formatQuantity(quantity) {
    if (quantity === null || quantity === undefined) return '0'
    const num = Number(quantity)
    if (isNaN(num)) return '0'
    
    // 如果是整数，显示为整数
    if (num === Math.floor(num)) {
      return num.toString()
    }
    
    // 如果是小数，最多显示3位小数，但移除末尾的0
    return num.toFixed(3).replace(/\.?0+$/, '')
  }

  /**
   * 格式化货币显示 - 与前端formatCurrency保持一致
   */
  formatCurrency(val) {
    if (val === null || val === undefined) return '¥0';
    const num = Number(val);
    if (isNaN(num)) return '¥0';
    
    // 如果是整数，显示为整数
    if (num === Math.floor(num)) {
      return `¥${num}`;
    }
    
    // 如果是小数，最多显示4位小数，但移除末尾的0
    return `¥${num.toFixed(4).replace(/\.?0+$/, '')}`;
  }

  /**
   * 导出产品出入库明细Excel
   */
  async exportProductDetail() {
    try {
      // 创建产品明细工作表
      this.createProductDetailSheet();
      
      // 保存文件
      await this.saveWorkbook();
      
    } catch (error) {
      console.error('导出产品明细失败:', error);
      throw new Error('产品明细导出失败，请重试');
    }
  }

  /**
   * 创建产品明细工作表
   */
  createProductDetailSheet() {
    const worksheet = this.workbook.addWorksheet('产品出入库明细');
    
    // 设置列宽
    worksheet.columns = [
      { width: 12 }, // 序号
      { width: 10 }, // 类型
      { width: 18 }, // 操作时间
      { width: 12 }, // 数量
      { width: 12 }, // 出入库单价
      { width: 14 }, // 出入库总价
      { width: 12 }, // 领料人
      { width: 18 }, // 领用单位/部门
      { width: 20 }, // 用途说明
      { width: 12 }, // 出入库后库存
      { width: 12 }, // 库存单价
      { width: 14 }  // 库存价值
    ];

    // 添加标题
    const titleRow = worksheet.addRow([`${this.product.name} - 出入库明细表`]);
    worksheet.mergeCells('A1:L1');
    titleRow.getCell(1).style = {
      font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3182CE' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: this.getThickBorder()
    };
    titleRow.height = 35;

    // 产品信息行
    const productInfoRow = worksheet.addRow([
      `产品信息: ${this.product.name}`,
      '', '', '', '', '', '', '', '', '', '', ''
    ]);
    worksheet.mergeCells('A2:L2');
    productInfoRow.getCell(1).style = {
      font: { bold: true, size: 12, color: { argb: 'FF4A5568' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: this.getThinBorder()
    };

    // 统计信息行
    const statsRow = worksheet.addRow([
      `统计期间: ${this.period} | 条码: ${this.product.barcode || '-'} | 类别: ${this.product.category_name || '-'} | 当前库存: ${this.formatQuantity(this.product.current_stock)} | 库存单价: ${this.formatCurrency(this.product.current_unit_price || 0).replace('¥', '')} | 库存价值: ${this.formatCurrency(this.product.total_cost_value || 0).replace('¥', '')}`,
      '', '', '', '', '', '', '', '', '', '', ''
    ]);
    worksheet.mergeCells('A3:L3');
    statsRow.getCell(1).style = {
      font: { size: 10, color: { argb: 'FF718096' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: this.getThinBorder()
    };

    // 空行
    worksheet.addRow([]);

    // 创建表头行
    const headerRow = worksheet.addRow([
      '序号',
      '类型',
      '操作时间',
      '数量',
      '出入库单价',
      '出入库总价',
      '领料人',
      '领用单位/部门',
      '用途说明',
      '出入库后库存',
      '库存单价',
      '库存价值'
    ]);

    headerRow.eachCell((cell, colNumber) => {
      let bgColor = 'FFE2E8F0'; // 默认灰色
      let fontColor = 'FF4A5568';
      
      // 交易相关列使用蓝色
      if (colNumber >= 3 && colNumber <= 6) {
        bgColor = 'FFBEE3F8'; // 蓝色
        fontColor = 'FF2D3748';
      }
      // 库存相关列使用绿色
      else if (colNumber >= 10 && colNumber <= 12) {
        bgColor = 'FFC6F6D5'; // 绿色
        fontColor = 'FF22543D';
      }
      
      cell.style = {
        font: { bold: true, color: { argb: fontColor } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: this.getThickBorder()
      };
    });
    headerRow.height = 25;

    // 添加数据行
    this.transactions.forEach((transaction, index) => {
      const row = worksheet.addRow([
        index + 1,
        transaction.type === 'IN' ? '入库' : '出库',
        this.formatDateTime(transaction.created_at),
        this.formatQuantity(transaction.quantity),
        this.formatCurrency(transaction.unit_price || 0),
        this.formatCurrency(transaction.total_price || 0),
        transaction.requester_name || '-',
        transaction.project_name || '-',
        transaction.purpose || '-',
        this.formatQuantity(transaction.stock_after || 0),
        this.formatCurrency(transaction.stock_unit_price || 0),
        this.formatCurrency(transaction.stock_value || 0)
      ]);

      row.eachCell((cell, colNumber) => {
        let bgColor = 'FFFFFFFF'; // 默认白色
        let fontColor = 'FF4A5568';
        let isBold = false;
        
        // 序号列
        if (colNumber === 1) {
          bgColor = 'FFF7FAFC';
          fontColor = 'FF718096';
        }
        // 类型列
        else if (colNumber === 2) {
          if (transaction.type === 'IN') {
            bgColor = 'FFC6F6D5'; // 入库绿色
            fontColor = 'FF22543D';
          } else {
            bgColor = 'FFFED7D7'; // 出库红色
            fontColor = 'FF742A2A';
          }
          isBold = true;
        }
        // 金额相关列
        else if (colNumber === 5 || colNumber === 6 || colNumber === 12) {
          isBold = true;
          if (colNumber === 6) { // 出入库总价
            fontColor = 'FF3182CE';
          } else if (colNumber === 12) { // 库存价值
            fontColor = 'FF059669';
          }
        }
        // 库存数量列
        else if (colNumber === 10) {
          if ((transaction.stock_after || 0) <= 5) {
            fontColor = 'FFE53E3E'; // 低库存警告
            isBold = true;
          }
        }
        
        cell.style = {
          font: { bold: isBold, color: { argb: fontColor } },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: this.getThinBorder()
        };
      });
      row.height = 22;
    });

    // 添加汇总行
    if (this.transactions.length > 0) {
      // 空行
      worksheet.addRow([]);
      
      // 计算汇总数据
      const inboundCount = this.transactions.filter(t => t.type === 'IN').length;
      const outboundCount = this.transactions.filter(t => t.type === 'OUT').length;
      const totalInbound = this.transactions
        .filter(t => t.type === 'IN')
        .reduce((sum, t) => sum + (t.quantity || 0), 0);
      const totalOutbound = this.transactions
        .filter(t => t.type === 'OUT')
        .reduce((sum, t) => sum + (t.quantity || 0), 0);
      const totalInboundValue = this.transactions
        .filter(t => t.type === 'IN')
        .reduce((sum, t) => sum + (t.total_price || 0), 0);
      const totalOutboundValue = this.transactions
        .filter(t => t.type === 'OUT')
        .reduce((sum, t) => sum + (t.total_price || 0), 0);

      const summaryRow = worksheet.addRow([
        '汇总统计',
        `${this.transactions.length} 笔交易`,
        `入库 ${inboundCount} 笔`,
        `出库 ${outboundCount} 笔`,
        `入库量: ${this.formatQuantity(totalInbound)}`,
        `出库量: ${this.formatQuantity(totalOutbound)}`,
        `入库金额: ${this.formatCurrency(totalInboundValue).replace('¥', '')}`,
        `出库金额: ${this.formatCurrency(totalOutboundValue).replace('¥', '')}`,
        '', '', '', ''
      ]);
      
      summaryRow.eachCell((cell, colNumber) => {
        if (colNumber <= 8) {
          cell.style = {
            font: { bold: true, color: { argb: 'FF2D3748' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF7E0' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: this.getThickBorder()
          };
        }
      });
      summaryRow.height = 25;
    }

    // 添加生成信息
    const footerRow = worksheet.addRow([
      `报表生成时间: ${new Date().toLocaleString('zh-CN')}`,
      '', '', '', '', '', '', '', '', '', '', ''
    ]);
    worksheet.mergeCells(`A${footerRow.number}:L${footerRow.number}`);
    footerRow.getCell(1).style = {
      font: { size: 10, color: { argb: 'FF718096' }, italic: true },
      alignment: { horizontal: 'right', vertical: 'middle' }
    };
  }

  /**
   * 格式化日期时间
   */
  formatDateTime(dateTime) {
    if (!dateTime) return '-';
    return new Date(dateTime).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 获取粗边框样式
   */
  getThickBorder() {
    return {
      top: { style: 'thick', color: { argb: 'FF4A5568' } },
      left: { style: 'thick', color: { argb: 'FF4A5568' } },
      bottom: { style: 'thick', color: { argb: 'FF4A5568' } },
      right: { style: 'thick', color: { argb: 'FF4A5568' } }
    };
  }

  /**
   * 获取细边框样式
   */
  getThinBorder() {
    return {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
  }

  /**
   * 保存工作簿文件
   */
  async saveWorkbook() {
    const fileName = `${this.product.name}_出入库明细_${this.period.replace(/年|月|日|\s|-/g, '')}_${new Date().getTime()}.xlsx`;
    
    // 生成Excel缓冲区
    const buffer = await this.workbook.xlsx.writeBuffer();
    
    // 创建Blob并保存
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    saveAs(blob, fileName);
  }
}

/**
 * 导出产品出入库明细的便捷函数
 */
export async function exportProductDetailToExcel(product, transactions, period) {
  const exporter = new ProductDetailExporter(product, transactions, period);
  await exporter.exportProductDetail();
}
