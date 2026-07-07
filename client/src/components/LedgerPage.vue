<template>
  <div class="ledger-page">
    <div class="ledger-header">
      <div class="header-left">
        <h2>月度账本</h2>
        <div class="current-period">
          <span class="period-label">统计期间：</span>
          <span class="period-range">{{ currentPeriod }}</span>
        </div>
      </div>
      <div class="header-right">
        <div class="month-selector">
          <button class="month-nav-btn" @click="previousMonth">‹</button>
          <span class="current-month">{{ formatMonth(currentMonth) }}</span>
          <button class="month-nav-btn" @click="nextMonth">›</button>
        </div>
        <div class="export-buttons">
          <button class="btn btn-outline" @click="exportToExcel" :disabled="loading || exportingExcel">
            <span v-if="exportingExcel">导出中...</span>
            <span v-else>导出 Excel</span>
          </button>
          <button class="btn btn-outbound" @click="exportOutboundRecords" :disabled="loading || exportingOutbound">
            <span v-if="exportingOutbound">导出中...</span>
            <span v-else>导出出库记录</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 期初期末汇总 -->
    <div v-if="summary" class="period-summary">
      <div class="summary-card">
        <span class="summary-label">入库:</span>
        <span class="summary-value">{{ summary.total_in_count }}笔，{{ formatCurrency(summary.total_in_amount) }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">出库:</span>
        <span class="summary-value">{{ summary.total_out_count }}笔，{{ formatCurrency(summary.total_out_amount) }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">期末货值:</span>
        <span class="summary-value">{{ formatCurrency(summary.total_stock_value) }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">涉及类别:</span>
        <span class="summary-value">{{ summary.total_categories }} 个</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">涉及产品:</span>
        <span class="summary-value">{{ summary.total_products }} 个</span>
      </div>
    </div>

    <!-- 展开/收起控制按钮 -->
    <div class="expand-control">
      <div class="expand-info">
        <span class="expand-stats">
          共 {{ categories.length }} 个类别
          ({{ categoriesWithTransactions.length }} 个有交易，{{ categoriesWithoutTransactions.length }} 个无交易)，
          已展开 {{ expandedCategories.length }} 个
        </span>
      </div>
      <div class="expand-actions">
        <button 
          class="btn btn-outline btn-sm expand-btn" 
          @click="expandAll"
          :disabled="allExpanded"
        >
          <span class="expand-icon">📂</span>
          展开全部
        </button>
        <button 
          class="btn btn-outline btn-sm expand-btn" 
          @click="expandWithTransactions"
          :disabled="onlyTransactionsExpanded"
        >
          <span class="expand-icon">📊</span>
          展开有交易
        </button>
        <button 
          class="btn btn-outline btn-sm collapse-btn" 
          @click="collapseAll"
          :disabled="allCollapsed"
        >
          <span class="collapse-icon">📁</span>
          收起全部
        </button>
      </div>
    </div>

    <div class="ledger-categories">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-text">正在加载账本数据...</div>
      </div>

      <!-- 分类循环展示 -->
      <div v-else-if="categories.length > 0" class="categories-container">
        <div 
          v-for="(category, index) in categories" 
          :key="category.id" 
          class="ledger-category"
          :class="{ 'category-expanded': expandedCategories.includes(category.id) }"
        >
          <div class="category-header" @click="toggleCategory(category.id)">
            <div class="category-info">
              <span class="category-icon">📁</span>
              <span class="category-name">{{ category.name }}</span>
              <span class="category-stats">
                ({{ category.total_products_count }}个产品，入库: {{ category.total_in_count }}笔，出库: {{ category.total_out_count }}笔，入库金额: {{ formatCurrency(category.total_in_amount) }}，出库金额: {{ formatCurrency(category.total_out_amount) }}，仓库货值: {{ formatCurrency(category.category_stock_value) }})
              </span>
            </div>
            <div class="category-toggle">
              <span v-if="expandedCategories.includes(category.id)" class="toggle-expanded">▼</span>
              <span v-else class="toggle-collapsed">▶</span>
            </div>
          </div>

          <!-- 产品表格 -->
          <div v-if="expandedCategories.includes(category.id)" class="category-products">
            <div v-if="category.products.length > 0" class="products-table-container">
              <table class="products-table">
                <thead>
                  <tr>
                    <th class="expand-col"></th>
                    <th>产品名称</th>
                    <th>入库次数</th>
                    <th>入库数量</th>
                    <th>出库次数</th>
                    <th>出库数量</th>
                    <th>入库金额</th>
                    <th>出库金额</th>
                    <th class="beginning-col">初期库存</th>
                    <th class="beginning-col">初期库存价值</th>
                    <th class="ending-col">期末库存</th>
                    <th class="ending-col">期末单价</th>
                    <th class="ending-col">期末库存价值</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="product in category.products" :key="product.id">
                    <tr 
                      class="product-row" 
                      :class="{ 'expanded': expandedProducts.includes(product.id) }"
                      @click="toggleProductDetail(product)"
                      style="cursor: pointer;"
                    >
                      <td class="expand-col" @click.stop>
                        <button 
                          class="btn-expand-product" 
                          @click="toggleProductDetail(product)"
                          :class="{ 'loading': loadingProducts.includes(product.id) }"
                        >
                          <span v-if="loadingProducts.includes(product.id)" class="expand-spinner">⏳</span>
                          <span v-else-if="expandedProducts.includes(product.id)">▼</span>
                          <span v-else>▶</span>
                        </button>
                      </td>
                      <td class="product-name">{{ product.name }}</td>
                      <td class="in-count">{{ product.in_count }}</td>
                      <td class="in-quantity">{{ formatQuantity(product.in_quantity || 0) }}</td>
                      <td class="out-count">{{ product.out_count }}</td>
                      <td class="out-quantity">{{ formatQuantity(product.out_quantity || 0) }}</td>
                      <td class="in-amount">{{ formatCurrency(product.in_amount) }}</td>
                      <td class="out-amount">{{ formatCurrency(product.out_amount) }}</td>
                      <td class="beginning-stock beginning-col">{{ formatQuantity(product.beginning_stock || 0) }}</td>
                      <td class="beginning-value beginning-col">{{ formatCurrency(product.beginning_stock_value || 0) }}</td>
                      <td class="ending-stock ending-col">{{ formatQuantity(product.ending_stock) }}</td>
                      <td class="ending-price ending-col">{{ formatCurrency(product.ending_unit_price) }}</td>
                      <td class="ending-value ending-col">{{ formatCurrency(product.ending_stock_value) }}</td>
                    </tr>
                    <!-- 产品交易详情展开区域 -->
                    <tr v-if="expandedProducts.includes(product.id)" class="product-transactions-row">
                      <td colspan="13" class="transactions-cell">
                        <div class="product-transactions-container">
                          <div class="transactions-header-info">
                            <span class="product-detail-title">📋 {{ product.name }} - 本月出入库明细</span>
                          </div>
                          <!-- 交易记录表格 -->
                          <div class="transactions-table-wrapper">
                            <div class="transaction-header">
                              <div class="header-cell type">类型</div>
                              <div class="header-cell document-number">单号</div>
                              <div class="header-cell datetime">操作时间</div>
                              <div class="header-cell quantity">数量</div>
                              <div class="header-cell unit-price">单价</div>
                              <div class="header-cell total-price">总价</div>
                              <div class="header-cell requester">领料人</div>
                              <div class="header-cell project">单位</div>
                              <div class="header-cell purpose">用途</div>
                              <div class="header-cell current-stock">库存</div>
                              <div class="header-cell stock-unit-price">库存单价</div>
                              <div class="header-cell stock-value">库存价值</div>
                            </div>
                            <div 
                              v-for="tx in productTransactions[product.id]" 
                              :key="tx.id"
                              class="transaction-row"
                              :class="[tx.type, { 'has-doc': tx.document_id && tx.document_image_path }]"
                              @click="viewDocumentImage(tx)"
                              :style="{ cursor: (tx.document_id && tx.document_image_path) ? 'pointer' : 'default' }"
                            >
                              <div class="table-cell type">
                                <span class="transaction-type-badge" :class="tx.type">
                                  {{ tx.type === 'IN' ? '入库' : '出库' }}
                                </span>
                              </div>
                              <div class="table-cell document-number">
                                <span class="document-number-text">{{ extractDocumentNumber(tx.document_number) }}</span>
                              </div>
                              <div class="table-cell datetime">{{ formatDateTime(tx.created_at) }}</div>
                              <div class="table-cell quantity">{{ formatQuantity(tx.quantity) }}</div>
                              <div class="table-cell unit-price">{{ formatCurrency(tx.unit_price) }}</div>
                              <div class="table-cell total-price">{{ formatCurrency(tx.total_price) }}</div>
                              <div class="table-cell requester">{{ tx.requester_name || '-' }}</div>
                              <div class="table-cell project">
                                <!-- 入库显示供应商（绿色），出库显示领用部门（蓝色） -->
                                <span v-if="tx.type === 'IN'" class="unit-tag supplier">
                                  {{ tx.supplier || '-' }}
                                </span>
                                <span v-else class="unit-tag department">
                                  {{ tx.project_name || '-' }}
                                </span>
                              </div>
                              <div class="table-cell purpose">{{ tx.purpose || '-' }}</div>
                              <div class="table-cell current-stock">{{ formatQuantity(tx.stock_after || 0) }}</div>
                              <div class="table-cell stock-unit-price">{{ formatCurrency(tx.stock_unit_price) }}</div>
                              <div class="table-cell stock-value">{{ formatCurrency(tx.stock_value) }}</div>
                            </div>
                            <div v-if="!productTransactions[product.id] || productTransactions[product.id].length === 0" class="no-transactions">
                              暂无交易记录
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
            <!-- 无产品交易记录的显示 -->
            <div v-else class="no-products-message">
              <div class="no-products-icon">📦</div>
              <div class="no-products-text">本月该类别无产品交易记录</div>
              <div class="no-products-note">
                <span v-if="category.category_stock_value > 0">
                  但该类别当前库存价值: {{ formatCurrency(category.category_stock_value) }}
                </span>
                <span v-else>
                  该类别当前无库存价值
                </span>
              </div>
              <div v-if="category.category_stock_value > 0" class="no-products-hint">
                💡 虽然本月无交易，但类别中仍有 {{ category.total_products_count }} 个产品存在库存
              </div>
            </div>
          </div>

          <!-- 类别分割线 -->
          <div v-if="index < categories.length - 1" class="category-divider">
            <div class="divider-line"></div>
            <div class="divider-text">• • •</div>
            <div class="divider-line"></div>
          </div>
        </div>
      </div>

      <!-- 无数据状态 -->
      <div v-else class="no-data">
        <div class="no-data-icon">📋</div>
        <div class="no-data-text">当前月份暂无出入库记录</div>
      </div>
    </div>

    <!-- 图片预览遮罩层 -->
    <div v-if="showImagePreview" class="image-preview-overlay" @click="closeImagePreview">
      <div class="image-preview-hint">点击任意位置关闭预览</div>
      <div class="image-preview-info">单据号: {{ previewDocumentNumber || '-' }}</div>
      <img 
        :src="previewImageUrl" 
        class="preview-image" 
        alt="单据图片"
        @error="handleImageError"
      />
    </div>
  </div>
</template>

<script>
import { ledgerAPI } from '@/services/api'
import { exportLedgerToExcelV2 } from '@/utils/excelExporterV2'
import { exportOutboundRecordsToExcel } from '@/utils/outboundRecordsExporter'

export default {
  name: 'LedgerPage',
  data() {
    const now = new Date();
    return {
      // 当前月份 - 默认为当前年月
      currentMonth: { year: now.getFullYear(), month: now.getMonth() + 1 },
      // 展开的类别
      expandedCategories: [],
      // 展开的产品详情
      expandedProducts: [],
      // 正在加载的产品
      loadingProducts: [],
      // 产品交易数据缓存
      productTransactions: {},
      // 加载状态
      loading: false,
      // Excel导出状态
      exportingExcel: false,
      // 出库记录导出状态
      exportingOutbound: false,
      // 账本数据
      categories: [],
      summary: null,
      // 图片预览
      showImagePreview: false,
      previewImageUrl: '',
      previewDocumentNumber: ''
    }
  },
  computed: {
    currentPeriod() {
      const { year, month } = this.currentMonth
      const startDate = `${year}年${month}月1日`
      const endDate = `${year}年${month}月${new Date(year, month, 0).getDate()}日`
      return `${startDate} - ${endDate}`
    },
    // 是否所有类别都已展开
    allExpanded() {
      return this.categories.length > 0 && this.expandedCategories.length === this.categories.length
    },
    // 是否所有类别都已收起
    allCollapsed() {
      return this.expandedCategories.length === 0
    },
    // 有交易记录的类别
    categoriesWithTransactions() {
      return this.categories.filter(cat => cat.products.length > 0)
    },
    // 无交易记录的类别
    categoriesWithoutTransactions() {
      return this.categories.filter(cat => cat.products.length === 0)
    },
    // 是否只展开了有交易记录的类别
    onlyTransactionsExpanded() {
      const transactionCategoryIds = this.categoriesWithTransactions.map(cat => cat.id)
      return this.expandedCategories.length === transactionCategoryIds.length &&
             transactionCategoryIds.every(id => this.expandedCategories.includes(id))
    }
  },
  async mounted() {
    await this.loadLedgerData()
    // 默认只展开有交易记录的类别
    this.expandedCategories = this.categories
      .filter(cat => cat.products.length > 0)
      .map(cat => cat.id)
  },
  methods: {
    async loadLedgerData() {
      this.loading = true
      // 清空产品展开状态和缓存
      this.expandedProducts = []
      this.productTransactions = {}
      try {
        const response = await ledgerAPI.getMonthlyData({
          year: this.currentMonth.year,
          month: this.currentMonth.month
        })
        this.categories = response.data.categories || []
        this.summary = response.data.summary || null
        // 加载数据后默认只展开有交易记录的类别
        this.expandedCategories = this.categories
          .filter(cat => cat.products.length > 0)
          .map(cat => cat.id)
        // 自动展开所有有交易的产品
        const productsWithTransactions = []
        this.categories.forEach(cat => {
          cat.products.forEach(product => {
            if (product.in_count > 0 || product.out_count > 0) {
              productsWithTransactions.push(product.id)
            }
          })
        })
        // 逐个加载产品交易详情
        for (const productId of productsWithTransactions) {
          const product = this.categories
            .flatMap(cat => cat.products)
            .find(p => p.id === productId)
          if (product) {
            await this.loadProductTransactions(product)
            this.expandedProducts.push(productId)
          }
        }
      } catch (error) {
        console.error('加载账本数据失败:', error)
        this.$message?.error('加载账本数据失败')
      } finally {
        this.loading = false
      }
    },
    toggleCategory(categoryId) {
      if (this.expandedCategories.includes(categoryId)) {
        this.expandedCategories = this.expandedCategories.filter(id => id !== categoryId)
      } else {
        this.expandedCategories.push(categoryId)
      }
    },
    // 展开所有类别
    expandAll() {
      this.expandedCategories = this.categories.map(cat => cat.id)
    },
    // 只展开有交易记录的类别
    expandWithTransactions() {
      this.expandedCategories = this.categoriesWithTransactions.map(cat => cat.id)
    },
    // 收起所有类别
    collapseAll() {
      this.expandedCategories = []
    },
    formatMonth(month) {
      return `${month.year}年${month.month}月`
    },
    async previousMonth() {
      if (this.currentMonth.month === 1) {
        this.currentMonth = { year: this.currentMonth.year - 1, month: 12 }
      } else {
        this.currentMonth = { ...this.currentMonth, month: this.currentMonth.month - 1 }
      }
      await this.loadLedgerData()
    },
    async nextMonth() {
      if (this.currentMonth.month === 12) {
        this.currentMonth = { year: this.currentMonth.year + 1, month: 1 }
      } else {
        this.currentMonth = { ...this.currentMonth, month: this.currentMonth.month + 1 }
      }
      await this.loadLedgerData()
    },
    viewProductDetails(product) {
      // 在新标签页打开产品出入库详情
      const routeData = this.$router.resolve({
        name: 'ProductLedgerDetail',
        params: { id: product.id },
        query: { 
          year: this.currentMonth.year, 
          month: this.currentMonth.month 
        }
      })
      window.open(routeData.href, '_blank')
    },
    // 展开/收起产品详情
    async toggleProductDetail(product) {
      const productId = product.id
      
      if (this.expandedProducts.includes(productId)) {
        // 收起
        this.expandedProducts = this.expandedProducts.filter(id => id !== productId)
      } else {
        // 展开 - 先加载数据
        if (!this.productTransactions[productId]) {
          await this.loadProductTransactions(product)
        }
        this.expandedProducts.push(productId)
      }
    },
    // 加载产品交易数据
    async loadProductTransactions(product) {
      const productId = product.id
      this.loadingProducts.push(productId)
      
      try {
        const response = await ledgerAPI.getProductTransactions(productId, {
          year: this.currentMonth.year,
          month: this.currentMonth.month,
          page: 1,
          pageSize: 1000  // 获取所有记录
        })
        
        this.productTransactions = {
          ...this.productTransactions,
          [productId]: response.data.transactions || []
        }
      } catch (error) {
        console.error('加载产品交易数据失败:', error)
        this.$message?.error('加载交易数据失败')
      } finally {
        this.loadingProducts = this.loadingProducts.filter(id => id !== productId)
      }
    },
    // 查看单据图片
    viewDocumentImage(transaction) {
      if (!transaction.document_id) {
        this.$message?.warning('该交易记录没有关联单据（历史数据）')
        return
      }
      
      // 点击时才加载图片
      this.previewDocumentNumber = transaction.document_number || `交易ID: ${transaction.id}`
      this.previewImageUrl = `/api/documents/${transaction.document_id}/image`
      this.showImagePreview = true
    },
    // 关闭图片预览
    closeImagePreview() {
      this.showImagePreview = false
      this.previewImageUrl = ''
      this.previewDocumentNumber = ''
    },
    // 图片加载失败处理
    handleImageError() {
      this.$message?.error('图片加载失败，文件可能已被删除')
      this.closeImagePreview()
    },
    // 格式化时间
    formatDateTime(dateTime) {
      if (!dateTime) return '-'
      return new Date(dateTime).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    formatCurrency(val) {
      if (typeof val !== 'number') val = 0
      const str = val.toString()
      // 仅去掉小数点后的尾零（如 300.00→300, 17.4100→17.41）
      // 不能对整数直接 replace(/\.?0+$/)，会把 900→9、300→3
      const cleaned = str.includes('.') ? str.replace(/\.?0+$/, '') : str
      return '¥' + (cleaned || '0')
    },
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
    },
    
    // 从完整单据号中提取7位数字部分
    extractDocumentNumber(documentNumber) {
      if (!documentNumber) return '-'
      // 格式: C1234567-2501 或 R1234567-2501 -> 1234567
      const match = documentNumber.match(/[CR](\d{7})-/)
      return match ? match[1] : documentNumber
    },
    
    // Excel导出功能
    async exportToExcel() {
      if (this.exportingExcel) return;
      
      this.exportingExcel = true;
      try {
        const ledgerData = {
          categories: this.categories,
          summary: this.summary
        };
        
        await exportLedgerToExcelV2(ledgerData, this.currentMonth);
        
        // 可以添加成功提示
        if (this.$message) {
          this.$message.success('Excel导出成功！带有完整颜色样式。');
        } else {
          alert('Excel导出成功！带有完整颜色样式。');
        }
        
      } catch (error) {
        console.error('Excel导出失败:', error);
        if (this.$message) {
          this.$message.error('Excel导出失败：' + error.message);
        } else {
          alert('Excel导出失败：' + error.message);
        }
      } finally {
        this.exportingExcel = false;
      }
    },

    // 出库记录导出功能
    async exportOutboundRecords() {
      if (this.exportingOutbound) return;
      
      this.exportingOutbound = true;
      try {
        await exportOutboundRecordsToExcel(this.currentMonth);
        
        // 可以添加成功提示
        if (this.$message) {
          this.$message.success('出库记录导出成功！');
        } else {
          alert('出库记录导出成功！');
        }
        
      } catch (error) {
        console.error('出库记录导出失败:', error);
        if (this.$message) {
          this.$message.error('出库记录导出失败：' + error.message);
        } else {
          alert('出库记录导出失败：' + error.message);
        }
      } finally {
        this.exportingOutbound = false;
      }
    }
  }
}
</script>

<style scoped>
.ledger-page {
  max-width: 1400px;
  margin: 0 auto;
  text-align: left;
}

.ledger-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-left h2 {
  margin: 0;
  color: #2d3748;
  font-size: 24px;
}

.current-period {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.period-label {
  color: #666;
}

.period-range {
  color: #3182ce;
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.month-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f7fafc;
  padding: 8px 12px;
  border-radius: 6px;
}

.month-nav-btn {
  background: #e2e8f0;
  border: none;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s;
}

.month-nav-btn:hover {
  background: #cbd5e0;
}

.current-month {
  font-weight: 500;
  color: #2d3748;
  min-width: 80px;
  text-align: center;
}

.export-buttons {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-outline {
  background: #fff;
  color: #3182ce;
  border-color: #3182ce;
}

.btn-outline:hover {
  background: #ebf8ff;
}

.btn-primary {
  background: #3182ce;
  color: #fff;
}

.btn-primary:hover {
  background: #2c5282;
}

.btn-outbound {
  background: linear-gradient(135deg, #ff8c00, #ff6347);
  color: white;
  border: 2px solid #ff8c00;
  box-shadow: 0 2px 4px rgba(255, 140, 0, 0.3);
}

.btn-outbound:hover:not(:disabled) {
  background: linear-gradient(135deg, #ff7300, #ff4500);
  box-shadow: 0 4px 8px rgba(255, 140, 0, 0.4);
  transform: translateY(-1px);
}

/* 期初期末汇总 */
.period-summary {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: #f0fff4;
  border-radius: 8px;
  border: 1px solid #c6f6d5;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}

.summary-label {
  font-size: 12px;
  color: #718096;
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

/* 加载状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.loading-spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

.loading-text {
  color: #666;
  font-size: 14px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 分类 */
.ledger-categories {
  margin-top: 12px;
}

.ledger-category {
  background: #f7fafc;
  border-radius: 8px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  overflow: hidden;
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #e2e8f0;
}

.category-header:hover {
  background: #edf2f7;
}

.category-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-icon {
  font-size: 18px;
}

.category-title h3 {
  margin: 0;
  color: #2d3748;
  font-size: 18px;
}

.category-total {
  color: #718096;
  font-size: 14px;
  font-weight: normal;
}

.category-expand {
  color: #a0aec0;
  font-size: 12px;
}

/* 产品表格 */
.category-products {
  padding: 0;
}

.products-table-container {
  overflow-x: auto;
}

.products-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
}

.products-table th {
  background: #f7fafc;
  color: #4a5568;
  font-weight: 600;
  padding: 12px 16px;
  text-align: left;
  border-bottom: 2px solid #e2e8f0;
  font-size: 14px;
}

.products-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
}

.product-row:hover {
  background: #f7fafc;
}

.product-name {
  font-weight: 500;
  color: #2d3748;
}

.product-barcode {
  color: #718096;
  font-family: monospace;
}

.transaction-count {
  color: #3182ce;
  font-weight: 500;
}

.total-amount {
  color: #059669;
  font-weight: 500;
}

.current-stock {
  color: #2d3748;
  font-weight: 500;
}

.unit-price, .stock-value {
  color: #4a5568;
}

.actions {
  text-align: center;
}

/* 无数据状态 */
.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #718096;
}

.no-data-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.no-data-text {
  font-size: 16px;
}

/* 展开/收起控制区域样式 */
.expand-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding: 16px 20px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.expand-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.expand-stats {
  color: #4a5568;
  font-size: 14px;
  font-weight: 500;
}

.expand-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.expand-btn, .collapse-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  padding: 8px 12px;
}

.expand-icon, .collapse-icon {
  font-size: 14px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.btn-primary {
  background: #3182ce;
  color: white;
  border-color: #3182ce;
}

.btn-primary:hover {
  background: #2c5aa0;
  border-color: #2c5aa0;
}

.btn-outline {
  background: transparent;
  color: #3182ce;
  border-color: #3182ce;
}

.btn-outline:hover {
  background: #3182ce;
  color: white;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn:disabled:hover {
  opacity: 0.6;
}

/* 类别容器样式 */
.categories-container {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* 类别卡片样式改进 */
.ledger-category {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  border: 1px solid #e2e8f0;
  margin-bottom: 16px;
  transition: all 0.3s ease;
}

.ledger-category.category-expanded {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border-color: #cbd5e0;
}

.category-header {
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px 8px 0 0;
}

.category-header:hover {
  background: #f7fafc;
}

.category-expanded .category-header {
  border-bottom: 1px solid #e2e8f0;
  border-radius: 8px 8px 0 0;
}

.toggle-expanded, .toggle-collapsed {
  font-size: 14px;
  color: #4a5568;
  transition: transform 0.2s ease;
}

.toggle-expanded {
  transform: rotate(0deg);
}

.toggle-collapsed {
  transform: rotate(-90deg);
}

/* 类别分割线样式 */
.category-divider {
  display: flex;
  align-items: center;
  margin: 24px 0;
  opacity: 0.6;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, transparent, #cbd5e0, transparent);
}

.divider-text {
  padding: 0 16px;
  color: #a0aec0;
  font-size: 12px;
  letter-spacing: 2px;
}

/* 期初和期末列的样式 */
.beginning-col {
  background-color: #e6f3ff !important;
  border-left: 2px solid #3182ce;
}

.ending-col {
  background-color: #f0fff4 !important;
  border-left: 2px solid #38a169;
}

.products-table th.beginning-col {
  color: #2c5282;
  font-weight: 600;
}

.products-table th.ending-col {
  color: #2f855a;
  font-weight: 600;
}

.products-table td.beginning-col {
  color: #2c5282;
  font-weight: 500;
}

.products-table td.ending-col {
  color: #2f855a;
  font-weight: 500;
}

/* 无产品交易记录的显示样式 */
.no-products-message {
  padding: 40px 20px;
  text-align: center;
  background: #f7fafc;
  border-radius: 0 0 8px 8px;
}

.no-products-icon {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.6;
}

.no-products-text {
  color: #4a5568;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
}

.no-products-note {
  color: #718096;
  font-size: 14px;
  margin-bottom: 8px;
}

.no-products-hint {
  color: #4a5568;
  font-size: 13px;
  padding: 8px 12px;
  background: #e6fffa;
  border-radius: 4px;
  border-left: 3px solid #38a169;
  margin-top: 12px;
  display: inline-block;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .ledger-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .header-right {
    justify-content: space-between;
  }
  
  .period-summary {
    flex-direction: column;
    gap: 12px;
  }
  
  .products-table {
    font-size: 12px;
  }
  
  .products-table th,
  .products-table td {
    padding: 8px 12px;
  }
  
  .export-buttons {
    flex-direction: column;
  }
}

/* 展开按钮列 */
.expand-col {
  width: 40px;
  text-align: center;
}

.btn-expand-product {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: #4a5568;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-expand-product:hover {
  background: #e2e8f0;
  color: #2d3748;
}

.btn-expand-product.loading {
  pointer-events: none;
}

.expand-spinner {
  animation: spin 1s linear infinite;
  display: inline-block;
}

/* 产品行展开状态 */
.product-row.expanded {
  background: #ebf8ff !important;
  border-left: 3px solid #3182ce;
}

/* 产品交易详情展开区域 */
.product-transactions-row {
  background: #f8fafc;
}

/* 产品间的视觉分隔 */
.product-transactions-row td {
  border-bottom: 3px solid #cbd5e0 !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.transactions-cell {
  padding: 0 !important;
}

.product-transactions-container {
  padding: 16px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.transactions-header-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 8px;
}

.product-detail-title {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
}

/* 交易记录表格样式 */
.transactions-table-wrapper {
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.transaction-header {
  display: grid;
  grid-template-columns: 60px 100px minmax(120px, 1fr) 60px 80px 80px 70px minmax(90px, 1.2fr) minmax(80px, 1fr) 70px 80px 90px;
  background: #f7fafc;
  border-bottom: 2px solid #e2e8f0;
  font-weight: 600;
  font-size: 13px;
  color: #4a5568;
}

.transaction-header .header-cell {
  padding: 10px 6px;
  display: flex;
  align-items: center;
  border-right: 1px solid #e2e8f0;
  white-space: nowrap;
}

.transaction-row {
  display: grid;
  grid-template-columns: 60px 100px minmax(120px, 1fr) 60px 80px 80px 70px minmax(90px, 1.2fr) minmax(80px, 1fr) 70px 80px 90px;
  border-bottom: 1px solid #e2e8f0;
  transition: background-color 0.2s;
  font-size: 13px;
}

.transaction-row:last-child {
  border-bottom: none;
}

.transaction-row:hover {
  background: #f7fafc;
}

.transaction-row.has-doc:hover {
  background: #edf2f7;
}

.transaction-row.IN {
  background: linear-gradient(90deg, rgba(72, 187, 120, 0.08) 0%, transparent 100%);
}

.transaction-row.OUT {
  background: linear-gradient(90deg, rgba(245, 101, 101, 0.08) 0%, transparent 100%);
}

.transaction-row .table-cell {
  padding: 10px 6px;
  display: flex;
  align-items: center;
  border-right: 1px solid #e2e8f0;
}

/* 单位标签样式 - 区分供应商和领用部门 */
.unit-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.unit-tag.supplier {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.unit-tag.department {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1e40af;
  border: 1px solid #93c5fd;
}

.transaction-type-badge {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
}

.transaction-type-badge.IN {
  background: #c6f6d5;
  color: #22543d;
}

.transaction-type-badge.OUT {
  background: #fed7d7;
  color: #742a2a;
}

/* 单号列样式 */
.document-number-text {
  font-size: 13px;
  color: #1a202c;
  font-weight: 600;
}

/* 查看单据按钮 */
.btn-view-doc {
  padding: 4px 10px;
  font-size: 13px;
  background: #3182ce;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-view-doc:hover {
  background: #2c5282;
}

.no-transactions {
  padding: 24px;
  text-align: center;
  color: #718096;
  font-size: 14px;
}

/* 图片预览遮罩层 */
.image-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: pointer;
}

.image-preview-hint {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
}

.image-preview-info {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  padding: 8px 20px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
}

.preview-image {
  max-width: 95vw;
  max-height: 85vh;
  object-fit: contain;
  cursor: default;
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}
</style>
