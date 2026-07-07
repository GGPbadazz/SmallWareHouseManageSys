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
   * 格式化单号显示 - 只显示后7位数字
   * 例如：R2644240-2601_cancelled_20260106135848 -> 2644240
   */
  formatDocumentNumber(documentNumber) {
    if (!documentNumber || documentNumber === '-') return '-';
    // 匹配字母后面的7位数字
    const match = documentNumber.match(/[A-Z]+(\d{7})/);
    return match ? match[1] : documentNumber;
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
    // 显示精度：2位小数，财务标准
    return '¥' + val.toFixed(2)
  }

  /**
   * 原始数据格式 - Excel导出使用数据库原始值，不进行四舍五入
   */
  formatRawValue(val) {
    if (typeof val !== 'number') val = 0
    // 直接返回数据库原始数值，保持最高精度
    return val
  }

  /**
   * 导出月度出库记录Excel
   */
  async exportOutboundRecords() {
    try {
      // 获取入库和出库数据
      const [inboundData, outboundData] = await Promise.all([
        this.fetchInboundData(),
        this.fetchOutboundData()
      ]);
      
      // 创建入库记录工作表
      this.createInboundSheet(inboundData);
      
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
   * 获取入库数据
   */
  async fetchInboundData() {
    const { year, month } = this.currentMonth;
    
    try {
      const response = await fetch(`/api/ledger/inbound-records?year=${year}&month=${month}`);
      if (!response.ok) {
        throw new Error('网络请求失败');
      }
      const data = await response.json();
      return data.records || [];
    } catch (error) {
      console.error('获取入库记录失败:', error);
      throw new Error('获取入库记录失败');
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
          { width: 18 }, // 单号
          { width: 12 }, // 申请人
          { width: 20 }, // 用途
          { width: 15 }, // 部门
          { width: 15 }  // 日期
        ];    // 添加标题
    const titleRow = worksheet.addRow([`${year}年${month}月出库记录明细表`]);
    worksheet.mergeCells('A1:M1');
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
        '单号',
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
      
      // 重点列使用高亮颜色（单号、申请人、用途）
      if (colNumber === 3 || colNumber === 10 || colNumber === 11) {
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

    // 按大类和时间排序所有出库记录
    outboundData.sort((a, b) => {
      // 先按大类名称排序
      if (a.category_name !== b.category_name) {
        return a.category_name.localeCompare(b.category_name, 'zh-CN');
      }
      // 同大类内按时间排序
      return new Date(a.created_at) - new Date(b.created_at);
    });
    
    // 直接添加所有出库记录，无分组标题
    outboundData.forEach(record => {
      const row = worksheet.addRow([
        record.category_name,  // 大类直接作为数据列，不合并单元格
        record.product_name,
        this.formatDocumentNumber(record.document_number),
        record.product_barcode || '-',
        this.formatQuantity(record.quantity),
        this.formatRawValue(record.unit_price),
        this.formatRawValue(record.total_price || 0),
        this.formatQuantity(record.stock_after || 0),
        this.formatRawValue(record.stock_value || 0),
        record.requester_name || '-',
        record.purpose || '-',
        record.project_name || record.department || '-',
        new Date(record.created_at).toLocaleString('zh-CN')
      ]);

      row.eachCell((cell, colNumber) => {
        let bgColor = 'FFFFFFFF'; // 默认白色
        let fontColor = 'FF4A4A4A';
        let isBold = false;
        
        // 大类名称列
        if (colNumber === 1) {
          fontColor = 'FF2D3748';
          isBold = true;
          bgColor = 'FFF8F9FA'; // 浅灰色背景
        }
        // 产品名称、单号、出库数量、单价、出库金额 - 不弱化，保持突出
        else if (colNumber === 2 || colNumber === 3 || colNumber === 5 || colNumber === 6 || colNumber === 7) {
          fontColor = 'FF2D3748';
          isBold = true;
          if (colNumber === 7) { // 出库金额使用绿色
            fontColor = 'FF059669';
          }
        }
        // 库存相关列：出库后数量和出库后库存货值
        else if (colNumber === 8 || colNumber === 9) {
          bgColor = 'FFF0F8FF'; // 浅蓝色背景
          fontColor = 'FF2B6CB0';
          isBold = true;
          if (colNumber === 9) { // 出库后库存货值使用深蓝色
            fontColor = 'FF1A365D';
          }
        }
        // 重点列：申请人和用途
        else if (colNumber === 10 || colNumber === 11) {
          bgColor = 'FFFFFF99'; // 黄色高亮背景
          fontColor = 'FF8B4513';
          isBold = true;
        }
        // 日期列
        else if (colNumber === 13) {
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

    // 如果没有数据
    if (outboundData.length === 0) {
      const noDataRow = worksheet.addRow([
        '本月暂无出库记录', '', '', '', '', '', '', '', '', '', ''
      ]);
      worksheet.mergeCells(`A${noDataRow.number}:L${noDataRow.number}`);
      noDataRow.getCell(1).style = {
        font: { italic: true, color: { argb: 'FF999999' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: this.getThinBorder()
      };
    }
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
   * 创建入库记录工作表
   */
  createInboundSheet(inboundData) {
    const { year, month } = this.currentMonth;
    const worksheet = this.workbook.addWorksheet('入库记录');
    
    // 设置列宽
    worksheet.columns = [
      { width: 15 }, // 大类
      { width: 25 }, // 产品名称
      { width: 18 }, // 规格型号
      { width: 12 }, // 入库数量
      { width: 15 }, // 单价
      { width: 15 }, // 入库金额
      { width: 12 }, // 入库后数量
      { width: 16 }, // 入库后库存货值
      { width: 18 }, // 单号
      { width: 20 }, // 项目
      { width: 20 }, // 供应商
      { width: 15 }  // 日期
    ];

    // 添加标题
    const titleRow = worksheet.addRow([`${year}年${month}月入库记录明细表`]);
    worksheet.mergeCells('A1:L1');
    titleRow.getCell(1).style = {
      font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } }, // 深绿色
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: this.getInboundThickBorder()
    };
    titleRow.height = 35;

    // 空行
    worksheet.addRow([]);

    // 创建表头行
    const headerRow = worksheet.addRow([
      '大类',
      '产品名称',
      '单号',
      '规格型号',
      '入库数量',
      '单价',
      '入库金额',
      '入库后数量',
      '入库后库存货值',
      '项目',
      '供应商',
      '日期'
    ]);
    
    headerRow.eachCell((cell, colNumber) => {
      let bgColor = 'FFE8F5E9'; // 浅绿色
      let fontColor = 'FF2E7D32'; // 深绿色
      
      // 重点列使用高亮颜色（单号、供应商）
      if (colNumber === 3 || colNumber === 11) {
        bgColor = 'FFFFECB3'; // 浅黄色高亮
        fontColor = 'FFF57C00';
      }
      
      cell.style = {
        font: { bold: true, color: { argb: fontColor } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: this.getInboundThickBorder()
      };
    });
    headerRow.height = 25;

    // 按大类和时间排序所有入库记录
    inboundData.sort((a, b) => {
      // 先按大类名称排序
      if (a.category_name !== b.category_name) {
        return a.category_name.localeCompare(b.category_name, 'zh-CN');
      }
      // 同大类内按时间排序
      return new Date(a.created_at) - new Date(b.created_at);
    });
    
    // 直接添加所有入库记录
    inboundData.forEach(record => {
      const row = worksheet.addRow([
        record.category_name,
        record.product_name,
        this.formatDocumentNumber(record.document_number),
        record.product_barcode || '-',
        this.formatQuantity(record.quantity),
        this.formatRawValue(record.unit_price),
        this.formatRawValue(record.total_price || 0),
        this.formatQuantity(record.stock_after || 0),
        this.formatRawValue(record.stock_value || 0),
        record.project_name || '-',
        record.supplier || '-',
        new Date(record.created_at).toLocaleString('zh-CN')
      ]);

      row.eachCell((cell, colNumber) => {
        let bgColor = 'FFFFFFFF'; // 默认白色
        let fontColor = 'FF4A4A4A';
        let isBold = false;
        
        // 大类名称列
        if (colNumber === 1) {
          fontColor = 'FF2D3748';
          isBold = true;
          bgColor = 'FFF8F9FA'; // 浅灰色背景
        }
        // 产品名称、单号、入库数量、单价、入库金额
        else if (colNumber === 2 || colNumber === 3 || colNumber === 5 || colNumber === 6 || colNumber === 7) {
          fontColor = 'FF2D3748';
          isBold = true;
          if (colNumber === 7) { // 入库金额使用绿色
            fontColor = 'FF2E7D32';
          }
        }
        // 库存相关列
        else if (colNumber === 8 || colNumber === 9) {
          bgColor = 'FFF0F8FF'; // 浅蓝色背景
          fontColor = 'FF2B6CB0';
          isBold = true;
          if (colNumber === 9) {
            fontColor = 'FF1A365D';
          }
        }
        // 重点列：供应商（单号已包含在上面）
        else if (colNumber === 11) {
          bgColor = 'FFFFECB3'; // 浅黄色高亮背景
          fontColor = 'FFF57C00';
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
          border: this.getInboundThinBorder()
        };
      });
    });

    // 如果没有数据
    if (inboundData.length === 0) {
      const noDataRow = worksheet.addRow([
        '本月暂无入库记录', '', '', '', '', '', '', '', '', '', ''
      ]);
      worksheet.mergeCells(`A${noDataRow.number}:L${noDataRow.number}`);
      noDataRow.getCell(1).style = {
        font: { italic: true, color: { argb: 'FF999999' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: this.getInboundThinBorder()
      };
    }
  }

  /**
   * 获取入库记录粗边框样式
   */
  getInboundThickBorder() {
    return {
      top: { style: 'thick', color: { argb: 'FF2E7D32' } }, // 深绿色
      left: { style: 'thick', color: { argb: 'FF2E7D32' } },
      bottom: { style: 'thick', color: { argb: 'FF2E7D32' } },
      right: { style: 'thick', color: { argb: 'FF2E7D32' } }
    };
  }

  /**
   * 获取入库记录细边框样式
   */
  getInboundThinBorder() {
    return {
      top: { style: 'thin', color: { argb: 'FF66BB6A' } }, // 绿色
      left: { style: 'thin', color: { argb: 'FF66BB6A' } },
      bottom: { style: 'thin', color: { argb: 'FF66BB6A' } },
      right: { style: 'thin', color: { argb: 'FF66BB6A' } }
    };
  }

  /**
   * 保存工作簿文件
   */
  async saveWorkbook() {
    const { year, month } = this.currentMonth;
    const fileName = `出入库记录_${year}年${month}月_${new Date().getTime()}.xlsx`;
    
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
