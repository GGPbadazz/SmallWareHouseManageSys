<template>
  <div class="reports-page">
    <!-- Compact Header with Stats and Filters -->
    <div class="reports-compact-header">
      <!-- Title and Stats Row -->
      <div class="header-row">
        <div class="reports-title-compact">
          <h2>报告中心</h2>
          <button class="btn btn-outline btn-sm" @click="refreshDashboardStats">
            <span>🔄</span>
            刷新
          </button>
        </div>
        
        <!-- Compact Dashboard Statistics -->
        <div class="dashboard-stats-compact">
          <div class="stat-item">
            <span class="stat-icon">📦</span>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalProducts }}</div>
              <div class="stat-label">产品</div>
            </div>
          </div>
          <div class="stat-item warning">
            <span class="stat-icon">⚠️</span>
            <div class="stat-info">
              <div class="stat-value">{{ stats.lowStockItems }}</div>
              <div class="stat-label">低库存</div>
            </div>
          </div>
          <div class="stat-item">
            <span class="stat-icon">📈</span>
            <div class="stat-info">
              <div class="stat-value">{{ stats.todayTransactions }}</div>
              <div class="stat-label">今日交易</div>
            </div>
          </div>
          <div class="stat-item">
            <span class="stat-icon">💰</span>
            <div class="stat-info">
              <div class="stat-value">¥{{ (stats.totalValue / 10000).toFixed(1) }}万</div>
              <div class="stat-label">库存总值</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Filters Row -->
      <div class="filters-row">
        <!-- 报告类型按钮组 -->
        <div class="filter-group-buttons">
          <label class="filter-label-compact">类型</label>
          <div class="button-group">
            <button 
              v-for="type in reportTypes" 
              :key="type.value"
              :class="['filter-btn', { active: reportType === type.value }]"
              @click.stop="selectReportType(type.value)"
            >
              {{ type.label }}
            </button>
          </div>
        </div>
        
        <!-- 时间范围按钮组 -->
        <div class="filter-group-buttons">
          <label class="filter-label-compact">范围</label>
          <div class="button-group">
            <button 
              v-for="range in timeRanges" 
              :key="range.value"
              :class="['filter-btn', { active: timeRange === range.value }]"
              @click="selectTimeRange(range.value)"
            >
              {{ range.label }}
            </button>
          </div>
        </div>
        
        <!-- 日期输入 -->
        <div class="filter-group-compact">
          <label class="filter-label-compact">开始</label>
          <input v-model="startDate" type="date" class="filter-input-compact" @change="loadReportData">
        </div>
        <div class="filter-group-compact">
          <label class="filter-label-compact">结束</label>
          <input v-model="endDate" type="date" class="filter-input-compact" @change="loadReportData">
        </div>
      </div>
    </div>

    <!-- Report Content -->
    <div class="report-content">
      <!-- Inventory Report -->
      <div v-if="reportType === 'inventory'" class="report-section">
        <div class="section-header">
          <h3>库存报告</h3>
          <div class="header-actions">
            <button class="btn btn-success btn-sm" @click="exportInventoryExcel">
              <span>📊</span>
              下载库存报告
            </button>
          </div>
        </div>
        <div class="inventory-summary">
          <div class="summary-card">
            <div class="summary-label">总产品数</div>
            <div class="summary-value">{{ stats.totalProducts }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">库存总值</div>
            <div class="summary-value">¥{{ (stats.totalValue / 10000).toFixed(1) }}万</div>
          </div>
          <div class="summary-card warning">
            <div class="summary-label">低库存产品</div>
            <div class="summary-value">{{ stats.lowStockItems }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">零库存产品</div>
            <div class="summary-value">{{ (inventoryStore.products || []).filter(p => p.stock === 0).length }}</div>
          </div>
        </div>
        <div class="alert alert-info">
          <strong>💡 提示:</strong> 点击"下载库存报告"按钮可以下载包含所有产品库存、单价和总价的Excel文件。
        </div>
      </div>

      <!-- Transactions Report -->
      <div v-if="reportType === 'transactions'" class="report-section">
        <div class="section-header">
          <h3>交易报告</h3>
        </div>
        <div class="transaction-summary">
          <div class="summary-card">
            <div class="summary-label">总交易数</div>
            <div class="summary-value">{{ transactionSummary.total }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">入库交易</div>
            <div class="summary-value text-success">{{ transactionSummary.inbound }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">出库交易</div>
            <div class="summary-value text-danger">{{ transactionSummary.outbound }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">交易金额</div>
            <div class="summary-value">¥{{ transactionSummary.totalValue.toLocaleString() }}</div>
          </div>
        </div>
        
        <!-- 使用与主页面相同的交易记录格式 -->
        <div class="transactions-list-container">
          <!-- 表头 -->
          <div class="transaction-header">
            <div class="header-cell type">类型</div>
            <div class="header-cell product">产品信息</div>
            <div class="header-cell datetime">操作时间</div>
            <div class="header-cell quantity">数量</div>
            <div class="header-cell unit-price">出入库单价</div>
            <div class="header-cell total-price">出入库总价</div>
            <div class="header-cell requester">领料人</div>
            <div class="header-cell project">领用单位/部门</div>
            <div class="header-cell purpose">用途说明</div>
            <div class="header-cell current-stock">交易后库存</div>
            <div class="header-cell stock-unit-price">库存单价</div>
            <div class="header-cell stock-value">库存价值</div>
          </div>
          
          <!-- 数据行 -->
          <div 
            v-for="transaction in paginatedTransactions" 
            :key="transaction.id"
            class="transaction-row"
            :class="transaction.type"
          >
            <div class="table-cell type">
              <span class="transaction-type-badge" :class="transaction.type">
                {{ transaction.type === 'IN' ? '入库' : '出库' }}
              </span>
            </div>
            <div class="table-cell product">
              <div class="product-info">
                <div class="product-name">{{ transaction.product_name }}</div>
                <div class="product-code">{{ transaction.barcode || '-' }}</div>
              </div>
            </div>
            <div class="table-cell datetime">
              <div class="datetime-info">
                {{ formatDateTime(transaction.created_at) }}
              </div>
            </div>
            <div class="table-cell quantity">
              <span class="quantity-value">{{ formatQuantity(transaction.quantity) }}</span>
            </div>
            <div class="table-cell unit-price">
              <span class="price-value">¥{{ formatPrice(transaction.unit_price) }}</span>
            </div>
            <div class="table-cell total-price">
              <span class="price-value total">¥{{ formatPrice(transaction.total_price) }}</span>
            </div>
            <div class="table-cell requester">
              <span class="requester-name">{{ transaction.requester_name || '-' }}</span>
            </div>
            <div class="table-cell project">
              <span class="project-name">{{ transaction.project_name || '-' }}</span>
            </div>
            <div class="table-cell purpose">
              <span class="purpose-text">{{ transaction.purpose || '-' }}</span>
            </div>
            <div class="table-cell current-stock">
              <span class="stock-value" :class="{ 'low-stock': transaction.stock_after <= 5 }">
                {{ formatQuantity(transaction.stock_after || 0) }}
              </span>
            </div>
            <div class="table-cell stock-unit-price">
              <span class="price-value stock-unit">¥{{ formatPrice(transaction.stock_unit_price) }}</span>
            </div>
            <div class="table-cell stock-value">
              <span class="price-value stock">¥{{ formatPrice(transaction.stock_value) }}</span>
            </div>
          </div>
          
          <!-- 分页控件 -->
          <div class="pagination-container" v-if="totalPages > 1">
            <div class="pagination-info">
              显示第 {{ (currentPage - 1) * pageSize + 1 }}-{{ Math.min(currentPage * pageSize, transactionReport.length) }} 条，
              共 {{ transactionReport.length }} 条记录
            </div>
            <div class="pagination-controls">
              <button 
                class="pagination-btn"
                :disabled="currentPage === 1"
                @click="currentPage = 1"
              >
                首页
              </button>
              <button 
                class="pagination-btn"
                :disabled="currentPage === 1"
                @click="currentPage--"
              >
                上一页
              </button>
              <span class="pagination-numbers">
                <button 
                  v-for="page in visiblePages"
                  :key="page"
                  class="pagination-btn"
                  :class="{ active: page === currentPage }"
                  @click="currentPage = page"
                >
                  {{ page }}
                </button>
              </span>
              <button 
                class="pagination-btn"
                :disabled="currentPage === totalPages"
                @click="currentPage++"
              >
                下一页
              </button>
              <button 
                class="pagination-btn"
                :disabled="currentPage === totalPages"
                @click="currentPage = totalPages"
              >
                尾页
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Low Stock Report -->
      <div v-if="reportType === 'lowstock'" class="report-section">
        <div class="section-header">
          <h3>低库存报告</h3>
        </div>
        <div class="alert alert-warning">
          <strong>⚠️ 注意:</strong> 以下产品库存已达到最低库存警告线，请及时补货。
        </div>
        <div class="report-table-container">
          <table class="report-table">
            <thead>
              <tr>
                <th>产品名称</th>
                <th>类别</th>
                <th>当前库存</th>
                <th>最小库存</th>
                <th>缺货数量</th>
                <th>供应商</th>
                <th>紧急程度</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedLowStockReport" :key="item.id">
                <td class="product-name">{{ item.name }}</td>
                <td>{{ item.category_name }}</td>
                <td class="stock-value danger">{{ formatQuantity(item.stock) }}</td>
                <td class="min-stock">{{ formatQuantity(item.min_stock) }}</td>
                <td class="shortage">{{ formatQuantity(Math.max(0, item.min_stock - item.stock)) }}</td>
                <td>{{ item.supplier || '-' }}</td>
                <td>
                  <span 
                    class="urgency-badge" 
                    :class="getUrgencyLevel(item.stock, item.min_stock)"
                  >
                    {{ getUrgencyText(item.stock, item.min_stock) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- 低库存报告分页控件 -->
        <div class="pagination-container" v-if="lowStockTotalPages > 1">
          <div class="pagination-info">
            显示第 {{ (lowStockCurrentPage - 1) * lowStockPageSize + 1 }}-{{ Math.min(lowStockCurrentPage * lowStockPageSize, lowStockReport.length) }} 条，
            共 {{ lowStockReport.length }} 条记录
          </div>
          <div class="pagination-controls">
            <button 
              class="pagination-btn"
              :disabled="lowStockCurrentPage === 1"
              @click="lowStockCurrentPage = 1"
            >
              首页
            </button>
            <button 
              class="pagination-btn"
              :disabled="lowStockCurrentPage === 1"
              @click="lowStockCurrentPage--"
            >
              上一页
            </button>
            <span class="pagination-numbers">
              <button 
                v-for="page in lowStockVisiblePages"
                :key="page"
                class="pagination-btn"
                :class="{ active: page === lowStockCurrentPage }"
                @click="lowStockCurrentPage = page"
              >
                {{ page }}
              </button>
            </span>
            <button 
              class="pagination-btn"
              :disabled="lowStockCurrentPage === lowStockTotalPages"
              @click="lowStockCurrentPage++"
            >
              下一页
            </button>
            <button 
              class="pagination-btn"
              :disabled="lowStockCurrentPage === lowStockTotalPages"
              @click="lowStockCurrentPage = lowStockTotalPages"
            >
              尾页
            </button>
          </div>
        </div>
      </div>

      <!-- Categories Report -->
      <div v-if="reportType === 'categories'" class="report-section">
        <div class="section-header">
          <h3>分类报告</h3>
        </div>
        <div class="category-grid">
          <div v-for="category in categoryReport" :key="category.id" class="category-card">
            <div class="category-header">
              <h4>{{ category.name }}</h4>
              <span class="category-count">{{ category.product_count }} 产品</span>
            </div>
            <div class="category-stats">
              <div class="category-stat">
                <span class="stat-label">总库存</span>
                <span class="stat-value">{{ formatQuantity(category.total_stock) }}</span>
              </div>
              <div class="category-stat">
                <span class="stat-label">库存价值</span>
                <span class="stat-value">¥{{ category.total_value.toLocaleString() }}</span>
              </div>
              <div class="category-stat">
                <span class="stat-label">低库存</span>
                <span class="stat-value danger">{{ category.low_stock_count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useInventoryStore } from '@/stores/inventory'
import * as XLSX from 'xlsx'

export default {
  name: 'ReportsPage',
  setup() {
    const inventoryStore = useInventoryStore()
    
    // 报告类型选项
    const reportTypes = [
      { value: 'transactions', label: '交易' },
      { value: 'inventory', label: '库存' },
      { value: 'lowstock', label: '低库存' },
      { value: 'categories', label: '分类' }
    ]
    
    // 时间范围选项
    const timeRanges = [
      { value: 'today', label: '今天' },
      { value: 'week', label: '本周' },
      { value: 'month', label: '本月' },
      { value: 'quarter', label: '本季度' },
      { value: 'year', label: '本年' }
    ]
    
    // Reactive data
    const reportType = ref('transactions')
    const timeRange = ref('month')
    const startDate = ref('')
    const endDate = ref('')
    const inventoryReport = ref([])
    const transactionReport = ref([])
    const lowStockReport = ref([])
    const categoryReport = ref([])
    
    // 分页相关数据
    const currentPage = ref(1)
    const pageSize = ref(20)
    
    // 低库存报告分页数据
    const lowStockCurrentPage = ref(1)
    const lowStockPageSize = ref(20)
    
    // Computed properties
    const stats = computed(() => {
      // 使用从数据库同步的统计数据，包括增长率
      const dbStats = inventoryStore.stats
      return {
        totalProducts: dbStats.totalProducts || 0,
        lowStockItems: dbStats.lowStockItems || 0,
        todayTransactions: dbStats.todayTransactions || 0,
        totalValue: dbStats.totalValue || 0,
        monthlyChange: dbStats.monthlyChange || 0,
        transactionGrowth: dbStats.transactionGrowth || 0,
        valueGrowth: dbStats.valueGrowth || 0
      }
    })
    
    const transactionSummary = computed(() => {
      const transactions = transactionReport.value
      return {
        total: transactions.length,
        inbound: transactions.filter(t => t.type === 'IN').length,
        outbound: transactions.filter(t => t.type === 'OUT').length,
        totalValue: transactions.reduce((sum, t) => sum + (t.total_price || t.quantity * (t.unit_price || 10)), 0)
      }
    })
    
    // 分页计算属性
    const totalPages = computed(() => {
      return Math.ceil(transactionReport.value.length / pageSize.value)
    })
    
    const paginatedTransactions = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value
      const end = start + pageSize.value
      return transactionReport.value.slice(start, end)
    })
    
    const visiblePages = computed(() => {
      const total = totalPages.value
      const current = currentPage.value
      const delta = 2
      
      const range = []
      const start = Math.max(1, current - delta)
      const end = Math.min(total, current + delta)
      
      for (let i = start; i <= end; i++) {
        range.push(i)
      }
      
      return range
    })
    
    // 低库存报告分页计算属性
    const lowStockTotalPages = computed(() => {
      return Math.ceil(lowStockReport.value.length / lowStockPageSize.value)
    })
    
    const paginatedLowStockReport = computed(() => {
      const start = (lowStockCurrentPage.value - 1) * lowStockPageSize.value
      const end = start + lowStockPageSize.value
      return lowStockReport.value.slice(start, end)
    })
    
    const lowStockVisiblePages = computed(() => {
      const total = lowStockTotalPages.value
      const current = lowStockCurrentPage.value
      const delta = 2
      
      const range = []
      const start = Math.max(1, current - delta)
      const end = Math.min(total, current + delta)
      
      for (let i = start; i <= end; i++) {
        range.push(i)
      }
      
      return range
    })
    
    // Methods
    const selectReportType = (type) => {
      console.log('Button clicked! Type:', type)
      console.log('Current reportType before change:', reportType.value)
      reportType.value = type
      console.log('Current reportType after change:', reportType.value)
      loadReportData()
    }
    
    const selectTimeRange = (range) => {
      timeRange.value = range
      handleTimeRangeChange()
    }
    
    const handleTimeRangeChange = () => {
      const today = new Date()
      
      // 本地日期格式化函数，避免时区问题
      const formatLocalDate = (date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      
      switch (timeRange.value) {
        case 'today':
          // 今天
          startDate.value = formatLocalDate(today)
          endDate.value = formatLocalDate(today)
          break
          
        case 'week':
          // 本周：周一到周日
          const currentDay = today.getDay() // 0=周日, 1=周一, ..., 6=周六
          const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay // 计算到周一的偏移
          
          const monday = new Date(today)
          monday.setDate(today.getDate() + mondayOffset)
          
          const sunday = new Date(monday)
          sunday.setDate(monday.getDate() + 6)
          
          startDate.value = formatLocalDate(monday)
          endDate.value = formatLocalDate(sunday)
          break
          
        case 'month':
          // 本月：当月第一天到最后一天
          const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
          const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
          
          startDate.value = formatLocalDate(firstDayOfMonth)
          endDate.value = formatLocalDate(lastDayOfMonth)
          break
          
        case 'quarter':
          // 本季度
          const currentQuarter = Math.floor(today.getMonth() / 3)
          const quarterStartMonth = currentQuarter * 3
          const quarterStart = new Date(today.getFullYear(), quarterStartMonth, 1)
          const quarterEnd = new Date(today.getFullYear(), quarterStartMonth + 3, 0)
          
          startDate.value = formatLocalDate(quarterStart)
          endDate.value = formatLocalDate(quarterEnd)
          break
          
        case 'year':
          // 本年
          const yearStart = new Date(today.getFullYear(), 0, 1)
          const yearEnd = new Date(today.getFullYear(), 11, 31)
          
          startDate.value = formatLocalDate(yearStart)
          endDate.value = formatLocalDate(yearEnd)
          break
          
        default:
          // 保持当前设置的日期不变
          break
      }
      
      // 时间范围变化后重新加载报告数据
      loadReportData()
    }
    
    const loadReportData = async () => {
      try {
        console.log('Loading report data for type:', reportType.value)
        // 重置分页
        currentPage.value = 1
        lowStockCurrentPage.value = 1
        
        switch (reportType.value) {
          case 'inventory':
            // 库存报告需要确保数据可用于导出
            console.log('Loading inventory data, products count:', inventoryStore.products?.length || 0)
            inventoryReport.value = inventoryStore.products || []
            break
          case 'transactions':
            // 对于交易报告，加载所有数据，不再限制条数
            await loadAllTransactions()
            break
          case 'lowstock':
            lowStockReport.value = inventoryStore.lowStockProducts || []
            break
          case 'categories':
            await loadCategoryReport()
            break
        }
      } catch (error) {
        console.error('Failed to load report data:', error)
      }
    }
    
    const loadAllTransactions = async () => {
      try {
        // 构建查询参数
        const params = new URLSearchParams()
        if (startDate.value) params.append('start_date', startDate.value)
        if (endDate.value) params.append('end_date', endDate.value)
        // 设置一个大的限制值来获取所有数据
        params.append('limit', '10000')
        params.append('offset', '0')
        
        const response = await fetch(`/api/transactions?${params.toString()}`)
        const data = await response.json()
        
        if (response.ok) {
          transactionReport.value = data.transactions || []
        } else {
          console.error('Failed to load transactions:', data.error)
          transactionReport.value = []
        }
      } catch (error) {
        console.error('Failed to load transactions:', error)
        transactionReport.value = []
      }
    }
    
    const loadCategoryReport = async () => {
      try {
        const categories = inventoryStore.categories
        const products = inventoryStore.products
        
        categoryReport.value = categories.map(category => {
          const categoryProducts = products.filter(p => p.category_id === category.id)
          return {
            ...category,
            product_count: categoryProducts.length,
            total_stock: categoryProducts.reduce((sum, p) => sum + p.stock, 0),
            total_value: categoryProducts.reduce((sum, p) => sum + (p.total_cost_value || 0), 0),
            low_stock_count: categoryProducts.filter(p => p.stock <= p.min_stock).length
          }
        })
      } catch (error) {
        console.error('Failed to load category report:', error)
      }
    }
    
    const exportInventoryExcel = () => {
      const data = inventoryStore.products
      
      if (!data || data.length === 0) {
        showMessage('没有库存数据可导出', 'warning')
        return
      }
      
      // 准备Excel数据 - 使用产品表的实时数据（由最新交易维护）
      const excelData = data.map(product => {
        // 使用产品表的当前数据（已由最新交易更新）
        const unitPrice = product.current_unit_price || product.price || 0;
        const totalValue = product.total_cost_value || 0;
        
        return {
          '产品名称': product.name || '-',
          '产品编码': product.barcode || '-',
          '类别': product.category_name || '-',
          '当前库存': parseFloat(formatQuantity(product.stock || 0)),
          '最小库存': parseFloat(formatQuantity(product.min_stock || 0)),
          '库存单价': unitPrice,
          '库存总价': totalValue,
          '库存状态': product.stock === 0 ? '缺货' : product.stock <= product.min_stock ? '低库存' : '正常',
          '供应商': product.supplier || '-'
        };
      })
      
      // 创建工作簿
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelData)
      
      // 设置列宽
      const colWidths = [
        { wch: 25 }, // 产品名称
        { wch: 15 }, // 产品编码
        { wch: 12 }, // 类别
        { wch: 10 }, // 当前库存
        { wch: 10 }, // 最小库存
        { wch: 12 }, // 库存单价
        { wch: 12 }, // 库存总价
        { wch: 10 }, // 库存状态
        { wch: 15 }  // 供应商
      ]
      ws['!cols'] = colWidths
      
      // 添加工作表
      XLSX.utils.book_append_sheet(wb, ws, '库存报告')
      
      // 生成文件名
      const filename = `库存报告_${formatDateForFile(new Date())}.xlsx`
      
      // 下载Excel文件
      XLSX.writeFile(wb, filename)
      
      showMessage('Excel导出成功', 'success')
    }
    
    const getStockStatus = (stock, minStock) => {
      if (stock === 0) return 'danger'
      if (stock <= minStock) return 'warning'
      return 'success'
    }
    
    const getStockStatusText = (stock, minStock) => {
      if (stock === 0) return '缺货'
      if (stock <= minStock) return '低库存'
      return '正常'
    }
    
    const getUrgencyLevel = (stock, minStock) => {
      if (stock === 0) return 'critical'
      if (stock <= minStock / 2) return 'high'
      return 'medium'
    }
    
    const getUrgencyText = (stock, minStock) => {
      if (stock === 0) return '紧急'
      if (stock <= minStock / 2) return '高'
      return '中'
    }
    
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString('zh-CN')
    }
    
    const formatDateTime = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    const formatPrice = (price) => {
      if (typeof price !== 'number') price = 0
      
      // 检查是否为整数
      if (price === Math.floor(price)) {
        return price.toString()
      }
      
      // 对于小数，保持原始精度，但最多显示4位小数，移除末尾的0
      const str = price.toString()
      if (str.includes('.')) {
        // 如果原始数据有小数点，保持其精度（最多4位）
        const [integer, decimal] = str.split('.')
        const trimmedDecimal = decimal.substring(0, 4).replace(/0+$/, '')
        return trimmedDecimal ? integer + '.' + trimmedDecimal : integer
      }
      
      return str
    }
    
    const formatQuantity = (quantity) => {
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
    
    const formatDateForFile = (date) => {
      return date.toISOString().split('T')[0]
    }
    
    const showMessage = (message, type = 'info') => {
      const messageEl = document.createElement('div')
      messageEl.className = `message message-${type}`
      messageEl.textContent = message
      messageEl.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 9999;
        background: ${type === 'success' ? '#38a169' : type === 'error' ? '#e53e3e' : '#3182ce'};
        animation: slideIn 0.3s ease;
      `
      
      document.body.appendChild(messageEl)
      setTimeout(() => messageEl.remove(), 3000)
    }
    
    // Initialize dates
    const initializeDates = () => {
      // 设置默认时间范围为"本月"，然后调用时间范围处理函数
      timeRange.value = 'month'
      handleTimeRangeChange()
    }
    
    // Load data on mount
    onMounted(() => {
      console.log('Component mounted, loading initial data...')
      inventoryStore.loadInitialData().then(() => {
        console.log('Initial data loaded, initializing dates and loading report data...')
        initializeDates() // 先初始化日期
        loadReportData() // 加载报告数据
        // 确保统计数据是最新的
        refreshDashboardStats()
      })
    })
    
    // 刷新看板统计数据
    const refreshDashboardStats = async () => {
      try {
        await inventoryStore.loadStats()
        console.log('Dashboard stats refreshed:', inventoryStore.stats)
      } catch (error) {
        console.error('Failed to refresh dashboard stats:', error)
      }
    }
    
    return {
      reportTypes,
      timeRanges,
      reportType,
      timeRange,
      startDate,
      endDate,
      inventoryReport,
      transactionReport,
      lowStockReport,
      categoryReport,
      stats,
      transactionSummary,
      // 分页相关
      currentPage,
      pageSize,
      totalPages,
      paginatedTransactions,
      visiblePages,
      // 低库存分页相关
      lowStockCurrentPage,
      lowStockPageSize,
      lowStockTotalPages,
      paginatedLowStockReport,
      lowStockVisiblePages,
      selectReportType,
      selectTimeRange,
      handleTimeRangeChange,
      loadReportData,
      exportInventoryExcel,
      getStockStatus,
      getStockStatusText,
      getUrgencyLevel,
      getUrgencyText,
      formatDate,
      formatDateTime,
      formatPrice,
      formatQuantity,
      refreshDashboardStats,
      inventoryStore
    }
  }
}
</script>

<style scoped>
/* Same styling structure as inventory page but with report-specific adjustments */
.reports-page {
  padding: 16px;
}

/* Compact Header Layout */
.reports-compact-header {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 16px;
  overflow: hidden;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.reports-title-compact {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reports-title-compact h2 {
  margin: 0;
  color: #2d3748;
  font-size: 18px;
}

/* Compact Stats */
.dashboard-stats-compact {
  display: flex;
  gap: 24px;
  align-items: center;
  flex-wrap: wrap;
  flex: 1;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: #f7fafc;
  border-radius: 6px;
  border-left: 3px solid #4299e1;
  min-width: 140px;
  flex: 1;
}

.stat-item.warning {
  border-left-color: #e53e3e;
}

.stat-item .stat-icon {
  font-size: 20px;
  min-width: 20px;
}

.stat-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  flex: 1;
}

.stat-info .stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #2d3748;
  line-height: 1.1;
  white-space: nowrap;
}

.stat-info .stat-label {
  font-size: 12px;
  color: #4a5568;
  line-height: 1;
  margin-top: 3px;
  white-space: nowrap;
}

/* Compact Filters */
.filters-row {
  display: flex;
  gap: 20px;
  padding: 12px 16px;
  background: #f7fafc;
  align-items: center;
  flex-wrap: wrap;
}

.filter-group-compact {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-group-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label-compact {
  font-size: 12px;
  font-weight: 500;
  color: #4a5568;
  white-space: nowrap;
  margin-right: 4px;
}

.button-group {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
}

.filter-btn {
  flex: 1;
  padding: 12px 20px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #4a5568;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  text-align: center;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-btn:hover {
  background: #f7fafc;
  border-color: #cbd5e0;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.filter-btn.active {
  background: #3182ce;
  color: white;
  border-color: #3182ce;
  box-shadow: 0 2px 8px rgba(49, 130, 206, 0.3);
}

.filter-btn.active:hover {
  background: #2c5aa0;
  border-color: #2c5aa0;
}

.filter-select-compact,
.filter-input-compact {
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 12px;
  min-width: 80px;
  height: 32px;
}

.filter-select-compact {
  min-width: 90px;
}

.filter-input-compact {
  min-width: 110px;
}

/* Original styles for content areas */
.reports-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.reports-title h2 {
  margin: 0;
  color: #2d3748;
}

.reports-title p {
  margin: 4px 0 0 0;
  color: #718096;
}

.reports-actions {
  display: flex;
  gap: 12px;
}

.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-left: 4px solid #4299e1;
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-card.warning {
  border-left-color: #e53e3e;
}

.stat-icon {
  font-size: 32px;
  opacity: 0.8;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #2d3748;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #4a5568;
  margin-bottom: 4px;
}

.stat-change {
  font-size: 12px;
  font-weight: 500;
}

.stat-change.positive {
  color: #48bb78;
}

.stat-change.negative {
  color: #e53e3e;
}

.report-filters {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-label {
  font-size: 14px;
  font-weight: 500;
  color: #4a5568;
}

.filter-select,
.filter-input {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  min-width: 120px;
}

.report-content {
  margin-bottom: 40px;
}

.report-section {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
}

.section-header h3 {
  margin: 0;
  color: #2d3748;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.header-actions .btn {
  display: flex;
  align-items: center;
  gap: 4px;
}

.transaction-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 16px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
}

.summary-card {
  text-align: center;
  padding: 16px;
  background: white;
  border-radius: 8px;
}

.summary-label {
  font-size: 12px;
  color: #718096;
  margin-bottom: 4px;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
  color: #2d3748;
}

.summary-value.text-success {
  color: #38a169;
}

.summary-value.text-danger {
  color: #e53e3e;
}

.report-table-container {
  overflow-x: auto;
  border-radius: 8px;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1200px;
}

.report-table th {
  background: #f7fafc;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #4a5568;
  border-bottom: 1px solid #e2e8f0;
}

.report-table td {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.success {
  background: #c6f6d5;
  color: #2f855a;
}

.status-badge.warning {
  background: #feebc8;
  color: #c05621;
}

.status-badge.danger {
  background: #fed7d7;
  color: #c53030;
}

.urgency-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.urgency-badge.critical {
  background: #fed7d7;
  color: #c53030;
}

.urgency-badge.high {
  background: #feebc8;
  color: #c05621;
}

.urgency-badge.medium {
  background: #fefcbf;
  color: #975a16;
}

.transaction-type {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.transaction-type.in {
  background: #c6f6d5;
  color: #2f855a;
}

.transaction-type.out {
  background: #fed7d7;
  color: #c53030;
}

.transaction-type-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  display: inline-block;
}

.transaction-type-badge.type-in {
  background: #c6f6d5;
  color: #2f855a;
}

.transaction-type-badge.type-out {
  background: #fed7d7;
  color: #c53030;
}

.product-info {
  min-width: 150px;
}

.product-info .product-name {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 2px;
}

.product-info .product-code {
  font-size: 11px;
  color: #718096;
  font-family: monospace;
}

.unit-price, .total-price, .stock-value {
  font-weight: 600;
  color: #2d3748;
  text-align: right;
}

.current-stock {
  font-weight: 600;
  color: #38a169;
  text-align: center;
}

.requester, .project, .purpose {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  padding: 16px;
}

.category-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.category-header h4 {
  margin: 0;
  color: #2d3748;
}

.category-count {
  font-size: 12px;
  color: #718096;
}

.category-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-stat .stat-label {
  font-size: 14px;
  color: #4a5568;
}

.category-stat .stat-value {
  font-weight: 600;
  color: #2d3748;
}

.category-stat .stat-value.danger {
  color: #e53e3e;
}

.alert {
  padding: 12px;
  border-radius: 6px;
  margin: 16px;
}

.alert-warning {
  background: #fefcbf;
  color: #975a16;
  border: 1px solid #f6e05e;
}

.alert-info {
  background: #bee3f8;
  color: #2c5282;
  border: 1px solid #90cdf4;
}

/* 库存报告摘要样式 */
.inventory-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin: 16px 0;
}

.inventory-summary .summary-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.inventory-summary .summary-card.warning {
  border-color: #f6ad55;
  background: #fffaf0;
}

.inventory-summary .summary-label {
  font-size: 14px;
  color: #4a5568;
  margin-bottom: 8px;
}

.inventory-summary .summary-value {
  font-size: 24px;
  font-weight: 700;
  color: #2d3748;
}

.btn {
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 11px;
}

.btn-primary {
  background: #3182ce;
  color: white;
}

.btn-secondary {
  background: #4a5568;
  color: white;
}

.btn-outline {
  background: white;
  color: #4a5568;
  border: 1px solid #e2e8f0;
}

.btn-success {
  background: #38a169;
  color: white;
}

.btn-danger {
  background: #e53e3e;
  color: white;
}

.btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.product-name {
  font-weight: 600;
  color: #2d3748;
}

.stock-value {
  font-weight: 600;
  color: #38a169;
}

.stock-value.danger {
  color: #e53e3e;
}

.timestamp {
  font-size: 12px;
  color: #718096;
}

@media (max-width: 768px) {
  .reports-page {
    padding: 12px;
  }
  
  .header-row {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .reports-title-compact {
    width: 100%;
    justify-content: space-between;
  }
  
  .dashboard-stats-compact {
    width: 100%;
    flex-wrap: wrap;
    gap: 16px;
  }
  
  .stat-item {
    flex: 1;
    min-width: calc(50% - 8px);
    max-width: calc(50% - 8px);
  }
  
  .filters-row {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .filter-group-buttons {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  
  .button-group {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  
  .filter-btn {
    padding: 14px 12px;
    font-size: 13px;
    min-height: 48px;
    text-align: center;
  }
  
  .filter-group-compact {
    width: 100%;
    justify-content: space-between;
  }
  
  .filter-select-compact,
  .filter-input-compact {
    flex: 1;
    min-width: 0;
  }
  
  .reports-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .dashboard-stats {
    grid-template-columns: 1fr;
  }
  
  .report-filters {
    flex-direction: column;
    gap: 12px;
  }
  
  .category-grid {
    grid-template-columns: 1fr;
  }
}

/* 交易列表样式 - 与主页面保持一致 */
.transactions-list-container {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.transaction-header {
  display: grid;
  grid-template-columns: 60px 1fr 140px 60px 80px 90px 100px 120px 150px 80px 90px 100px;
  background: #f8fafc;
  border-bottom: 2px solid #e5e7eb;
  font-weight: 600;
  font-size: 12px;
  color: #374151;
}

.transaction-row {
  display: grid;
  grid-template-columns: 60px 1fr 140px 60px 80px 90px 100px 120px 150px 80px 90px 100px;
  border-bottom: 1px solid #f3f4f6;
  transition: all 0.2s ease;
}

.transaction-row:hover {
  background: #f9fafb;
}

.transaction-row.IN {
  border-left: 3px solid #10b981;
}

.transaction-row.OUT {
  border-left: 3px solid #ef4444;
}

.transaction-row:last-child {
  border-bottom: none;
}

.header-cell,
.table-cell {
  padding: 8px 6px;
  display: flex;
  align-items: center;
  font-size: 13px;
  border-right: 1px solid #f3f4f6;
}

.header-cell:last-child,
.table-cell:last-child {
  border-right: none;
}

.header-cell {
  font-weight: 600;
  color: #6b7280;
  text-align: center;
  justify-content: center;
}

.transaction-type-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  min-width: 40px;
}

.transaction-type-badge.IN {
  background: #dcfce7;
  color: #166534;
}

.transaction-type-badge.OUT {
  background: #fee2e2;
  color: #991b1b;
}

.product-info {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.product-name {
  font-weight: 500;
  color: #111827;
  font-size: 13px;
  line-height: 1.2;
}

.product-code {
  font-size: 11px;
  color: #6b7280;
  font-family: 'Courier New', monospace;
}

.datetime-info {
  font-size: 11px;
  color: #6b7280;
  line-height: 1.3;
}

.quantity-value {
  font-weight: 600;
  color: #2563eb;
}

.price-value {
  font-weight: 500;
  color: #059669;
}

.price-value.total {
  font-weight: 600;
  color: #dc2626;
}

.price-value.stock-unit {
  color: #7c3aed;
  font-weight: 600;
}

.price-value.stock {
  color: #059669;
  font-weight: 600;
}

.requester-name,
.project-name,
.purpose-text {
  font-size: 12px;
  color: #374151;
}

.stock-value {
  font-weight: 600;
  color: #059669;
}

.stock-value.low-stock {
  color: #dc2626;
  background: #fee2e2;
  padding: 2px 6px;
  border-radius: 4px;
}

/* 分页样式 */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f8fafc;
  border-top: 1px solid #e5e7eb;
}

.pagination-info {
  font-size: 14px;
  color: #6b7280;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination-btn {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.pagination-btn:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.pagination-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.pagination-numbers {
  display: flex;
  gap: 4px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .transaction-header,
  .transaction-row {
    grid-template-columns: 50px 1fr 120px 50px 70px 80px 90px 100px 130px 70px 80px 90px;
    font-size: 11px;
  }
  
  .header-cell,
  .table-cell {
    padding: 6px 4px;
  }
}

@media (max-width: 768px) {
  .transaction-header,
  .transaction-row {
    grid-template-columns: 40px 1fr 100px 40px 60px 70px 80px 90px 110px 60px 70px 80px;
    font-size: 10px;
  }
  
  .header-cell,
  .table-cell {
    padding: 4px 2px;
  }
  
  .pagination-container {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
