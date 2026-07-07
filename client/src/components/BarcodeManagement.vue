<template>
  <div class="barcode-management">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <h2>条码管理</h2>
        <p>批量生成、下载条码，管理产品条码信息</p>
      </div>
    </div>

    <!-- Action Tabs -->
    <div class="action-tabs">
      <button 
        class="tab-button"
        :class="{ active: activeTab === 'generate' }"
        @click="activeTab = 'generate'"
      >
        🎯 批量生成条码
      </button>
      <button 
        class="tab-button"
        :class="{ active: activeTab === 'sync' }"
        @click="activeTab = 'sync'"
      >
        🔄 同步条码图片
      </button>
      <button 
        class="tab-button"
        :class="{ active: activeTab === 'download' }"
        @click="activeTab = 'download'"
      >
        📥 批量下载条码
      </button>
      <button 
        class="tab-button"
        :class="{ active: activeTab === 'scan' }"
        @click="activeTab = 'scan'"
      >
        📱 扫码录入
      </button>
    </div>

    <!-- Generate Tab -->
    <div v-if="activeTab === 'generate'" class="tab-content">
      <div class="section-card">
        <div class="section-header">
          <h3>批量生成条码</h3>
          <p>为没有条码的产品批量生成条码值</p>
        </div>
        
        <div class="products-without-barcode">
          <div class="stats-summary">
            <div class="stat-item">
              <span class="stat-label">总产品数：</span>
              <span class="stat-value">{{ isLoadingProducts ? '加载中...' : products.length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">需要生成条码的产品：</span>
              <span class="stat-value">{{ isLoadingProducts ? '加载中...' : productsWithoutBarcode.length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">已有条码的产品：</span>
              <span class="stat-value">{{ isLoadingProducts ? '加载中...' : productsWithBarcode.length }}</span>
            </div>
          </div>

          <div v-if="productsWithoutBarcode.length > 0" class="product-list">
            <div class="list-header">
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  v-model="selectAll" 
                  @change="toggleSelectAll"
                />
                全选
              </label>
              <button 
                class="btn btn-primary"
                @click="batchGenerateBarcodes"
                :disabled="selectedProducts.length === 0"
              >
                为选中产品生成条码 ({{ selectedProducts.length }})
              </button>
            </div>

            <div class="product-grid">
              <div 
                v-for="product in productsWithoutBarcode" 
                :key="product.id"
                class="product-card"
              >
                <label class="product-checkbox">
                  <input 
                    type="checkbox" 
                    :value="product.id"
                    v-model="selectedProducts"
                  />
                  <div class="product-info">
                    <div class="product-name">{{ product.name }}</div>
                    <div class="product-details">
                      <span class="category">{{ product.category_name || '未分类' }}</span>
                      <span class="location">{{ product.location || '未指定位置' }}</span>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            <div class="empty-icon">✅</div>
            <div class="empty-text">所有产品都已有条码</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sync Tab -->
    <div v-if="activeTab === 'sync'" class="tab-content">
      <div class="section-card">
        <div class="section-header">
          <h3>同步条码图片</h3>
          <p>根据现有条码值重新生成条码图片，确保条码图片与条码值同步</p>
        </div>
        
        <div class="sync-info">
          <div class="info-card">
            <div class="info-icon">ℹ️</div>
            <div class="info-content">
              <div class="info-title">功能说明</div>
              <div class="info-text">
                当条码值被修改或批量导入后，条码图片可能与条码值不一致。此功能将根据当前条码值重新生成条码图片。
              </div>
            </div>
          </div>
        </div>

        <div class="products-with-barcode">
          <div class="stats-summary">
            <div class="stat-item">
              <span class="stat-label">总产品数：</span>
              <span class="stat-value">{{ products.length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">有条码的产品：</span>
              <span class="stat-value">{{ productsWithBarcode.length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">需要同步图片的产品：</span>
              <span class="stat-value">{{ productsWithBarcode.filter(p => !p.barcode_image).length }}</span>
            </div>
          </div>

          <div v-if="productsWithBarcode.length > 0" class="product-list">
            <div class="list-header">
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  v-model="selectAllForSync" 
                  @change="toggleSelectAllForSync"
                />
                全选
              </label>
              <button 
                class="btn btn-primary"
                @click="syncBarcodeImages"
                :disabled="selectedProductsForSync.length === 0"
              >
                同步条码图片 ({{ selectedProductsForSync.length }})
              </button>
            </div>

            <div class="product-grid">
              <div 
                v-for="product in productsWithBarcode" 
                :key="product.id"
                class="product-card sync-card"
              >
                <label class="product-checkbox">
                  <input 
                    type="checkbox" 
                    :value="product.id"
                    v-model="selectedProductsForSync"
                  />
                  <div class="product-info">
                    <div class="product-name">{{ product.name }}</div>
                    <div class="product-barcode">{{ product.barcode }}</div>
                    <div class="product-details">
                      <span class="category">{{ product.category_name || '未分类' }}</span>
                      <span class="location">{{ product.location || '未指定位置' }}</span>
                      <span class="barcode-status" :class="{ 'has-image': product.barcode_image }">
                        {{ product.barcode_image ? '✓ 已有条码图片' : '⚠ 需要同步' }}
                      </span>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            <div class="empty-icon">❌</div>
            <div class="empty-text">没有产品有条码</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Download Tab -->
    <div v-if="activeTab === 'download'" class="tab-content">`
      <div class="section-card">
        <div class="section-header">
          <h3>批量下载条码</h3>
          <p>选择产品批量下载条码图片</p>
        </div>

        <div class="download-options">
          <div class="option-group">
            <label class="option-label">下载格式：</label>
            <select v-model="downloadFormat" class="option-select">
              <option value="png">PNG 图片</option>
              <option value="svg">SVG 矢量图</option>
            </select>
          </div>
          
          <div class="option-group">
            <label class="option-label">条码类型：</label>
            <select v-model="barcodeType" class="option-select">
              <option value="both">条码 + 二维码</option>
              <option value="barcode">仅条码</option>
              <option value="qrcode">仅二维码</option>
            </select>
          </div>
        </div>

        <div class="product-filter">
          <div class="filter-group">
            <label class="filter-label">按类别筛选：</label>
            <select v-model="filterCategory" class="filter-select">
              <option value="">所有类别</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
          </div>
          
          <div class="filter-group">
            <label class="filter-label">搜索产品：</label>
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="输入产品名称或条码"
              class="filter-input"
            />
          </div>
        </div>

        <div class="download-products">
          <div class="stats-summary">
            <div class="stat-item">
              <span class="stat-label">可下载产品：</span>
              <span class="stat-value">{{ filteredProductsForDownload.length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">总有条码产品：</span>
              <span class="stat-value">{{ productsWithBarcode.length }}</span>
            </div>
          </div>
          
          <div class="list-header">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                v-model="selectAllForDownload" 
                @change="toggleSelectAllForDownload"
              />
              全选 ({{ filteredProductsForDownload.length }})
            </label>
            <button 
              class="btn btn-success"
              @click="batchDownloadBarcodes"
              :disabled="selectedProductsForDownload.length === 0"
            >
              批量下载 ({{ selectedProductsForDownload.length }})
            </button>
          </div>

          <div class="product-grid">
            <div 
              v-for="product in filteredProductsForDownload" 
              :key="product.id"
              class="product-card download-card"
            >
              <label class="product-checkbox">
                <input 
                  type="checkbox" 
                  :value="product.id"
                  v-model="selectedProductsForDownload"
                />
                <div class="product-info">
                  <div class="product-name">{{ product.name }}</div>
                  <div class="product-barcode">{{ product.barcode }}</div>
                  <div class="product-details">
                    <span class="category">{{ product.category_name || '未分类' }}</span>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scan Tab -->
    <div v-if="activeTab === 'scan'" class="tab-content">
      <div class="section-card">
        <div class="section-header">
          <h3>扫码录入产品</h3>
          <p>扫描条码快速录入新产品</p>
        </div>

        <div class="scan-input-section">
          <div class="scan-input-group">
            <label class="scan-label">扫描条码或手动输入：</label>
            <input 
              ref="barcodeInput"
              v-model="scannedBarcode"
              type="text"
              placeholder="请扫描条码或手动输入条码"
              class="scan-input"
              @keyup.enter="handleBarcodeInput"
              @input="onBarcodeInput"
            />
            <button 
              class="btn btn-primary"
              @click="handleBarcodeInput"
              :disabled="!scannedBarcode"
            >
              检查条码
            </button>
          </div>

          <div class="scan-tips">
            <div class="tip-item">
              <span class="tip-icon">💡</span>
              <span class="tip-text">将光标放在输入框中，然后用扫码枪扫描条码</span>
            </div>
            <div class="tip-item">
              <span class="tip-icon">⚡</span>
              <span class="tip-text">如果条码已存在，会显示产品信息；如果不存在，会打开创建页面</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Product Creation Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click="closeCreateModal">
      <div class="modal-content create-modal" @click.stop>
        <div class="modal-header">
          <h3>创建新产品</h3>
          <button class="modal-close" @click="closeCreateModal">×</button>
        </div>
        <div class="modal-body">
          <div class="barcode-info">
            <div class="barcode-label">条码：</div>
            <div class="barcode-value">{{ newProductBarcode }}</div>
          </div>
          
          <form @submit.prevent="createProduct">
            <div class="form-group">
              <label class="form-label">产品名称 *</label>
              <input v-model="newProduct.name" type="text" class="form-control" required>
            </div>
            
            <div class="form-group">
              <label class="form-label">英文名称</label>
              <input v-model="newProduct.name_en" type="text" class="form-control">
            </div>
            
            <div class="form-group">
              <label class="form-label">类别</label>
              <select v-model="newProduct.category_id" class="form-control">
                <option value="">选择类别</option>
                <option v-for="category in categories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">描述</label>
              <textarea v-model="newProduct.description" class="form-control" rows="3"></textarea>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">初始库存 *</label>
                                <input v-model.number="newProduct.stock" type="number" class="form-control" min="0" step="0.001" required>
              </div>
              <div class="form-group">
                <label class="form-label">最小库存</label>
                <input v-model.number="newProduct.min_stock" type="number" class="form-control" min="0" step="0.001" required>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">存储位置</label>
                <input v-model="newProduct.location" type="text" class="form-control">
              </div>
              <div class="form-group">
                <label class="form-label">供应商</label>
                <input v-model="newProduct.supplier" type="text" class="form-control">
              </div>
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn btn-outline" @click="closeCreateModal">取消</button>
              <button type="submit" class="btn btn-primary">创建产品</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Progress Modal -->
    <div v-if="showProgressModal" class="modal-overlay">
      <div class="modal-content progress-modal">
        <div class="modal-header">
          <h3>{{ progressTitle }}</h3>
        </div>
        <div class="modal-body">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
          </div>
          <div class="progress-text">{{ progressText }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useInventoryStore } from '@/stores/inventory'
import { generateProductBarcode, generateBarcodeDataWithFormat } from '@/utils/barcode'
import { showToast } from '@/utils/index'
import JSZip from 'jszip'

export default {
  name: 'BarcodeManagement',
  setup() {
    const inventoryStore = useInventoryStore()
    
    // Reactive data
    const activeTab = ref('generate')
    const selectAll = ref(false)
    const selectedProducts = ref([])
    const selectAllForSync = ref(false)
    const selectedProductsForSync = ref([])
    const selectAllForDownload = ref(false)
    const selectedProductsForDownload = ref([])
    const downloadFormat = ref('png')
    const barcodeType = ref('both')
    const filterCategory = ref('')
    const searchQuery = ref('')
    const scannedBarcode = ref('')
    const showCreateModal = ref(false)
    const showProgressModal = ref(false)
    const progressTitle = ref('')
    const progressText = ref('')
    const progressPercentage = ref(0)
    const newProductBarcode = ref('')
    const barcodeInput = ref(null)
    const isLoadingProducts = ref(false)
    
    // New product form
    const newProduct = ref({
      name: '',
      name_en: '',
      category_id: '',
      description: '',
      stock: 0,
      min_stock: 0,
      location: '',
      supplier: ''
    })
    
    // Computed properties
    const products = computed(() => inventoryStore.products)
    const categories = computed(() => inventoryStore.categories)
    
    const productsWithoutBarcode = computed(() => {
      return products.value.filter(product => !product.barcode || product.barcode.trim() === '')
    })
    
    const productsWithBarcode = computed(() => {
      return products.value.filter(product => product.barcode && product.barcode.trim() !== '')
    })
    
    const filteredProductsForDownload = computed(() => {
      let filtered = products.value.filter(product => product.barcode && product.barcode.trim() !== '')
      
      if (filterCategory.value) {
        filtered = filtered.filter(product => product.category_id === filterCategory.value)
      }
      
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = filtered.filter(product => 
          product.name.toLowerCase().includes(query) ||
          product.barcode.toLowerCase().includes(query)
        )
      }
      
      return filtered
    })
    
    // Methods
    const toggleSelectAll = () => {
      if (selectAll.value) {
        selectedProducts.value = productsWithoutBarcode.value.map(p => p.id)
      } else {
        selectedProducts.value = []
      }
    }
    
    const toggleSelectAllForDownload = () => {
      if (selectAllForDownload.value) {
        selectedProductsForDownload.value = filteredProductsForDownload.value.map(p => p.id)
      } else {
        selectedProductsForDownload.value = []
      }
    }
    
    const toggleSelectAllForSync = () => {
      if (selectAllForSync.value) {
        selectedProductsForSync.value = productsWithBarcode.value.map(p => p.id)
      } else {
        selectedProductsForSync.value = []
      }
    }
    
    const batchGenerateBarcodes = async () => {
      if (selectedProducts.value.length === 0) {
        showToast('请选择要生成条码的产品', 'warning')
        return
      }
      
      showProgressModal.value = true
      progressTitle.value = '批量生成条码'
      progressPercentage.value = 0
      
      try {
        const total = selectedProducts.value.length
        let completed = 0
        
        for (const productId of selectedProducts.value) {
          const product = products.value.find(p => p.id === productId)
          if (product) {
            const barcode = generateProductBarcode()
            await inventoryStore.updateProduct(productId, { ...product, barcode })
            
            completed++
            progressPercentage.value = (completed / total) * 100
            progressText.value = `正在生成条码... ${completed}/${total}`
          }
        }
        
        showProgressModal.value = false
        selectedProducts.value = []
        selectAll.value = false
        showToast(`成功为 ${completed} 个产品生成条码`, 'success')
        
      } catch (error) {
        showProgressModal.value = false
        showToast('批量生成条码失败: ' + error.message, 'error')
      }
    }
    
    const batchDownloadBarcodes = async () => {
      if (selectedProductsForDownload.value.length === 0) {
        showToast('请选择要下载的产品', 'warning')
        return
      }
      
      showProgressModal.value = true
      progressTitle.value = '批量下载条码'
      progressPercentage.value = 0
      
      try {
        const zip = new JSZip()
        const total = selectedProductsForDownload.value.length
        let completed = 0
        
        for (const productId of selectedProductsForDownload.value) {
          const product = products.value.find(p => p.id === productId)
          if (product && product.barcode) {
            progressText.value = `正在生成条码图片... ${completed + 1}/${total}`
            
            const barcodeData = await generateBarcodeDataWithFormat(product.barcode, downloadFormat.value, product.name)
            
            // 根据选择的类型添加文件
            if (barcodeType.value === 'both' || barcodeType.value === 'barcode') {
              // 转换barcode为blob
              const barcodeBlob = await fetch(barcodeData.barcode).then(r => r.blob())
              const fileExt = downloadFormat.value === 'svg' ? 'svg' : 'png'
              zip.file(`${product.name}_条码.${fileExt}`, barcodeBlob)
            }
            
            if (barcodeType.value === 'both' || barcodeType.value === 'qrcode') {
              // 转换qrcode为blob (QR码始终是PNG格式)
              const qrBlob = await fetch(barcodeData.qrCode).then(r => r.blob())
              zip.file(`${product.name}_二维码.png`, qrBlob)
            }
            
            completed++
            progressPercentage.value = (completed / total) * 100
          }
        }
        
        progressText.value = '正在打包文件...'
        const content = await zip.generateAsync({ type: 'blob' })
        
        // 下载zip文件
        const link = document.createElement('a')
        link.href = URL.createObjectURL(content)
        link.download = `条码批量下载_${new Date().toISOString().split('T')[0]}.zip`
        link.click()
        
        showProgressModal.value = false
        selectedProductsForDownload.value = []
        selectAllForDownload.value = false
        showToast(`成功下载 ${completed} 个产品的条码`, 'success')
        
      } catch (error) {
        showProgressModal.value = false
        showToast('批量下载失败: ' + error.message, 'error')
      }
    }
    
    const syncBarcodeImages = async () => {
      if (selectedProductsForSync.value.length === 0) {
        showToast('请选择要同步条码图片的产品', 'warning')
        return
      }
      
      const confirmed = confirm(`确定要同步 ${selectedProductsForSync.value.length} 个产品的条码图片吗？此操作将根据当前条码值重新生成条码图片。`)
      if (!confirmed) return
      
      showProgressModal.value = true
      progressTitle.value = '同步条码图片'
      progressPercentage.value = 0
      
      try {
        const total = selectedProductsForSync.value.length
        let completed = 0
        
        for (const productId of selectedProductsForSync.value) {
          const product = products.value.find(p => p.id === productId)
          if (product && product.barcode) {
            progressText.value = `正在同步条码图片... ${completed + 1}/${total}`
            
            // 生成新的条码图片数据
            const barcodeData = await generateBarcodeDataWithFormat(product.barcode, 'png', product.name)
            
            // 更新产品的条码图片信息
            const updatedProduct = {
              ...product,
              barcode_image: barcodeData.barcode,
              qr_code_image: barcodeData.qrCode,
              barcode_updated_at: new Date().toISOString()
            }
            
            await inventoryStore.updateProduct(productId, updatedProduct)
            
            completed++
            progressPercentage.value = (completed / total) * 100
          }
        }
        
        showProgressModal.value = false
        selectedProductsForSync.value = []
        selectAllForSync.value = false
        showToast(`成功同步 ${completed} 个产品的条码图片`, 'success')
        
      } catch (error) {
        showProgressModal.value = false
        showToast('条码图片同步失败: ' + error.message, 'error')
      }
    }
    
    const handleBarcodeInput = async () => {
      if (!scannedBarcode.value) return
      
      const barcode = scannedBarcode.value.trim()
      
      // 确保条码有有效长度
      if (barcode.length < 6) {
        showToast('条码长度过短，请输入有效的条码', 'warning')
        return
      }
      
      const existingProduct = products.value.find(p => p.barcode === barcode)
      
      if (existingProduct) {
        showToast(`产品已存在: ${existingProduct.name}`, 'info')
        scannedBarcode.value = ''
      } else {
        // 打开创建产品模态框
        newProductBarcode.value = barcode
        newProduct.value = {
          name: '',
          name_en: '',
          category_id: '',
          description: '',
          stock: 0,
          min_stock: 0,
          location: '',
          supplier: ''
        }
        showCreateModal.value = true
        scannedBarcode.value = ''
      }
    }
    
    const onBarcodeInput = (event) => {
      // 确保输入框值能正确显示完整条码
      const inputValue = event.target.value
      scannedBarcode.value = inputValue
    }
    
    const createProduct = async () => {
      try {
        const productData = {
          ...newProduct.value,
          barcode: newProductBarcode.value
        }
        
        await inventoryStore.createProduct(productData)
        showToast('产品创建成功', 'success')
        closeCreateModal()
        
        // 重新聚焦到扫码输入框
        await nextTick()
        if (barcodeInput.value) {
          barcodeInput.value.focus()
        }
        
      } catch (error) {
        showToast('创建产品失败: ' + error.message, 'error')
      }
    }
    
    const closeCreateModal = () => {
      showCreateModal.value = false
      newProductBarcode.value = ''
    }
    
    // Load data on mount
    onMounted(async () => {
      isLoadingProducts.value = true
      
      try {
        await inventoryStore.loadInitialData()
        
        // 为条码管理页面加载所有产品，确保没有遗漏
        await inventoryStore.loadAllProducts()
        
        // 自动聚焦到扫码输入框
        if (activeTab.value === 'scan') {
          await nextTick()
          if (barcodeInput.value) {
            barcodeInput.value.focus()
          }
        }
      } finally {
        isLoadingProducts.value = false
      }
    })
    
    return {
      activeTab,
      selectAll,
      selectedProducts,
      selectAllForSync,
      selectedProductsForSync,
      selectAllForDownload,
      selectedProductsForDownload,
      downloadFormat,
      barcodeType,
      filterCategory,
      searchQuery,
      scannedBarcode,
      showCreateModal,
      showProgressModal,
      progressTitle,
      progressText,
      progressPercentage,
      newProductBarcode,
      newProduct,
      barcodeInput,
      isLoadingProducts,
      products,
      categories,
      productsWithoutBarcode,
      productsWithBarcode,
      filteredProductsForDownload,
      toggleSelectAll,
      toggleSelectAllForSync,
      toggleSelectAllForDownload,
      batchGenerateBarcodes,
      syncBarcodeImages,
      batchDownloadBarcodes,
      handleBarcodeInput,
      onBarcodeInput,
      createProduct,
      closeCreateModal
    }
  }
}
</script>

<style scoped>
.barcode-management {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 30px;
}

.header-content h2 {
  margin: 0 0 5px 0;
  color: #2d3748;
}

.header-content p {
  margin: 0;
  color: #718096;
}

.action-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 20px;
  background: #f7fafc;
  border-radius: 8px;
  padding: 4px;
}

.tab-button {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: #4a5568;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.tab-button:hover {
  background: #e2e8f0;
}

.tab-button.active {
  background: #4299e1;
  color: white;
}

.tab-content {
  min-height: 500px;
}

.section-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.section-header {
  padding: 20px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
}

.section-header h3 {
  margin: 0 0 5px 0;
  color: #2d3748;
}

.section-header p {
  margin: 0;
  color: #718096;
}

.stats-summary {
  padding: 20px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  color: #4a5568;
}

.stat-value {
  font-weight: 600;
  color: #2b6cb0;
}

.product-list {
  padding: 20px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e2e8f0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
}

.product-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 15px;
  transition: all 0.2s;
}

.product-card:hover {
  border-color: #4299e1;
  background: #f7fafc;
}

.product-checkbox {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.product-info {
  flex: 1;
}

.product-name {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 5px;
}

.product-barcode {
  font-family: monospace;
  font-size: 14px;
  color: #4a5568;
  margin-bottom: 5px;
}

.product-details {
  font-size: 14px;
  color: #718096;
  display: flex;
  gap: 10px;
}

.category, .location {
  padding: 2px 8px;
  background: #e2e8f0;
  border-radius: 4px;
  font-size: 12px;
}

.barcode-status {
  font-size: 11px !important;
  padding: 2px 6px !important;
  border-radius: 3px !important;
  font-weight: 500 !important;
}

.barcode-status.has-image {
  background: #c6f6d5 !important;
  color: #2f855a !important;
}

.barcode-status:not(.has-image) {
  background: #fed7d7 !important;
  color: #c53030 !important;
}

.download-options {
  display: flex;
  gap: 20px;
  padding: 20px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
}

.option-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-label {
  font-weight: 500;
  color: #4a5568;
}

.option-select {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: white;
}

.product-filter {
  display: flex;
  gap: 20px;
  padding: 20px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-weight: 500;
  color: #4a5568;
}

.filter-select, .filter-input {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: white;
}

.scan-input-section {
  padding: 20px;
}

.scan-input-group {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 20px;
}

.scan-label {
  font-weight: 500;
  color: #4a5568;
  min-width: 180px;
}

.scan-input {
  flex: 1;
  padding: 10px 15px;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  font-size: 16px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  letter-spacing: 0.5px;
  transition: border-color 0.2s;
  background: white;
  color: #2d3748;
}

.scan-input:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.scan-tips {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: #f7fafc;
  border-radius: 6px;
}

.tip-text {
  color: #4a5568;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #718096;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.empty-text {
  font-size: 18px;
  font-weight: 500;
}

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

.create-modal {
  max-width: 600px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
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
  color: #718096;
}

.modal-body {
  padding: 20px;
}

.barcode-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  background: #f7fafc;
  border-radius: 6px;
  margin-bottom: 20px;
}

.barcode-label {
  font-weight: 500;
  color: #4a5568;
}

.barcode-value {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 16px;
  color: #2b6cb0;
  font-weight: 600;
  word-break: break-all;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 2px solid #e2e8f0;
  min-width: 200px;
  letter-spacing: 1px;
  text-align: center;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 5px;
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
  border-color: #4299e1;
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
  gap: 10px;
  justify-content: flex-end;
  margin-top: 24px;
}

.progress-modal {
  max-width: 400px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 15px;
}

.progress-fill {
  height: 100%;
  background: #4299e1;
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  color: #4a5568;
  font-size: 14px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: #4299e1;
  color: white;
}

.btn-primary:hover {
  background: #3182ce;
}

.btn-primary:disabled {
  background: #a0aec0;
  cursor: not-allowed;
}

.btn-success {
  background: #48bb78;
  color: white;
}

.btn-success:hover {
  background: #38a169;
}

.btn-success:disabled {
  background: #a0aec0;
  cursor: not-allowed;
}

.btn-outline {
  background: white;
  color: #4a5568;
  border: 1px solid #e2e8f0;
}

.btn-outline:hover {
  background: #f7fafc;
}

@media (max-width: 768px) {
  .barcode-management {
    padding: 15px;
  }
  
  .action-tabs {
    flex-direction: column;
  }
  
  .download-options,
  .product-filter {
    flex-direction: column;
    gap: 15px;
  }
  
  .scan-input-group {
    flex-direction: column;
    align-items: stretch;
  }
  
  .scan-label {
    min-width: auto;
  }
  
  .list-header {
    flex-direction: column;
    gap: 15px;
    align-items: stretch;
  }
  
  .product-grid {
    grid-template-columns: 1fr;
  }
}
</style>
