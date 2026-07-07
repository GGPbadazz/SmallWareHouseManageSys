import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * 库存报告Excel导出工具类
 */
export class InventoryReportExporter {
  constructor(inventoryData) {
    this.inventoryData = inventoryData;
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
   * 格式化货币显示
   */
  formatCurrency(val) {
    if (typeof val !== 'number') val = 0
    return val.toFixed(2)
  }

  /**
   * 导出库存报告Excel
   */
  async exportInventoryReport() {
    try {
      // 创建库存报告工作表
      this.createInventorySheet();
      
      // 保存文件
      await this.saveWorkbook();
      
    } catch (error) {
      console.error('导出库存报告失败:', error);
      throw new Error('库存报告导出失败，请重试');
    }
  }

  /**
   * 创建库存报告工作表
   */
  createInventorySheet() {
    const currentDate = new Date();
    const worksheet = this.workbook.addWorksheet('库存报告');
    
    // 设置列宽
    worksheet.columns = [
      { width: 25 }, // 产品名称
      { width: 15 }, // 产品编码
      { width: 12 }, // 类别
      { width: 10 }, // 当前库存
      { width: 10 }, // 最小库存
      { width: 12 }, // 库存单价
      { width: 15 }, // 库存总价
      { width: 10 }, // 库存状态
      { width: 15 }  // 供应商
    ];

    // 添加标题
    const titleRow = worksheet.addRow([`库存报告 - ${currentDate.toLocaleDateString('zh-CN')}`]);
    worksheet.mergeCells('A1:I1');
    titleRow.getCell(1).style = {
      font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: this.getThickBorder()
    };
    titleRow.height = 30;

    // 空行
    worksheet.addRow([]);

    // 统计信息
    const totalProducts = this.inventoryData.length;
    const totalStockValue = this.inventoryData.reduce((sum, product) => sum + (product.total_cost_value || 0), 0);
    const lowStockCount = this.inventoryData.filter(product => product.stock <= product.min_stock && product.stock > 0).length;
    const outOfStockCount = this.inventoryData.filter(product => product.stock === 0).length;

    // 汇总信息标题
    const summaryTitleRow = worksheet.addRow(['汇总信息']);
    worksheet.mergeCells(`A${summaryTitleRow.number}:I${summaryTitleRow.number}`);
    summaryTitleRow.getCell(1).style = {
      font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF548235' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: this.getThinBorder()
    };

    // 汇总信息数据
    const summaryData = [
      ['总产品数', `${totalProducts}个`],
      ['库存总价值', `¥${this.formatCurrency(totalStockValue)}`],
      ['低库存产品', `${lowStockCount}个`],
      ['缺货产品', `${outOfStockCount}个`],
      ['报告生成时间', currentDate.toLocaleString('zh-CN')]
    ];

    summaryData.forEach(data => {
      const row = worksheet.addRow(data);
      row.getCell(1).style = {
        font: { bold: true, color: { argb: 'FF1F4E79' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7F1FF' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: this.getThinBorder()
      };
      row.getCell(2).style = {
        font: { color: { argb: 'FF2C5282' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F8FF' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: this.getThinBorder()
      };
    });

    // 空行
    worksheet.addRow([]);

    // 详细数据标题
    const detailTitleRow = worksheet.addRow(['详细库存信息']);
    worksheet.mergeCells(`A${detailTitleRow.number}:I${detailTitleRow.number}`);
    detailTitleRow.getCell(1).style = {
      font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF548235' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: this.getThinBorder()
    };

    // 表头
    const headerRow = worksheet.addRow([
      '产品名称', '产品编码', '类别', '当前库存', '最小库存', 
      '库存单价', '库存总价', '库存状态', '供应商'
    ]);
    headerRow.eachCell(cell => {
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: this.getThickBorder()
      };
    });

    // 添加产品数据
    this.inventoryData.forEach(product => {
      const unitPrice = product.current_unit_price || product.price || 0;
      const totalValue = product.total_cost_value || 0;
      const stock = product.stock || 0;
      const minStock = product.min_stock || 0;
      
      let status = '正常';
      if (stock === 0) {
        status = '缺货';
      } else if (stock <= minStock) {
        status = '低库存';
      }
      
      const row = worksheet.addRow([
        product.name || '-',
        product.barcode || '-',
        product.category_name || '-',
        parseFloat(this.formatQuantity(stock)),
        parseFloat(this.formatQuantity(minStock)),
        unitPrice,
        totalValue,
        status,
        product.supplier || '-'
      ]);

      row.eachCell((cell, colNumber) => {
        let bgColor = 'FFFAFBFC'; // 默认浅灰色
        let fontColor = 'FF000000';
        let isBold = false;
        
        // 根据库存状态设置行颜色
        if (status === '缺货') {
          if (colNumber === 8) { // 库存状态列
            bgColor = 'FFFFEBEE';
            fontColor = 'FFC62828';
            isBold = true;
          } else {
            bgColor = 'FFFEF2F2';
          }
        } else if (status === '低库存') {
          if (colNumber === 8) { // 库存状态列
            bgColor = 'FFFFECB3';
            fontColor = 'FFE65100';
            isBold = true;
          } else {
            bgColor = 'FFFFFEF7';
          }
        } else if (colNumber === 8) { // 正常状态
          bgColor = 'FFE8F5E8';
          fontColor = 'FF0A5A2A';
          isBold = true;
        }
        
        // 金额列特殊处理
        if (colNumber === 6 || colNumber === 7) { // 单价和总价列
          cell.numFmt = '¥0.00';
          if (status === '正常') {
            bgColor = 'FFE8F5E8';
            fontColor = 'FF0A5A2A';
            isBold = true;
          }
        }
        
        // 数量列
        if (colNumber === 4 || colNumber === 5) {
          cell.numFmt = '0.000';
        }
        
        cell.style = {
          font: { bold: isBold, color: { argb: fontColor } },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: this.getThinBorder()
        };
      });
    });

    // 设置行高
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // 除了标题行
        row.height = 20;
      }
    });
  }

  /**
   * 获取粗边框样式
   */
  getThickBorder() {
    return {
      top: { style: 'thick', color: { argb: 'FF000000' } },
      left: { style: 'thick', color: { argb: 'FF000000' } },
      bottom: { style: 'thick', color: { argb: 'FF000000' } },
      right: { style: 'thick', color: { argb: 'FF000000' } }
    };
  }

  /**
   * 获取细边框样式
   */
  getThinBorder() {
    return {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };
  }

  /**
   * 保存工作簿文件
   */
  async saveWorkbook() {
    const currentDate = new Date();
    const fileName = `库存报告_${currentDate.toISOString().split('T')[0]}_${Date.now()}.xlsx`;
    
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
 * 导出库存报告Excel的便捷函数
 */
export async function exportInventoryToExcel(inventoryData) {
  const exporter = new InventoryReportExporter(inventoryData);
  await exporter.exportInventoryReport();
}
