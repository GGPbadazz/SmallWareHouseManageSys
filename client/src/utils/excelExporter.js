import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/**
 * 月度账本Excel导出工具类
 */
export class LedgerExcelExporter {
  constructor(ledgerData, currentMonth) {
    this.ledgerData = ledgerData;
    this.currentMonth = currentMonth;
    this.workbook = XLSX.utils.book_new();
  }

  /**
   * 导出完整的月度账本Excel
   */
  async exportLedger() {
    try {
      // 确保工作簿支持样式
      this.workbook.Props = {
        Title: `月度账本_${this.currentMonth.year}年${this.currentMonth.month}月`,
        Subject: "月度账本导出报表",
        Author: "库存管理系统",
        CreatedDate: new Date()
      };
      this.workbook.Custprops = {};
      
      // 创建汇总工作表
      this.createSummarySheet();
      
      // 为每个有交易的类别创建单独工作表
      await this.createCategorySheets();
      
      // 保存文件
      this.saveWorkbook();
      
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
    
    const summaryData = [
      [`月度账本汇总报表 - ${year}年${month}月`], // 标题行
      [], // 空行
      ['汇总信息'],
      ['统计期间', `${year}年${month}月1日 - ${year}年${month}月${new Date(year, month, 0).getDate()}日`],
      ['总出入库金额', `¥${summary.total_transaction_amount.toFixed(2)}`],
      ['期末货值', `¥${summary.total_stock_value.toFixed(2)}`],
      ['涉及类别', `${summary.total_categories}个`],
      ['涉及产品', `${summary.total_products}个`],
      [], // 空行
      ['类别明细'], // 分节标题
      ['类别名称', '产品总数', '交易产品数', '本月交易总额', '类别库存价值', '状态']
    ];

    // 添加类别汇总数据
    categories.forEach(category => {
      const status = category.products.length > 0 ? '有交易' : 
                    category.category_stock_value > 0 ? '无交易有库存' : '无交易无库存';
      
      summaryData.push([
        category.name,
        category.total_products_count,
        category.products.length,
        `¥${category.total_amount.toFixed(2)}`,
        `¥${category.category_stock_value.toFixed(2)}`,
        status
      ]);
    });

    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
    
    // 设置列宽
    worksheet['!cols'] = [
      { width: 20 }, // 类别名称
      { width: 12 }, // 产品总数
      { width: 12 }, // 交易产品数
      { width: 15 }, // 本月交易总额
      { width: 15 }, // 类别库存价值
      { width: 15 }  // 状态
    ];

    // 设置样式
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
        if (!worksheet[cell_address]) continue;
        
        // 标题行样式 - 深蓝色背景
        if (R === 0) {
          worksheet[cell_address].s = {
            font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1F4E79" } }, // 深蓝色
            alignment: { horizontal: "center", vertical: "center" },
            border: this.getThickBorder()
          };
        }
        // 汇总信息和类别明细标题 - 绿色背景
        else if (R === 2 || R === 9) {
          worksheet[cell_address].s = {
            font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "548235" } }, // 深绿色
            alignment: { horizontal: "center", vertical: "center" },
            border: this.getThinBorder()
          };
        }
        // 汇总信息数据行 - 浅蓝色背景
        else if (R >= 3 && R <= 8) {
          if (C === 0) { // 标签列
            worksheet[cell_address].s = {
              font: { bold: true, color: { rgb: "1F4E79" } },
              fill: { fgColor: { rgb: "E7F1FF" } },
              alignment: { horizontal: "left", vertical: "center" },
              border: this.getThinBorder()
            };
          } else { // 数值列
            worksheet[cell_address].s = {
              font: { color: { rgb: "2C5282" } },
              fill: { fgColor: { rgb: "F4F8FF" } },
              alignment: { horizontal: "center", vertical: "center" },
              border: this.getThinBorder()
            };
          }
        }
        // 表头行 - 标准蓝色背景
        else if (R === 10) {
          worksheet[cell_address].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4472C4" } }, // 标准蓝色
            alignment: { horizontal: "center", vertical: "center" },
            border: this.getThickBorder()
          };
        }
        // 数据行 - 根据状态设置不同颜色
        else if (R > 10) {
          const cellValue = worksheet[cell_address].v ? worksheet[cell_address].v.toString() : '';
          
          // 状态列特殊处理
          if (C === 5) { // 状态列
            let bgColor = "F8F9FA"; // 默认颜色
            let fontColor = "495057";
            
            if (cellValue === '有交易') {
              bgColor = "D1E7DD"; // 浅绿色
              fontColor = "0A3622";
            } else if (cellValue === '无交易有库存') {
              bgColor = "FFF3CD"; // 浅黄色
              fontColor = "664D03";
            } else if (cellValue === '无交易无库存') {
              bgColor = "F8D7DA"; // 浅红色
              fontColor = "58151C";
            }
            
            worksheet[cell_address].s = {
              font: { bold: true, color: { rgb: fontColor } },
              fill: { fgColor: { rgb: bgColor } },
              alignment: { horizontal: "center", vertical: "center" },
              border: this.getThinBorder()
            };
          } 
          // 数值列（金额）
          else if (C === 3 || C === 4) {
            worksheet[cell_address].s = {
              font: { color: { rgb: "0A5A2A" }, bold: true },
              fill: { fgColor: { rgb: "E8F5E8" } },
              alignment: { horizontal: "center", vertical: "center" },
              border: this.getThinBorder()
            };
          }
          // 普通数据列
          else {
            worksheet[cell_address].s = {
              fill: { fgColor: { rgb: "FAFBFC" } },
              alignment: { horizontal: "center", vertical: "center" },
              border: this.getThinBorder()
            };
          }
        }
      }
    }

    // 合并标题单元格
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } } // 合并标题行
    ];

    XLSX.utils.book_append_sheet(this.workbook, worksheet, '月度汇总');
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
   * 创建单个类别的详细工作表（仿网页表格布局）
   */
  async createCategoryDetailSheet(category) {
    const { year, month } = this.currentMonth;
    
    const categoryData = [];
    
    // 类别标题
    categoryData.push([
      `${category.name} (${category.total_products_count}个产品，出入库总次数: ${category.products.reduce((sum, p) => sum + p.transaction_count, 0)}，出入库总额: ¥${category.total_amount.toFixed(2)}，仓库货值: ¥${category.category_stock_value.toFixed(2)})`
    ]);
    categoryData.push([]); // 空行

    // 为该类别的每个产品添加详细信息
    for (const product of category.products) {
      // 产品标题行 - 仿网页中的产品名称行
      categoryData.push([
        '产品名称', '条码', '出入库次数', '库存总价值变化', '初期库存', '初期库存价值', 
        '期末库存', '期末单价', '期末库存价值', '操作'
      ]);
      
      // 产品数据行
      categoryData.push([
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
      
      categoryData.push([]); // 空行
      
      // 交易记录标题
      categoryData.push(['出入库记录']);
      categoryData.push([]); // 空行
      
      // 交易记录表头
      categoryData.push([
        '类型', '操作时间', '数量', '出入库单价', '出入库总价', '领料人', 
        '领用单位/部门', '用途说明', '出入库后库存', '库存单价', '库存价值'
      ]);
      
      // 获取该产品的详细交易记录
      try {
        const transactions = await this.fetchProductTransactions(product.id, year, month);
        if (transactions.length > 0) {
          transactions.forEach((transaction) => {
            const transactionType = transaction.type === 'IN' ? '入库' : '出库';
            const transactionTime = new Date(transaction.created_at).toLocaleString('zh-CN');
            
            categoryData.push([
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
          });
        } else {
          categoryData.push([
            '本月无交易记录', '', '', '', '', '', '', '', '', '', ''
          ]);
        }
      } catch (error) {
        console.error(`获取产品 ${product.id} 交易记录失败:`, error);
        categoryData.push([
          '获取交易记录失败', '', '', '', '', '', '', '', '', '', ''
        ]);
      }
      
      // 产品间分隔
      categoryData.push([]);
      categoryData.push([]);
    }

    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet(categoryData);
    
    // 设置列宽
    worksheet['!cols'] = [
      { width: 15 }, // 产品名称/类型
      { width: 18 }, // 条码/操作时间
      { width: 12 }, // 出入库次数/数量
      { width: 15 }, // 库存总价值变化/出入库单价
      { width: 12 }, // 初期库存/出入库总价
      { width: 15 }, // 初期库存价值/领料人
      { width: 12 }, // 期末库存/领用单位
      { width: 12 }, // 期末单价/用途说明
      { width: 15 }, // 期末库存价值/出入库后库存
      { width: 12 }, // 操作/库存单价
      { width: 15 }  // 库存价值
    ];

    // 设置样式
    this.applyCategorySheetStyles(worksheet, categoryData);

    // 限制工作表名称长度，避免Excel限制
    const sheetName = category.name.length > 25 ? category.name.substring(0, 25) + '...' : category.name;
    XLSX.utils.book_append_sheet(this.workbook, worksheet, sheetName);
  }

  /**
   * 应用类别工作表样式
   */
  applyCategorySheetStyles(worksheet, data) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
        if (!worksheet[cell_address]) continue;
        
        const cellValue = data[R] && data[R][C] ? data[R][C].toString() : '';
        
        // 类别标题行（第一行）- 深蓝色背景
        if (R === 0) {
          worksheet[cell_address].s = {
            font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1F4E79" } }, // 深蓝色
            alignment: { horizontal: "left", vertical: "center" },
            border: this.getThickBorder()
          };
        }
        // 产品表头（产品名称、条码等列）- 绿色背景
        else if (cellValue === '产品名称' || cellValue === '条码' || cellValue === '出入库次数' || cellValue === '库存总价值变化' || cellValue === '操作') {
          worksheet[cell_address].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "548235" } }, // 深绿色
            alignment: { horizontal: "center", vertical: "center" },
            border: this.getThinBorder()
          };
        }
        // 期初库存列（蓝色背景）
        else if (cellValue === '初期库存' || cellValue === '初期库存价值') {
          worksheet[cell_address].s = {
            font: { bold: true, color: { rgb: "1F4E79" } },
            fill: { fgColor: { rgb: "B4C6E7" } }, // 浅蓝色
            alignment: { horizontal: "center", vertical: "center" },
            border: this.getThinBorder()
          };
        }
        // 期末库存列（绿色背景）
        else if (cellValue === '期末库存' || cellValue === '期末单价' || cellValue === '期末库存价值') {
          worksheet[cell_address].s = {
            font: { bold: true, color: { rgb: "385723" } },
            fill: { fgColor: { rgb: "C5E0B4" } }, // 浅绿色
            alignment: { horizontal: "center", vertical: "center" },
            border: this.getThinBorder()
          };
        }
        // 产品数据行 - 浅灰色背景
        else if (R > 0 && R < range.e.r && cellValue && !cellValue.includes('记录') && !cellValue.includes('类型') && !cellValue.includes('操作时间')) {
          // 检查是否是产品数据行（不是表头，不是空行，不是交易记录）
          const isProductDataRow = data[R] && data[R][0] && !data[R][0].includes('出入库记录') && 
                                   !['类型', '操作时间', '数量', '出入库单价'].includes(data[R][0]);
          
          if (isProductDataRow && C < 10) { // 产品信息列
            let bgColor = "F2F2F2"; // 默认浅灰色
            
            // 期初库存列使用特殊颜色
            if (C === 4 || C === 5) { // 初期库存列
              bgColor = "E1EFFF";
              worksheet[cell_address].s = {
                font: { color: { rgb: "1F4E79" }, bold: C === 4 || C === 5 },
                fill: { fgColor: { rgb: bgColor } },
                alignment: { horizontal: "center", vertical: "center" },
                border: this.getThinBorder()
              };
            }
            // 期末库存列使用特殊颜色
            else if (C === 6 || C === 7 || C === 8) { // 期末库存列
              bgColor = "E2EFDA";
              worksheet[cell_address].s = {
                font: { color: { rgb: "385723" }, bold: C === 6 || C === 7 || C === 8 },
                fill: { fgColor: { rgb: bgColor } },
                alignment: { horizontal: "center", vertical: "center" },
                border: this.getThinBorder()
              };
            }
            else {
              worksheet[cell_address].s = {
                fill: { fgColor: { rgb: bgColor } },
                alignment: { horizontal: "center", vertical: "center" },
                border: this.getThinBorder()
              };
            }
          }
        }
        // 交易记录标题 - 橙色背景
        else if (cellValue === '出入库记录') {
          worksheet[cell_address].s = {
            font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "C65911" } }, // 深橙色
            alignment: { horizontal: "left", vertical: "center" },
            border: this.getThinBorder()
          };
        }
        // 交易记录表头 - 蓝色背景
        else if (cellValue === '类型' || cellValue === '操作时间' || cellValue === '数量' || 
                 cellValue === '出入库单价' || cellValue === '出入库总价' || cellValue === '领料人' ||
                 cellValue === '领用单位/部门' || cellValue === '用途说明' || cellValue === '出入库后库存' ||
                 cellValue === '库存单价' || cellValue === '库存价值') {
          worksheet[cell_address].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4472C4" } }, // 标准蓝色
            alignment: { horizontal: "center", vertical: "center" },
            border: this.getThinBorder()
          };
        }
        // 入库记录行（浅绿色背景）
        else if (cellValue === '入库') {
          this.applyRowStyle(worksheet, R, range.e.c, {
            fill: { fgColor: { rgb: "D5E8D4" } }, // 浅绿色
            font: { color: { rgb: "385723" }, bold: true },
            alignment: { horizontal: "center", vertical: "center" },
            border: this.getThinBorder()
          });
        }
        // 出库记录行（浅红色背景）
        else if (cellValue === '出库') {
          this.applyRowStyle(worksheet, R, range.e.c, {
            fill: { fgColor: { rgb: "FCE4EC" } }, // 浅红色
            font: { color: { rgb: "C62828" }, bold: true },
            alignment: { horizontal: "center", vertical: "center" },
            border: this.getThinBorder()
          });
        }
        // 普通数据行
        else if (cellValue && cellValue !== '' && !cellValue.includes('无交易记录') && !cellValue.includes('获取')) {
          worksheet[cell_address].s = {
            alignment: { horizontal: "center", vertical: "center" },
            border: this.getThinBorder()
          };
        }
        // 错误信息行 - 红色背景
        else if (cellValue.includes('无交易记录') || cellValue.includes('获取') || cellValue.includes('失败')) {
          worksheet[cell_address].s = {
            font: { color: { rgb: "C62828" }, italic: true },
            fill: { fgColor: { rgb: "FFEBEE" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: this.getThinBorder()
          };
        }
      }
    }

    // 合并类别标题行
    if (range.e.c >= 10) {
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }
      ];
    }
  }

  /**
   * 应用整行样式
   */
  applyRowStyle(worksheet, rowIndex, maxCol, style) {
    for (let C = 0; C <= maxCol; ++C) {
      const cell_address = XLSX.utils.encode_cell({ c: C, r: rowIndex });
      if (worksheet[cell_address]) {
        worksheet[cell_address].s = style;
      }
    }
  }

  /**
   * 获取粗边框样式
   */
  getThickBorder() {
    return {
      top: { style: "thick", color: { rgb: "000000" } },
      bottom: { style: "thick", color: { rgb: "000000" } },
      left: { style: "thick", color: { rgb: "000000" } },
      right: { style: "thick", color: { rgb: "000000" } }
    };
  }

  /**
   * 获取细边框样式
   */
  getThinBorder() {
    return {
      top: { style: "thin", color: { rgb: "CCCCCC" } },
      bottom: { style: "thin", color: { rgb: "CCCCCC" } },
      left: { style: "thin", color: { rgb: "CCCCCC" } },
      right: { style: "thin", color: { rgb: "CCCCCC" } }
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
  saveWorkbook() {
    const { year, month } = this.currentMonth;
    const fileName = `月度账本_${year}年${month}月_${new Date().getTime()}.xlsx`;
    
    // 将工作簿转换为buffer
    const workbookBlob = XLSX.write(this.workbook, {
      bookType: 'xlsx',
      type: 'array',
      cellStyles: true,
      bookSST: false,
      Props: {
        Title: `月度账本_${year}年${month}月`,
        Subject: "月度账本导出报表",
        Author: "库存管理系统",
        CreatedDate: new Date()
      }
    });
    
    // 创建Blob并保存
    const blob = new Blob([workbookBlob], { type: 'application/octet-stream' });
    saveAs(blob, fileName);
  }
}

/**
 * 导出月度账本Excel的便捷函数
 */
export async function exportLedgerToExcel(ledgerData, currentMonth) {
  const exporter = new LedgerExcelExporter(ledgerData, currentMonth);
  await exporter.exportLedger();
}
