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
      <div class="search-section">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索产品名称、条码或类别..."
            class="search-input"
            @input="performSearch"
          />
          <button class="search-btn">🔍</button>
        </div>
      </div>
      <div class="filter-section">
        <select v-model="selectedCategory" @change="filterProducts" class="filter-select">
          <option value="">所有类别</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
        <select v-model="stockFilter" @change="filterProducts" class="filter-select">
          <option value="">所有库存</option>
          <option value="low">低库存</option>
          <option value="out">零库存</option>
          <option value="normal">正常库存</option>
        </select>
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
                  {{ product.stock }}
                </span>
              </div>
            </td>
            <td class="price">
              <span class="price-value">¥{{ (product.price || 0).toFixed(2) }}</span>
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
              <label class="form-label">类别</label>
              <select v-model="productForm.category_id" class="form-control">
                <option value="">选择类别</option>
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
                  :readonly="editingProduct !== null"
                  :title="editingProduct ? '库存数量只能通过出库入库操作修改' : ''"
                  required
                >
                <div v-if="editingProduct" class="field-note">库存数量只能通过出库入库操作修改</div>
              </div>
              <div class="form-group">
                <label class="form-label">最小库存 *</label>
                <input v-model.number="productForm.min_stock" type="number" class="form-control" min="0" required>
              </div>
            </div>
            <div class="form-group">
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
              <span class="stock-value">{{ selectedProduct?.stock }}</span>
            </div>
            <div v-if="selectedProduct?.price" class="current-price">
              <span>当前单价: </span>
              <span class="price-value">¥{{ selectedProduct.price.toFixed(2) }}</span>
            </div>
          </div>
          <form @submit.prevent="executeStockOperation">
            <div class="form-group">
              <label class="form-label">{{ stockOperation === 'IN' ? '入库' : '出库' }}数量 *</label>
              <input v-model.number="stockQuantity" type="number" class="form-control" min="1" required>
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
                <input v-model.number="unitPrice" type="number" class="form-control" min="0" step="0.01" placeholder="0.00">
                <div v-if="unitPrice && stockQuantity" class="calculated-total">
                  总价值: ¥{{ (unitPrice * stockQuantity).toFixed(2) }}
                </div>
              </div>
              
              <div v-if="priceInputMode === 'total'" class="form-group">
                <label class="form-label">总价值 (¥)</label>
                <input v-model.number="totalValue" type="number" class="form-control" min="0" step="0.01" placeholder="0.00">
                <div v-if="totalValue && stockQuantity" class="calculated-unit">
                  单价: ¥{{ (totalValue / stockQuantity).toFixed(2) }}
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
                <label class="form-label">用途说明</label>
                <input v-model="purpose" type="text" class="form-control">
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

export default {
  name: 'InventoryPage',
  components: {
    BarcodeDisplay
  },
  setup() {
    const inventoryStore = useInventoryStore()
    
    // Reactive data
    const searchQuery = ref('')
    const selectedCategory = ref('')
    const stockFilter = ref('')
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
    
    // Price-related variables
    const priceInputMode = ref('unit') // 'unit' 或 'total'
    const unitPrice = ref(0)
    const totalValue = ref(0)
    
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
    
    const filteredProducts = computed(() => {
      let filtered = products.value
      
      // Search filter
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = filtered.filter(product => 
          product.name.toLowerCase().includes(query) ||
          product.barcode.includes(query) ||
          (product.category_name && product.category_name.toLowerCase().includes(query))
        )
      }
      
      // Category filter
      if (selectedCategory.value) {
        filtered = filtered.filter(product => product.category_id === selectedCategory.value)
      }
      
      // Stock filter
      if (stockFilter.value) {
        switch (stockFilter.value) {
          case 'low':
            filtered = filtered.filter(product => product.stock <= product.min_stock && product.stock > 0)
            break
          case 'out':
            filtered = filtered.filter(product => product.stock === 0)
            break
          case 'normal':
            filtered = filtered.filter(product => product.stock > product.min_stock)
            break
        }
      }
      
      // Pagination
      const start = (currentPage.value - 1) * itemsPerPage.value
      const end = start + itemsPerPage.value
      return filtered.slice(start, end)
    })
    
    const totalPages = computed(() => {
      let totalItems = products.value.length
      
      // Apply filters for total count
      if (searchQuery.value || selectedCategory.value || stockFilter.value) {
        let filtered = products.value
        
        if (searchQuery.value) {
          const query = searchQuery.value.toLowerCase()
          filtered = filtered.filter(product => 
            product.name.toLowerCase().includes(query) ||
            product.barcode.includes(query) ||
            (product.category_name && product.category_name.toLowerCase().includes(query))
          )
        }
        
        if (selectedCategory.value) {
          filtered = filtered.filter(product => product.category_id === selectedCategory.value)
        }
        
        if (stockFilter.value) {
          switch (stockFilter.value) {
            case 'low':
              filtered = filtered.filter(product => product.stock <= product.min_stock && product.stock > 0)
              break
            case 'out':
              filtered = filtered.filter(product => product.stock === 0)
              break
            case 'normal':
              filtered = filtered.filter(product => product.stock > product.min_stock)
              break
          }
        }
        
        totalItems = filtered.length
      }
      
      return Math.ceil(totalItems / itemsPerPage.value)
    })
    
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
    
    const saveProduct = async () => {
      try {
        if (editingProduct.value) {
          await inventoryStore.updateProduct(editingProduct.value.id, productForm.value)
          showToast('产品更新成功', 'success')
        } else {
          await inventoryStore.createProduct(productForm.value)
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
    })
    
    return {
      searchQuery,
      selectedCategory,
      stockFilter,
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
      saveProduct,
      quickStockIn,
      quickStockOut,
      closeStockModal,
      executeStockOperation,
      deleteProduct
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
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.search-section {
  flex: 1;
  max-width: 400px;
}

.search-box {
  display: flex;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: none;
  outline: none;
  font-size: 14px;
}

.search-btn {
  padding: 8px 12px;
  background: #edf2f7;
  border: none;
  cursor: pointer;
  font-size: 14px;
}

.filter-section {
  display: flex;
  gap: 12px;
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
