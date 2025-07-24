import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * 使用ExcelJS的月度账本Excel导出工具类（支持完整样式）
 */
export class LedgerExcelExporterV2 {
  constructor(ledgerData, currentMonth) {
    this.ledgerData = ledgerData;
    this.currentMonth = currentMonth;
    this.workbook = new ExcelJS.Workbook();
    
    // 设置工作簿属性
    this.workbook.creator = '库存管理系统';
    this.workbook.lastModifiedBy = '库存管理系统';
    this.workbook.created = new Date();
    this.workbook.modified = new Date();
  }

  /**
   * 导出完整的月度账本Excel
   */
  async exportLedger() {
    try {
      // 创建汇总工作表
      this.createSummarySheet();
      
      // 为每个有交易的类别创建单独工作表
      await this.createCategorySheets();
      
      // 保存文件
      await this.saveWorkbook();
      
    } catch (error) {
      console.error('导出Excel失败:', error);
      throw new Error('Excel导出失败，请重试');
    }
  }

  /**
   * 创建汇总工作表
   */
  createSummarySheet() {
    const { categories, summary } = this.ledgerData;
    const { year, month } = this.currentMonth;
    
    const worksheet = this.workbook.addWorksheet('月度汇总');
    
    // 设置列宽
    worksheet.columns = [
      { width: 20 }, // 类别名称
      { width: 12 }, // 产品总数
      { width: 12 }, // 交易产品数
      { width: 15 }, // 本月交易总额
      { width: 15 }, // 类别库存价值
      { width: 15 }  // 状态
    ];

    // 添加标题
    const titleRow = worksheet.addRow([`月度账本汇总报表 - ${year}年${month}月`]);
    worksheet.mergeCells('A1:F1');
    titleRow.getCell(1).style = {
      font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: this.getThickBorder()
    };
    titleRow.height = 30;

    // 空行
    worksheet.addRow([]);

    // 汇总信息标题
    const summaryTitleRow = worksheet.addRow(['汇总信息']);
    worksheet.mergeCells(`A${summaryTitleRow.number}:F${summaryTitleRow.number}`);
    summaryTitleRow.getCell(1).style = {
      font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF548235' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: this.getThinBorder()
    };

    // 汇总信息数据
    const summaryData = [
      ['统计期间', `${year}年${month}月1日 - ${year}年${month}月${new Date(year, month, 0).getDate()}日`],
      ['总出入库金额', `¥${summary.total_transaction_amount.toFixed(2)}`],
      ['期末货值', `¥${summary.total_stock_value.toFixed(2)}`],
      ['涉及类别', `${summary.total_categories}个`],
      ['涉及产品', `${summary.total_products}个`]
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

    // 类别明细标题
    const categoryTitleRow = worksheet.addRow(['类别明细']);
    worksheet.mergeCells(`A${categoryTitleRow.number}:F${categoryTitleRow.number}`);
    categoryTitleRow.getCell(1).style = {
      font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF548235' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: this.getThinBorder()
    };

    // 表头
    const headerRow = worksheet.addRow(['类别名称', '产品总数', '交易产品数', '本月交易总额', '类别库存价值', '状态']);
    headerRow.eachCell(cell => {
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: this.getThickBorder()
      };
    });

    // 添加类别数据
    categories.forEach(category => {
      const status = category.products.length > 0 ? '有交易' : 
                    category.category_stock_value > 0 ? '无交易有库存' : '无交易无库存';
      
      const row = worksheet.addRow([
        category.name,
        category.total_products_count,
        category.products.length,
        `¥${category.total_amount.toFixed(2)}`,
        `¥${category.category_stock_value.toFixed(2)}`,
        status
      ]);

      row.eachCell((cell, colNumber) => {
        if (colNumber === 6) { // 状态列
          let bgColor = 'FFF8F9FA';
          let fontColor = 'FF495057';
          
          if (status === '有交易') {
            bgColor = 'FFD1E7DD';
            fontColor = 'FF0A3622';
          } else if (status === '无交易有库存') {
            bgColor = 'FFFFF3CD';
            fontColor = 'FF664D03';
          } else if (status === '无交易无库存') {
            bgColor = 'FFF8D7DA';
            fontColor = 'FF58151C';
          }
          
          cell.style = {
            font: { bold: true, color: { argb: fontColor } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: this.getThinBorder()
          };
        } else if (colNumber === 4 || colNumber === 5) { // 金额列
          cell.style = {
            font: { color: { argb: 'FF0A5A2A' }, bold: true },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: this.getThinBorder()
          };
        } else {
          cell.style = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFBFC' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: this.getThinBorder()
          };
        }
      });
    });
  }

  /**
   * 为每个有交易的类别创建单独工作表
   */
  async createCategorySheets() {
    const categoriesWithTransactions = this.ledgerData.categories.filter(cat => cat.products.length > 0);
    
    for (const category of categoriesWithTransactions) {
      await this.createCategoryDetailSheet(category);
    }
  }

  /**
   * 创建单个类别的详细工作表
   */
  async createCategoryDetailSheet(category) {
    const { year, month } = this.currentMonth;
    
    // 限制工作表名称长度
    const sheetName = category.name.length > 25 ? category.name.substring(0, 25) + '...' : category.name;
    const worksheet = this.workbook.addWorksheet(sheetName);
    
    // 设置列宽
    worksheet.columns = [
      { width: 15 }, { width: 18 }, { width: 12 }, { width: 15 }, { width: 12 },
      { width: 15 }, { width: 12 }, { width: 12 }, { width: 15 }, { width: 12 }, { width: 15 }
    ];

    // 类别标题
    const titleRow = worksheet.addRow([
      `${category.name} (${category.total_products_count}个产品，出入库总次数: ${category.products.reduce((sum, p) => sum + p.transaction_count, 0)}，出入库总额: ¥${category.total_amount.toFixed(2)}，仓库货值: ¥${category.category_stock_value.toFixed(2)})`
    ]);
    worksheet.mergeCells(`A${titleRow.number}:K${titleRow.number}`);
    titleRow.getCell(1).style = {
      font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: this.getThickBorder()
    };
    titleRow.height = 25;

    // 空行
    worksheet.addRow([]);

    // 为该类别的每个产品添加详细信息
    for (const product of category.products) {
      // 产品表头
      const headerRow = worksheet.addRow([
        '产品名称', '条码', '出入库次数', '库存总价值变化', '初期库存', '初期库存价值', 
        '期末库存', '期末单价', '期末库存价值', '操作'
      ]);
      
      headerRow.eachCell((cell, colNumber) => {
        let bgColor = 'FF548235'; // 默认绿色
        
        // 期初库存列使用蓝色
        if (colNumber === 5 || colNumber === 6) {
          bgColor = 'FFB4C6E7';
          cell.style = {
            font: { bold: true, color: { argb: 'FF1F4E79' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: this.getThinBorder()
          };
        }
        // 期末库存列使用绿色
        else if (colNumber === 7 || colNumber === 8 || colNumber === 9) {
          bgColor = 'FFC5E0B4';
          cell.style = {
            font: { bold: true, color: { argb: 'FF385723' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: this.getThinBorder()
          };
        }
        else {
          cell.style = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: this.getThinBorder()
          };
        }
      });
      
      // 产品数据行
      const dataRow = worksheet.addRow([
        product.name,
        product.barcode || '',
        product.transaction_count,
        `¥${product.total_amount.toFixed(2)}`,
        product.beginning_stock || 0,
        `¥${(product.beginning_stock_value || 0).toFixed(2)}`,
        product.ending_stock,
        `¥${product.ending_unit_price.toFixed(2)}`,
        `¥${product.ending_stock_value.toFixed(2)}`,
        '查看详情'
      ]);
      
      dataRow.eachCell((cell, colNumber) => {
        let bgColor = 'FFF2F2F2'; // 默认浅灰色
        
        if (colNumber === 5 || colNumber === 6) { // 期初库存列
          bgColor = 'FFE1EFFF';
          cell.style = {
            font: { color: { argb: 'FF1F4E79' }, bold: true },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: this.getThinBorder()
          };
        } else if (colNumber === 7 || colNumber === 8 || colNumber === 9) { // 期末库存列
          bgColor = 'FFE2EFDA';
          cell.style = {
            font: { color: { argb: 'FF385723' }, bold: true },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: this.getThinBorder()
          };
        } else {
          cell.style = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: this.getThinBorder()
          };
        }
      });
      
      // 空行
      worksheet.addRow([]);
      
      // 交易记录标题
      const transactionTitleRow = worksheet.addRow(['出入库记录']);
      worksheet.mergeCells(`A${transactionTitleRow.number}:K${transactionTitleRow.number}`);
      transactionTitleRow.getCell(1).style = {
        font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC65911' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: this.getThinBorder()
      };
      
      // 空行
      worksheet.addRow([]);
      
      // 交易记录表头
      const transactionHeaderRow = worksheet.addRow([
        '类型', '操作时间', '数量', '出入库单价', '出入库总价', '领料人', 
        '领用单位/部门', '用途说明', '出入库后库存', '库存单价', '库存价值'
      ]);
      
      transactionHeaderRow.eachCell(cell => {
        cell.style = {
          font: { bold: true, color: { argb: 'FFFFFFFF' } },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: this.getThinBorder()
        };
      });
      
      // 获取该产品的详细交易记录
      try {
        const transactions = await this.fetchProductTransactions(product.id, year, month);
        if (transactions.length > 0) {
          transactions.forEach((transaction) => {
            const transactionType = transaction.type === 'IN' ? '入库' : '出库';
            const transactionTime = new Date(transaction.created_at).toLocaleString('zh-CN');
            
            const transactionRow = worksheet.addRow([
              transactionType,
              transactionTime,
              transaction.quantity,
              `¥${transaction.unit_price.toFixed(2)}`,
              `¥${(transaction.quantity * transaction.unit_price).toFixed(2)}`,
              transaction.requester_name,
              transaction.project_name || '',
              transaction.purpose || '',
              transaction.stock_after || '',
              transaction.stock_unit_price ? `¥${transaction.stock_unit_price.toFixed(2)}` : '',
              transaction.stock_value ? `¥${transaction.stock_value.toFixed(2)}` : ''
            ]);
            
            // 根据交易类型设置行颜色
            const isInbound = transactionType === '入库';
            const bgColor = isInbound ? 'FFD5E8D4' : 'FFFCE4EC'; // 入库绿色，出库红色
            const fontColor = isInbound ? 'FF385723' : 'FFC62828';
            
            transactionRow.eachCell(cell => {
              cell.style = {
                font: { color: { argb: fontColor }, bold: true },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
                alignment: { horizontal: 'center', vertical: 'middle' },
                border: this.getThinBorder()
              };
            });
          });
        } else {
          const noTransactionRow = worksheet.addRow([
            '本月无交易记录', '', '', '', '', '', '', '', '', '', ''
          ]);
          noTransactionRow.eachCell(cell => {
            cell.style = {
              font: { color: { argb: 'FFC62828' }, italic: true },
              fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } },
              alignment: { horizontal: 'center', vertical: 'middle' },
              border: this.getThinBorder()
            };
          });
        }
      } catch (error) {
        console.error(`获取产品 ${product.id} 交易记录失败:`, error);
        const errorRow = worksheet.addRow([
          '获取交易记录失败', '', '', '', '', '', '', '', '', '', ''
        ]);
        errorRow.eachCell(cell => {
          cell.style = {
            font: { color: { argb: 'FFC62828' }, italic: true },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: this.getThinBorder()
          };
        });
      }
      
      // 产品间分隔
      worksheet.addRow([]);
      worksheet.addRow([]);
    }
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
   * 获取产品的详细交易记录
   */
  async fetchProductTransactions(productId, year, month) {
    try {
      const response = await fetch(`/api/ledger/product/${productId}/transactions?year=${year}&month=${month}&pageSize=1000`);
      if (!response.ok) {
        throw new Error('网络请求失败');
      }
      const data = await response.json();
      return data.transactions || [];
    } catch (error) {
      console.error('获取交易记录失败:', error);
      return [];
    }
  }

  /**
   * 保存工作簿文件
   */
  async saveWorkbook() {
    const { year, month } = this.currentMonth;
    const fileName = `月度账本_${year}年${month}月_${new Date().getTime()}.xlsx`;
    
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
 * 导出月度账本Excel的便捷函数（支持完整样式）
 */
export async function exportLedgerToExcelV2(ledgerData, currentMonth) {
  const exporter = new LedgerExcelExporterV2(ledgerData, currentMonth);
  await exporter.exportLedger();
}
