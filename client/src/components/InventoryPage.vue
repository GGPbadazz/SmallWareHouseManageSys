<template>
  <div class="inventory-page">
    <!-- Header with search and actions -->
    <div class="inventory-header">
      <div class="inventory-title">
        <h3>库存管理</h3>
      </div>
      <div class="inventory-actions">
        <button class="btn btn-primary" @click="showAddProductModal">
          <span>➕</span>
          添加产品
        </button>
      </div>
    </div>

    <!-- 统计概览（从ScannerPage迁移） -->
    <div class="grid grid-cols-4 mb-3">
      <div class="card">
        <div class="stat-card">
          <div class="stat-number">{{ stats.totalProducts }}</div>
          <div class="stat-label">总产品数</div>
        </div>
      </div>
      <div class="card">
        <div class="stat-card">
          <div class="stat-number">{{ stats.lowStockItems }}</div>
          <div class="stat-label">低库存警告</div>
        </div>
      </div>
      <div class="card">
        <div class="stat-card">
          <div class="stat-number">{{ stats.todayTransactions }}</div>
          <div class="stat-label">今日交易</div>
        </div>
      </div>
      <div class="card">
        <div class="stat-card">
          <div class="stat-number">¥{{ stats.totalValue.toLocaleString() }}</div>
          <div class="stat-label">库存总值</div>
        </div>
      </div>
    </div>

    <!-- Search and filters -->
    <div class="inventory-filters">
      <!-- 第一行：搜索栏和库存状态 -->
      <div class="filter-row-top">
        <div class="search-section">
          <div class="search-box">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索产品名称、条码或类别（支持拼音，如：qiufa、qf）..."
              class="search-input"
              @input="performSearch"
            />
            <button class="search-btn">🔍</button>
          </div>
        </div>
        
        <!-- 库存状态复选框区域 -->
        <div class="filter-group filter-group-stock">
          <div class="filter-checkboxes filter-checkboxes-inline">
            <label class="checkbox-label">
              <input
                type="checkbox"
                value="low"
                v-model="stockFilters"
                @change="filterProducts"
                class="filter-checkbox"
              />
              <span class="checkbox-text">🟡 低库存</span>
            </label>
            <label class="checkbox-label">
              <input
                type="checkbox"
                value="out"
                v-model="stockFilters"
                @change="filterProducts"
                class="filter-checkbox"
              />
              <span class="checkbox-text">🔴 零库存</span>
            </label>
            <label class="checkbox-label">
              <input
                type="checkbox"
                value="normal"
                v-model="stockFilters"
                @change="filterProducts"
                class="filter-checkbox"
              />
              <span class="checkbox-text">🟢 正常库存</span>
            </label>
          </div>
        </div>
      </div>
      
      <!-- 第二行：类别筛选 -->
      <div class="filter-row-bottom">
        <div class="filter-group filter-group-category">
          <div class="filter-checkboxes filter-checkboxes-category">
            <label 
              v-for="category in categories" 
              :key="category.id" 
              class="checkbox-label"
            >
              <input
                type="checkbox"
                :value="category.id"
                v-model="selectedCategories"
                @change="filterProducts"
                class="filter-checkbox"
              />
              <span class="checkbox-text">{{ category.name }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Products table -->
    <div class="inventory-table-container">
      <table class="inventory-table">
        <thead>
          <tr>
            <th>产品信息</th>
            <th>类别</th>
            <th>条码</th>
            <th>库存数量</th>
            <th>单价</th>
            <th>库存价值</th>
            <th>最小库存</th>
            <th>位置</th>
            <th>供应商</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in filteredProducts" :key="product.id" class="product-row">
            <td class="product-info">
              <div class="product-name">{{ product.name }}</div>
              <div class="product-description">{{ product.description }}</div>
            </td>
            <td>
              <span class="category-badge">{{ product.category_name || '未分类' }}</span>
            </td>
            <td class="barcode">{{ product.barcode }}</td>
            <td>
              <div class="stock-info">
                <span 
                  class="stock-value" 
                  :class="{ 
                    'low-stock': product.stock <= product.min_stock,
                    'out-of-stock': product.stock === 0
                  }"
                >
                  {{ product.stock % 1 === 0 ? product.stock : product.stock.toFixed(3).replace(/\.?0+$/, '') }}
                </span>
              </div>
            </td>
            <td class="price">
              <span class="price-value">¥{{ formatPrice(product.price || 0) }}</span>
            </td>
            <td class="inventory-value">
              <span class="value-amount">¥{{ formatPrice(product.total_cost_value || 0) }}</span>
            </td>
            <td class="min-stock">{{ product.min_stock }}</td>
            <td class="location">{{ product.location || '-' }}</td>
            <td class="supplier">{{ product.supplier || '-' }}</td>
            <td class="actions">
              <button 
                class="btn btn-sm btn-outline" 
                @click="showBarcodeInfo(product)"
                title="查看条码信息"
              >
                🏷️
              </button>
              <button 
                class="btn btn-sm btn-outline" 
                @click="editProduct(product)"
                title="编辑产品"
              >
                ✏️
              </button>
              <button 
                class="btn btn-sm btn-success" 
                @click="quickStockIn(product)"
                title="快速入库"
              >
                ⬆️
              </button>
              <button 
                class="btn btn-sm btn-warning" 
                @click="quickStockOut(product)"
                title="快速出库"
              >
                ⬇️
              </button>
              <button 
                class="btn btn-sm btn-danger" 
                @click="deleteProduct(product)"
                :disabled="product.stock > 0"
                :title="product.stock > 0 ? '产品有库存时无法删除' : '删除产品'"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      
      <!-- Empty state -->
      <div v-if="filteredProducts.length === 0" class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div class="empty-state-text">暂无产品</div>
        <div class="empty-state-subtext">
          {{ searchQuery ? '未找到匹配的产品' : '点击上方按钮添加产品' }}
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="totalPages > 1">
      <button 
        class="btn btn-outline" 
        @click="currentPage--" 
        :disabled="currentPage === 1"
      >
        上一页
      </button>
      <span class="page-info">
        第 {{ currentPage }} 页，共 {{ totalPages }} 页
      </span>
      <button 
        class="btn btn-outline" 
        @click="currentPage++" 
        :disabled="currentPage === totalPages"
      >
        下一页
      </button>
    </div>

    <!-- Add/Edit Product Modal -->
    <div v-if="showProductModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingProduct ? '编辑产品' : '添加产品' }}</h3>
          <button class="modal-close" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveProduct">
            <div class="form-group">
              <label class="form-label">产品名称 *</label>
              <input v-model="productForm.name" type="text" class="form-control" required>
            </div>
            <div class="form-group">
              <label class="form-label">英文名称</label>
              <input v-model="productForm.name_en" type="text" class="form-control">
            </div>
            <div class="form-group">
              <label class="form-label">条码</label>
              <input v-model="productForm.barcode" type="text" class="form-control">
            </div>
            <div class="form-group">
              <label class="form-label">类别 *</label>
              <select v-model="productForm.category_id" class="form-control" required>
                <option value="">请选择类别</option>
                <option v-for="category in categories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">描述</label>
              <textarea v-model="productForm.description" class="form-control" rows="3"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">当前库存 *</label>
                <input 
                  v-model.number="productForm.stock" 
                  type="number" 
                  :class="editingProduct ? 'form-control readonly-field' : 'form-control'" 
                  min="0" 
                  step="0.001"
                  :readonly="editingProduct !== null"
                  :title="editingProduct ? '库存数量只能通过出库入库操作修改' : ''"
                  required
                >
                <div v-if="editingProduct" class="field-note">库存数量只能通过出库入库操作修改</div>
              </div>
              <div class="form-group">
                <label class="form-label">最小库存 *</label>
                <input v-model.number="productForm.min_stock" type="number" class="form-control" min="0" step="0.001" required>
              </div>
            </div>
            
            <!-- 价格输入区域 - 根据是否为新产品显示不同内容 -->
            <div v-if="editingProduct" class="form-group">
              <label class="form-label">单价 (¥)</label>
              <input 
                v-model.number="productForm.price" 
                type="number" 
                class="form-control readonly-field" 
                min="0" 
                step="0.01" 
                placeholder="0.00"
                readonly
                title="单价由系统根据入库记录自动计算加权平均值"
              >
              <div class="field-note">单价由系统根据入库记录自动计算加权平均值，不可手动修改</div>
            </div>
            
            <!-- 新产品价格输入区域 -->
            <div v-else class="pricing-section-new-product">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">库存总价 (¥)</label>
                  <input 
                    type="number" 
                    class="form-control price-input" 
                    :value="newProductTotalPrice || ''" 
                    min="0" 
                    step="0.01"
                    placeholder="请输入库存总价"
                    @input="handleNewProductTotalPriceInput($event.target.value)"
                  />
                  <small class="form-help">请输入这批库存的总价值，系统将自动计算单价</small>
                </div>
              </div>
              
              <!-- 实时计算显示 -->
                            <!-- 实时计算显示 -->
              <div v-if="productForm.stock > 0 && newProductTotalPrice > 0" class="price-calculation-display">
                <div class="calculation-result">
                  <div class="calculation-item">
                    <span class="calculation-label">计算单价:</span>
                    <span class="calculation-value">¥{{ formatPrice(calculatedNewProductUnitPrice) }}</span>
                  </div>
                  <div class="calculation-separator">×</div>
                  <div class="calculation-item">
                    <span class="calculation-label">库存:</span>
                    <span class="calculation-value">{{ productForm.stock }}</span>
                  </div>
                  <div class="calculation-separator">=</div>
                  <div class="calculation-item">
                    <span class="calculation-label">总价:</span>
                    <span class="calculation-value total">¥{{ formatPrice(newProductTotalPrice) }}</span>
                  </div>
                </div>
              </div>
              
              <div class="field-note">
                💡 提示：设置初始库存和价格后，系统将自动创建初始入库记录
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">存储位置</label>
                <input v-model="productForm.location" type="text" class="form-control">
              </div>
              <div class="form-group">
                <label class="form-label">供应商</label>
                <input v-model="productForm.supplier" type="text" class="form-control">
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-outline" @click="closeModal">取消</button>
              <button type="submit" class="btn btn-primary">保存</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Quick Stock Modal -->
    <div v-if="showStockModal" class="modal-overlay" @click="closeStockModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ stockOperation === 'IN' ? '快速入库' : '快速出库' }} - {{ selectedProduct?.name }}</h3>
          <button class="modal-close" @click="closeStockModal">×</button>
        </div>
        <div class="modal-body">
          <div class="stock-info-display">
            <div class="current-stock">
              <span>当前库存: </span>
              <span class="stock-value">{{ selectedProduct?.stock % 1 === 0 ? selectedProduct?.stock : selectedProduct?.stock.toFixed(3).replace(/\.?0+$/, '') }}</span>
            </div>
            <div v-if="selectedProduct?.price" class="current-price">
              <span>当前单价: </span>
              <span class="price-value">¥{{ formatPrice(selectedProduct.price) }}</span>
            </div>
          </div>
          <form @submit.prevent="executeStockOperation">
            <div class="form-group">
              <label class="form-label">{{ stockOperation === 'IN' ? '入库' : '出库' }}数量 *</label>
              <input v-model.number="stockQuantity" type="number" class="form-control" min="0.001" step="0.001" required>
            </div>
            
            <!-- 入库时显示价格字段 -->
            <div v-if="stockOperation === 'IN'" class="pricing-section">
              <div class="form-group">
                <label class="form-label">价格输入方式</label>
                <div class="radio-group">
                  <label class="radio-option">
                    <input type="radio" v-model="priceInputMode" value="unit" name="priceMode">
                    <span>按单价</span>
                  </label>
                  <label class="radio-option">
                    <input type="radio" v-model="priceInputMode" value="total" name="priceMode">
                    <span>按总价</span>
                  </label>
                </div>
              </div>
              
              <div v-if="priceInputMode === 'unit'" class="form-group">
                <label class="form-label">单价 (¥)</label>
                <input v-model.number="unitPrice" type="number" class="form-control" min="0" step="0.0001" placeholder="0.0000">
                <div v-if="unitPrice && stockQuantity" class="calculated-total">
                  总价值: ¥{{ formatPrice(unitPrice * stockQuantity) }}
                </div>
              </div>
              
              <div v-if="priceInputMode === 'total'" class="form-group">
                <label class="form-label">总价值 (¥)</label>
                <input v-model.number="totalValue" type="number" class="form-control" min="0" step="0.0001" placeholder="0.0000">
                <div v-if="totalValue && stockQuantity" class="calculated-unit">
                  单价: ¥{{ formatPrice(totalValue / stockQuantity) }}
                </div>
              </div>
            </div>
            
            <div v-if="stockOperation === 'OUT'" class="requisition-section">
              <div class="form-group">
                <label class="form-label">领料人 *</label>
                <input v-model="requesterName" type="text" class="form-control" required>
              </div>
              <div class="form-group">
                <label class="form-label">部门/工号</label>
                <input v-model="requesterDepartment" type="text" class="form-control">
              </div>
              <div class="form-group">
                <label class="form-label">用途说明 *</label>
                <input v-model="purpose" type="text" class="form-control" required placeholder="请输入出库用途说明（必填）">
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-outline" @click="closeStockModal">取消</button>
              <button type="submit" class="btn btn-primary">确认{{ stockOperation === 'IN' ? '入库' : '出库' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
    <!-- Barcode Display Modal -->
    <BarcodeDisplay 
      :show="showBarcodeModal"
      :product="selectedBarcodeProduct"
      @close="closeBarcodeModal"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useInventoryStore } from '@/stores/inventory'
import { showToast } from '@/utils/index'
import BarcodeDisplay from './BarcodeDisplay.vue'
import { pinyinUtils } from '@/utils/pinyin'

export default {
  name: 'InventoryPage',
  components: {
    BarcodeDisplay
  },
  setup() {
    const inventoryStore = useInventoryStore()
    
    // Reactive data
    const searchQuery = ref('')
    const selectedCategories = ref([])  // 改为数组，支持多选
    const stockFilters = ref([])  // 改为数组，支持多选
    const currentPage = ref(1)
    const itemsPerPage = ref(20)
    const showProductModal = ref(false)
    const showStockModal = ref(false)
    const showBarcodeModal = ref(false)
    const editingProduct = ref(null)
    const selectedProduct = ref(null)
    const selectedBarcodeProduct = ref(null)
    const stockOperation = ref('IN')
    const stockQuantity = ref(1)
    const requesterName = ref('')
    const requesterDepartment = ref('')
    const purpose = ref('')
    
    // Price-related variables (for quick stock operations)
    const priceInputMode = ref('unit') // 'unit' 或 'total'
    const unitPrice = ref(0)
    const totalValue = ref(0)
    
    // Price-related variables for new product form - only total price mode
    const newProductTotalPrice = ref(0)
    
    // Product form
    const productForm = ref({
      name: '',
      name_en: '',
      barcode: '',
      category_id: '',
      description: '',
      stock: 0,
      min_stock: 0,
      price: 0,
      location: '',
      supplier: ''
    })
    
    // Computed properties
    const products = computed(() => inventoryStore.products)
    const categories = computed(() => inventoryStore.categories)
    const stats = computed(() => inventoryStore.stats)
    
    // 全选状态
    const allCategoriesSelected = computed(() => {
      return selectedCategories.value.length === categories.value.length
    })
    
    const allStockFiltersSelected = computed(() => {
      return stockFilters.value.length === 3
    })
    
    // 切换全选/取消全选
    const toggleAllCategories = () => {
      if (allCategoriesSelected.value) {
        selectedCategories.value = []
      } else {
        selectedCategories.value = categories.value.map(cat => cat.id)
      }
      filterProducts()
    }
    
    const toggleAllStockFilters = () => {
      if (allStockFiltersSelected.value) {
        stockFilters.value = []
      } else {
        stockFilters.value = ['low', 'out', 'normal']
      }
      filterProducts()
    }
    
    const filteredProducts = computed(() => {
      let filtered = products.value
      
      // Search filter with pinyin support
      if (searchQuery.value) {
        const query = searchQuery.value.trim()
        const isEnglishInput = /^[a-zA-Z]+$/.test(query)
        
        if (isEnglishInput) {
          // Pinyin search
          filtered = filtered.filter(product => {
            const nameMatch = pinyinUtils.isMatch(product.name, query)
            const categoryMatch = product.category_name && pinyinUtils.isMatch(product.category_name, query)
            const barcodeMatch = product.barcode && product.barcode.toLowerCase().includes(query.toLowerCase())
            
            return nameMatch || categoryMatch || barcodeMatch
          })
          
          // Sort by pinyin match score for better results
          filtered = filtered.sort((a, b) => {
            const scoreA = pinyinUtils.getMatchScore(a.name, query) + 
                          (a.category_name ? pinyinUtils.getMatchScore(a.category_name, query) : 0)
            const scoreB = pinyinUtils.getMatchScore(b.name, query) + 
                          (b.category_name ? pinyinUtils.getMatchScore(b.category_name, query) : 0)
            return scoreB - scoreA
          })
        } else {
          // Regular search
          const lowerQuery = query.toLowerCase()
          filtered = filtered.filter(product => 
            product.name.toLowerCase().includes(lowerQuery) ||
            (product.barcode && product.barcode.toLowerCase().includes(lowerQuery)) ||
            (product.category_name && product.category_name.toLowerCase().includes(lowerQuery))
          )
        }
      }
      
      // Category filter - 支持多选
      if (selectedCategories.value.length > 0 && selectedCategories.value.length < categories.value.length) {
        filtered = filtered.filter(product => selectedCategories.value.includes(product.category_id))
      }
      
      // Stock filter - 支持多选
      if (stockFilters.value.length > 0 && stockFilters.value.length < 3) {
        filtered = filtered.filter(product => {
          return stockFilters.value.some(filter => {
            switch (filter) {
              case 'low':
                return product.stock <= product.min_stock && product.stock > 0
              case 'out':
                return product.stock === 0
              case 'normal':
                return product.stock > product.min_stock
              default:
                return false
            }
          })
        })
      }
      
      // Pagination
      const start = (currentPage.value - 1) * itemsPerPage.value
      const end = start + itemsPerPage.value
      return filtered.slice(start, end)
    })
    
    const totalPages = computed(() => {
      let totalItems = products.value.length
      
      // Apply filters for total count
      if (searchQuery.value || (selectedCategories.value.length > 0 && selectedCategories.value.length < categories.value.length) || (stockFilters.value.length > 0 && stockFilters.value.length < 4)) {
        let filtered = products.value
        
        if (searchQuery.value) {
          const query = searchQuery.value.trim()
          const isEnglishInput = /^[a-zA-Z]+$/.test(query)
          
          if (isEnglishInput) {
            // Pinyin search for total count
            filtered = filtered.filter(product => {
              const nameMatch = pinyinUtils.isMatch(product.name, query)
              const categoryMatch = product.category_name && pinyinUtils.isMatch(product.category_name, query)
              const barcodeMatch = product.barcode && product.barcode.toLowerCase().includes(query.toLowerCase())
              
              return nameMatch || categoryMatch || barcodeMatch
            })
          } else {
            // Regular search for total count
            const lowerQuery = query.toLowerCase()
            filtered = filtered.filter(product => 
              product.name.toLowerCase().includes(lowerQuery) ||
              (product.barcode && product.barcode.toLowerCase().includes(lowerQuery)) ||
              (product.category_name && product.category_name.toLowerCase().includes(lowerQuery))
            )
          }
        }
        
        if (selectedCategories.value.length > 0 && selectedCategories.value.length < categories.value.length) {
          filtered = filtered.filter(product => selectedCategories.value.includes(product.category_id))
        }
        
        if (stockFilters.value.length > 0 && stockFilters.value.length < 4) {
          filtered = filtered.filter(product => {
            return stockFilters.value.some(filter => {
              switch (filter) {
                case 'all':
                  return true
                case 'low':
                  return product.stock <= product.min_stock && product.stock > 0
                case 'out':
                  return product.stock === 0
                case 'normal':
                  return product.stock > product.min_stock
                default:
                  return true
              }
            })
          })
        }
        
        totalItems = filtered.length
      }
      
      return Math.ceil(totalItems / itemsPerPage.value)
    })
    
    // Computed properties for new product price calculation
    const calculatedNewProductUnitPrice = computed(() => {
      if (productForm.value.stock > 0 && newProductTotalPrice.value > 0) {
        return (newProductTotalPrice.value / productForm.value.stock).toFixed(4).replace(/\.?0+$/, '')
      }
      return '0'
    })
    
    // Price formatting function
    const formatPrice = (value) => {
      if (!value || isNaN(value)) return '0'
      // 显示数据库原值，不强制格式化
      return parseFloat(value).toString().replace(/\.?0+$/, '')
    }
    
    // Methods
    const performSearch = () => {
      currentPage.value = 1
    }
    
    const filterProducts = () => {
      currentPage.value = 1
    }
    
    const showAddProductModal = () => {
      editingProduct.value = null
      productForm.value = {
        name: '',
        name_en: '',
        barcode: '',
        category_id: '',
        description: '',
        stock: 0,
        min_stock: 0,
        price: 0,
        location: '',
        supplier: ''
      }
      // Reset new product price variables - only total price
      newProductTotalPrice.value = 0
      showProductModal.value = true
    }
    
    const editProduct = (product) => {
      editingProduct.value = product
      productForm.value = {
        name: product.name,
        name_en: product.name_en || '',
        barcode: product.barcode,
        category_id: product.category_id,
        description: product.description || '',
        stock: product.stock,
        min_stock: product.min_stock,
        price: product.price || 0,
        location: product.location || '',
        supplier: product.supplier || ''
      }
      showProductModal.value = true
    }
    
    const closeModal = () => {
      showProductModal.value = false
      editingProduct.value = null
    }
    
    const showBarcodeInfo = (product) => {
      selectedBarcodeProduct.value = product
      showBarcodeModal.value = true
    }
    
    const closeBarcodeModal = () => {
      showBarcodeModal.value = false
      selectedBarcodeProduct.value = null
    }
    
    // New product price handling method - only total price
    const handleNewProductTotalPriceInput = (value) => {
      newProductTotalPrice.value = parseFloat(value) || 0
    }
    
    const saveProduct = async () => {
      try {
        // 验证新产品必须选择有效的类别
        if (!editingProduct.value) {
          const categoryId = parseInt(productForm.value.category_id)
          if (!categoryId || categoryId <= 0) {
            showToast('请选择有效的产品类别', 'error')
            return
          }
          
          // 检查类别是否在可用类别列表中
          const categoryExists = categories.value.find(cat => cat.id === categoryId)
          if (!categoryExists) {
            showToast('所选类别不存在，请重新选择', 'error')
            return
          }
        }
        
        if (editingProduct.value) {
          await inventoryStore.updateProduct(editingProduct.value.id, productForm.value)
          showToast('产品更新成功', 'success')
        } else {
          // For new products, create the product first with zero stock
          const productDataForCreation = {
            ...productForm.value,
            stock: 0,  // 创建产品时不设置库存，避免重复入库
            current_unit_price: 0,
            total_cost_value: 0
          }
          
          const newProduct = await inventoryStore.createProduct(productDataForCreation)
          
          // If there's stock and total price information, create an initial stock transaction
          if (productForm.value.stock > 0 && newProductTotalPrice.value > 0) {
            const transactionData = {
              product_id: newProduct.id,
              type: 'IN',
              quantity: productForm.value.stock,
              requester_name: '创建产品入库',
              purpose: '新产品初始库存',
              total_value: newProductTotalPrice.value
            }
            
            // Create the initial stock transaction
            await inventoryStore.createTransaction(transactionData)
          }
          
          showToast('产品添加成功', 'success')
        }
        closeModal()
      } catch (error) {
        showToast('操作失败: ' + error.message, 'error')
      }
    }
    
    const quickStockIn = (product) => {
      selectedProduct.value = product
      stockOperation.value = 'IN'
      stockQuantity.value = 1
      requesterName.value = ''
      requesterDepartment.value = ''
      purpose.value = ''
      showStockModal.value = true
    }
    
    const quickStockOut = (product) => {
      selectedProduct.value = product
      stockOperation.value = 'OUT'
      stockQuantity.value = 1
      requesterName.value = ''
      requesterDepartment.value = ''
      purpose.value = ''
      showStockModal.value = true
    }
    
    const closeStockModal = () => {
      showStockModal.value = false
      selectedProduct.value = null
      stockQuantity.value = 1
      requesterName.value = ''
      requesterDepartment.value = ''
      purpose.value = ''
      priceInputMode.value = 'unit'
      unitPrice.value = 0
      totalValue.value = 0
    }
    
    const executeStockOperation = async () => {
      try {
        // 出库时验证用途说明是否填写
        if (stockOperation.value === 'OUT' && (!purpose.value || purpose.value.trim() === '')) {
          showToast('出库时必须填写用途说明', 'error')
          return
        }

        const transactionData = {
          product_id: selectedProduct.value.id,
          type: stockOperation.value,
          quantity: stockQuantity.value,
          requester_name: requesterName.value || null,
          requester_department: requesterDepartment.value || null,
          purpose: purpose.value || null
        }
        
        // 添加价格信息（仅入库时）
        if (stockOperation.value === 'IN') {
          if (priceInputMode.value === 'unit' && unitPrice.value) {
            transactionData.unit_price = unitPrice.value
          } else if (priceInputMode.value === 'total' && totalValue.value) {
            transactionData.total_value = totalValue.value
          }
        }
        
        await inventoryStore.createTransaction(transactionData)
        showToast(`${stockOperation.value === 'IN' ? '入库' : '出库'}操作成功`, 'success')
        closeStockModal()
      } catch (error) {
        showToast('操作失败: ' + error.message, 'error')
      }
    }
    
    const deleteProduct = async (product) => {
      // 检查产品是否有库存
      if (product.stock > 0) {
        showToast(`无法删除产品 "${product.name}"：产品还有 ${product.stock} 件库存`, 'error')
        return
      }
      
      if (confirm(`确定要删除产品 "${product.name}" 吗？此操作无法撤销。`)) {
        try {
          await inventoryStore.deleteProduct(product.id)
          showToast('产品删除成功', 'success')
        } catch (error) {
          showToast('删除失败: ' + error.message, 'error')
        }
      }
    }
    
    // Load data on mount
    onMounted(() => {
      inventoryStore.loadInitialData()
      
      // 初始化类别选择：默认选中所有类别，除了“一次性”
      setTimeout(() => {
        const allCategoryIds = inventoryStore.categories
          .filter(cat => cat.name !== '一次性')
          .map(cat => cat.id)
        selectedCategories.value = allCategoryIds
      }, 100)
    })
    
    return {
      searchQuery,
      selectedCategories,
      allCategoriesSelected,
      toggleAllCategories,
      stockFilters,
      allStockFiltersSelected,
      toggleAllStockFilters,
      currentPage,
      showProductModal,
      showStockModal,
      showBarcodeModal,
      editingProduct,
      selectedProduct,
      selectedBarcodeProduct,
      stockOperation,
      stockQuantity,
      requesterName,
      requesterDepartment,
      purpose,
      priceInputMode,
      unitPrice,
      totalValue,
      newProductTotalPrice,
      calculatedNewProductUnitPrice,
      productForm,
      products,
      categories,
      stats,
      filteredProducts,
      totalPages,
      performSearch,
      filterProducts,
      showAddProductModal,
      editProduct,
      closeModal,
      showBarcodeInfo,
      closeBarcodeModal,
      handleNewProductTotalPriceInput,
      saveProduct,
      quickStockIn,
      quickStockOut,
      closeStockModal,
      executeStockOperation,
      deleteProduct,
      formatPrice
    }
  }
}
</script>

<style scoped>
.inventory-page {
  padding: 12px;
}

.inventory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.inventory-title h3 {
  margin: 0;
  color: #2d3748;
  font-size: 1.25rem;
  font-weight: 600;
}

.inventory-actions {
  display: flex;
  gap: 12px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.stat-card {
  padding: 12px;
  text-align: center;
}

.stat-number {
  font-size: 20px;
  font-weight: 600;
  color: #2d3748;
}

.stat-label {
  font-size: 12px;
  color: #718096;
  margin-top: 2px;
}

.inventory-filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

/* 第一行：搜索和库存状态 */
.filter-row-top {
  display: flex;
  gap: 16px;
  align-items: stretch;
}

/* 第二行：类别筛选 */
.filter-row-bottom {
  display: flex;
}

.search-section {
  flex: 1;
  min-width: 0;
}

.search-box {
  display: flex;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
  background: white;
  height: 100%;
}

.search-input {
  flex: 1;
  padding: 8px 14px;
  border: none;
  outline: none;
  font-size: 15px;
}

.search-btn {
  padding: 8px 14px;
  background: #edf2f7;
  border: none;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

.search-btn:hover {
  background: #e2e8f0;
}

/* 筛选区域统一样式 */
.filter-group {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 14px;
  transition: box-shadow 0.2s;
}

.filter-group-stock {
  flex-shrink: 0;
  min-width: 380px;
}

.filter-group-category {
  flex: 1;
  width: 100%;
}

.filter-group:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.filter-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e2e8f0;
}

.filter-title {
  font-weight: 600;
  font-size: 15px;
  color: #2d3748;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-link {
  background: none;
  border: none;
  color: #3b82f6;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  font-weight: 500;
}

.btn-link:hover {
  background-color: #eff6ff;
  transform: translateY(-1px);
}

.filter-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 2px;
}

.filter-checkboxes-inline {
  max-height: none;
  overflow: visible;
}

.filter-checkboxes-category {
  gap: 12px;
}

/* 滚动条美化 */
.filter-checkboxes::-webkit-scrollbar {
  width: 6px;
}

.filter-checkboxes::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.filter-checkboxes::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 3px;
}

.filter-checkboxes::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  cursor: pointer;
  border-radius: 5px;
  transition: all 0.2s;
  font-size: 15px;
  white-space: nowrap;
  background-color: #f7fafc;
  border: 1px solid transparent;
}

.checkbox-label:hover {
  background-color: #edf2f7;
  border-color: #cbd5e0;
  transform: translateY(-1px);
}

.filter-checkbox {
  cursor: pointer;
  width: 20px;
  height: 20px;
  margin: 0;
  accent-color: #3b82f6;
  flex-shrink: 0;
}

.checkbox-text {
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #2d3748;
  font-weight: 500;
  font-size: 15px;
}

.filter-select {
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 13px;
}

.inventory-table-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.inventory-table {
  width: 100%;
  border-collapse: collapse;
}

.inventory-table th {
  background: #f7fafc;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #4a5568;
  border-bottom: 1px solid #e2e8f0;
  font-size: 13px;
}

.inventory-table td {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
  font-size: 13px;
}

.product-row:hover {
  background: #f7fafc;
}

.product-info {
  min-width: 180px;
}

.product-name {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 2px;
  font-size: 13px;
}

.product-description {
  font-size: 11px;
  color: #718096;
  line-height: 1.3;
}

.category-badge {
  display: inline-block;
  padding: 2px 6px;
  background: #e2e8f0;
  border-radius: 10px;
  font-size: 11px;
  color: #4a5568;
}

.barcode {
  font-family: monospace;
  font-size: 11px;
  color: #2d3748;
}

.stock-value {
  font-weight: 600;
  font-size: 14px;
  color: #38a169;
}

.stock-value.low-stock {
  color: #d69e2e;
}

.stock-value.out-of-stock {
  color: #e53e3e;
}

.actions {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.btn {
  padding: 6px 8px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
}

.btn-sm {
  padding: 3px 6px;
  font-size: 10px;
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

.btn-warning {
  background: #d69e2e;
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

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn:disabled:hover {
  opacity: 0.5;
  transform: none;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #718096;
}

.empty-state-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state-text {
  font-size: 18px;
  margin-bottom: 8px;
}

.empty-state-subtext {
  font-size: 14px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.page-info {
  font-size: 13px;
  color: #4a5568;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  color: #2d3748;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #4a5568;
}

.modal-body {
  padding: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
  color: #4a5568;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 14px;
}

.form-control:focus {
  outline: none;
  border-color: #3182ce;
  box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
}

.readonly-field {
  background-color: #f7fafc;
  color: #718096;
  cursor: not-allowed;
}

.readonly-field:focus {
  border-color: #e2e8f0;
  box-shadow: none;
}

.field-note {
  font-size: 12px;
  color: #718096;
  margin-top: 4px;
  font-style: italic;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-row .form-group {
  flex: 1;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.stock-info-display {
  background: #f7fafc;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.current-stock {
  font-size: 14px;
  color: #4a5568;
}

.requisition-section {
  background: #f7fafc;
  padding: 16px;
  border-radius: 6px;
  margin-top: 16px;
}

/* 价格相关样式 */
/* 价格相关样式 */
.pricing-section-new-product {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  background: #f8f9fa;
  margin-bottom: 16px;
}

.form-help {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #718096;
  font-style: italic;
}

.price-input {
  border: 2px solid #e2e8f0;
  transition: border-color 0.2s ease;
}

.price-input:focus {
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.price-calculation-display {
  margin-top: 12px;
  padding: 12px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.calculation-result {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.calculation-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  background: #f7fafc;
}

.calculation-item.total {
  background: #e6fffa;
  border: 1px solid #38b2ac;
}

.calculation-label {
  font-size: 12px;
  color: #718096;
  font-weight: 500;
}

.calculation-value {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
}

.calculation-item.total .calculation-value {
  color: #38b2ac;
}

.calculation-separator {
  font-size: 16px;
  font-weight: 600;
  color: #4a5568;
}

.pricing-section {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin: 16px 0;
}

.radio-group {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.radio-option input[type="radio"] {
  margin: 0;
  width: auto;
}

.calculated-total,
.calculated-unit {
  margin-top: 8px;
  padding: 8px;
  background-color: #e3f2fd;
  border-radius: 4px;
  font-weight: 500;
  color: #1976d2;
  font-size: 14px;
}

.current-price {
  margin-top: 8px;
  font-size: 14px;
  color: #4a5568;
}

.price-value {
  font-weight: 600;
  color: #2e7d32;
}

.price {
  font-weight: 500;
}

.price .price-value {
  color: #2e7d32;
}

.inventory-value {
  font-weight: 500;
}

.value-amount {
  font-weight: 600;
  color: #1976d2;
}

@media (max-width: 768px) {
  .inventory-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .inventory-filters {
    flex-direction: column;
    gap: 16px;
  }
  
  .filter-section {
    flex-direction: column;
    width: 100%;
  }
  
  .inventory-table-container {
    overflow-x: auto;
  }
  
  .inventory-table {
    min-width: 800px;
  }
}
</style>
