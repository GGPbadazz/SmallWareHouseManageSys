import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * 出库记录Excel导出工具类（面向财务使用）
 */
export class OutboundRecordsExporter {
  constructor(currentMonth) {
    this.currentMonth = currentMonth;
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
    if (typeof val !== 'number') val = 0
    
    // 检查是否为整数
    if (val === Math.floor(val)) {
      return '¥' + val.toString()
    }
    
    // 对于小数，保持原始精度，但最多显示4位小数，移除末尾的0
    const str = val.toString()
    if (str.includes('.')) {
      // 如果原始数据有小数点，保持其精度（最多4位）
      const [integer, decimal] = str.split('.')
      const trimmedDecimal = decimal.substring(0, 4).replace(/0+$/, '')
      return trimmedDecimal ? '¥' + integer + '.' + trimmedDecimal : '¥' + integer
    }
    
    return '¥' + str
  }

  /**
   * 导出月度出库记录Excel
   */
  async exportOutboundRecords() {
    try {
      // 获取出库数据
      const outboundData = await this.fetchOutboundData();
      
      // 创建出库记录工作表
      this.createOutboundSheet(outboundData);
      
      // 保存文件
      await this.saveWorkbook();
      
    } catch (error) {
      console.error('导出出库记录失败:', error);
      throw new Error('出库记录导出失败，请重试');
    }
  }

  /**
   * 获取出库数据
   */
  async fetchOutboundData() {
    const { year, month } = this.currentMonth;
    
    try {
      const response = await fetch(`/api/ledger/outbound-records?year=${year}&month=${month}`);
      if (!response.ok) {
        throw new Error('网络请求失败');
      }
      const data = await response.json();
      return data.records || [];
    } catch (error) {
      console.error('获取出库记录失败:', error);
      throw new Error('获取出库记录失败');
    }
  }

  /**
   * 创建出库记录工作表
   */
  createOutboundSheet(outboundData) {
    const { year, month } = this.currentMonth;
    const worksheet = this.workbook.addWorksheet('出库记录');
    
        // 设置列宽
        worksheet.columns = [
          { width: 15 }, // 大类
          { width: 25 }, // 产品名称
          { width: 18 }, // 规格型号
          { width: 12 }, // 出库数量
          { width: 15 }, // 单价
          { width: 15 }, // 出库金额
          { width: 12 }, // 出库后数量
          { width: 16 }, // 出库后库存货值
          { width: 12 }, // 申请人
          { width: 20 }, // 用途
          { width: 15 }, // 部门
          { width: 15 }  // 日期
        ];    // 添加标题
    const titleRow = worksheet.addRow([`${year}年${month}月出库记录明细表`]);
    worksheet.mergeCells('A1:L1');
    titleRow.getCell(1).style = {
      font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8501A' } }, // 更深的橙色
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: this.getThickBorder()
    };
    titleRow.height = 35;

    // 空行
    worksheet.addRow([]);

    // 创建表头行
      const headerRow = worksheet.addRow([
        '大类',
        '产品名称', 
        '规格型号',
        '出库数量',
        '单价',
        '出库金额',
        '出库后数量',
        '出库后库存货值',
        '申请人',
        '用途',
        '部门',
        '日期'
      ]);
    
    headerRow.eachCell((cell, colNumber) => {
      let bgColor = 'FFFFE4B5'; // 默认浅橙色
      let fontColor = 'FF8B4513'; // 深褐色
      
      // 重点列使用高亮颜色
      if (colNumber === 9 || colNumber === 10) { // 申请人和用途
        bgColor = 'FFFFFF99'; // 黄色高亮
        fontColor = 'FF8B4513';
      }
      
      cell.style = {
        font: { bold: true, color: { argb: fontColor } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: this.getThickBorder()
      };
    });
    headerRow.height = 25;

    // 按大类分组数据
    const groupedData = this.groupDataByCategory(outboundData);
    
    // 添加数据行
    Object.keys(groupedData).forEach(categoryName => {
      const categoryProducts = groupedData[categoryName];
      
      // 大类标题行
      const categoryTitleRow = worksheet.addRow([
        `【${categoryName}】`, '', '', '', '', '', '', '', '', '', ''
      ]);
      worksheet.mergeCells(`A${categoryTitleRow.number}:K${categoryTitleRow.number}`);
      categoryTitleRow.getCell(1).style = {
        font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE67300' } }, // 更深的橙色
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: this.getThinBorder()
      };
      categoryTitleRow.height = 25;

      // 添加该大类下的所有产品出库记录
      Object.keys(categoryProducts).forEach(productName => {
        const productRecords = categoryProducts[productName];
        
        // 产品标题行
        const productTitleRow = worksheet.addRow([
          '', `${productName}`, '', '', '', '', '', '', '', '', ''
        ]);
        worksheet.mergeCells(`B${productTitleRow.number}:K${productTitleRow.number}`);
        productTitleRow.getCell(2).style = {
          font: { bold: true, size: 12, color: { argb: 'FFC8501A' } }, // 更深的橙色文字
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF7E0' } },
          alignment: { horizontal: 'left', vertical: 'middle' },
          border: this.getThinBorder()
        };

        // 添加该产品的所有出库记录（按时间排序）
        productRecords.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        productRecords.forEach(record => {
          const row = worksheet.addRow([
            '', // 大类列为空（已在标题行显示）
            record.product_name,
            record.product_barcode || '-',
            this.formatQuantity(record.quantity),
            this.formatCurrency(record.unit_price),
            this.formatCurrency(record.quantity * record.unit_price),
            this.formatQuantity(record.stock_after || 0),
            this.formatCurrency(record.stock_value || 0),
            record.requester_name || '-',
            record.purpose || '-',
            record.project_name || record.department || '-',
            new Date(record.created_at).toLocaleString('zh-CN')
          ]);

          row.eachCell((cell, colNumber) => {
            let bgColor = 'FFFFFFFF'; // 默认白色
            let fontColor = 'FF4A4A4A';
            let isBold = false;
            
            // 产品名称、出库数量、单价、出库金额 - 不弱化，保持突出
            if (colNumber === 2 || colNumber === 4 || colNumber === 5 || colNumber === 6) {
              fontColor = 'FF2D3748';
              isBold = true;
              if (colNumber === 6) { // 出库金额使用绿色
                fontColor = 'FF059669';
              }
            }
            // 库存相关列：出库后数量和出库后库存货值
            else if (colNumber === 7 || colNumber === 8) {
              bgColor = 'FFF0F8FF'; // 浅蓝色背景
              fontColor = 'FF2B6CB0';
              isBold = true;
              if (colNumber === 8) { // 出库后库存货值使用深蓝色
                fontColor = 'FF1A365D';
              }
            }
            // 重点列：申请人和用途
            else if (colNumber === 9 || colNumber === 10) {
              bgColor = 'FFFFFF99'; // 黄色高亮背景
              fontColor = 'FF8B4513';
              isBold = true;
            }
            // 日期列
            else if (colNumber === 12) {
              bgColor = 'FFE6F3FF';
              fontColor = 'FF3182CE';
            }
            
            cell.style = {
              font: { bold: isBold, color: { argb: fontColor } },
              fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
              alignment: { horizontal: 'center', vertical: 'middle' },
              border: this.getThinBorder()
            };
          });
        });

        // 产品间分隔空行
        worksheet.addRow([]);
      });
    });

    // 如果没有数据
    if (Object.keys(groupedData).length === 0) {
      const noDataRow = worksheet.addRow([
        '本月暂无出库记录', '', '', '', '', '', '', '', '', '', ''
      ]);
      worksheet.mergeCells(`A${noDataRow.number}:K${noDataRow.number}`);
      noDataRow.getCell(1).style = {
        font: { italic: true, color: { argb: 'FF999999' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: this.getThinBorder()
      };
    }
  }

  /**
   * 按大类和产品分组数据
   */
  groupDataByCategory(outboundData) {
    const grouped = {};
    
    outboundData.forEach(record => {
      const categoryName = record.category_name;
      const productName = record.product_name;
      
      if (!grouped[categoryName]) {
        grouped[categoryName] = {};
      }
      
      if (!grouped[categoryName][productName]) {
        grouped[categoryName][productName] = [];
      }
      
      grouped[categoryName][productName].push(record);
    });
    
    return grouped;
  }

  /**
   * 获取粗边框样式
   */
  getThickBorder() {
    return {
      top: { style: 'thick', color: { argb: 'FFC8501A' } }, // 更深的橙色边框
      left: { style: 'thick', color: { argb: 'FFC8501A' } },
      bottom: { style: 'thick', color: { argb: 'FFC8501A' } },
      right: { style: 'thick', color: { argb: 'FFC8501A' } }
    };
  }

  /**
   * 获取细边框样式
   */
  getThinBorder() {
    return {
      top: { style: 'thin', color: { argb: 'FFE67300' } }, // 更深的橙色边框
      left: { style: 'thin', color: { argb: 'FFE67300' } },
      bottom: { style: 'thin', color: { argb: 'FFE67300' } },
      right: { style: 'thin', color: { argb: 'FFE67300' } }
    };
  }

  /**
   * 保存工作簿文件
   */
  async saveWorkbook() {
    const { year, month } = this.currentMonth;
    const fileName = `出库记录_${year}年${month}月_${new Date().getTime()}.xlsx`;
    
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
 * 导出出库记录的便捷函数
 */
export async function exportOutboundRecordsToExcel(currentMonth) {
  const exporter = new OutboundRecordsExporter(currentMonth);
  await exporter.exportOutboundRecords();
}
