<template>
  <div class="document-editor" v-if="show">
    <div class="document-overlay"></div>
    <div class="document-panel">
      <!-- 头部 -->
      <div class="document-header">
        <div class="header-left">
          <div class="document-type-selector" v-if="isDraft">
            <button 
              class="type-btn in-btn" 
              :class="{ active: localDocumentType === 'IN' }"
              @click="changeDocumentType('IN')"
            >
              📦 入库单
            </button>
            <button 
              class="type-btn out-btn" 
              :class="{ active: localDocumentType === 'OUT' }"
              @click="changeDocumentType('OUT')"
            >
              📋 出库单
            </button>
          </div>
          <span v-else class="document-type-badge" :class="localDocumentType">
            {{ localDocumentType === 'IN' ? '📦 入库单' : '📋 出库单' }}
          </span>
          <span class="document-number" v-if="documentStore.currentDocument && !isDraft">
            {{ documentStore.currentDocument.document_number }}
          </span>
          <span class="document-status" :class="documentStore.currentDocument?.status">
            {{ statusText }}
          </span>
        </div>
        <div class="header-right">
          <button class="btn-icon" @click="handleClose" :disabled="documentStore.isRecognizing" :title="documentStore.isRecognizing ? '识别中不能关闭' : '关闭'">✕</button>
        </div>
      </div>

      <!-- OCR识别结果提示 - 横向紧凑布局 -->
      <div v-if="documentStore.ocrSummary" class="ocr-summary-section">
        <div class="ocr-summary-compact">
          <span class="ocr-icon">🔍</span>
          <span class="ocr-badge" :class="localDocumentType.toLowerCase()">
            {{ localDocumentType === 'IN' ? '入库' : '出库' }}
          </span>
          <span class="ocr-serial">{{ documentStore.ocrSummary.serial_raw }}</span>
          <span class="ocr-confidence">
            <span class="confidence-bar">
              <span class="confidence-fill" :style="{ width: documentStore.ocrSummary.confidence_percent + '%' }"></span>
            </span>
            <span class="confidence-text">{{ documentStore.ocrSummary.confidence_percent }}%</span>
          </span>
          <span v-if="documentStore.ocrSummary.detected_keywords?.length" class="ocr-keywords">
            <span v-for="keyword in documentStore.ocrSummary.detected_keywords" :key="keyword" class="keyword-tag">
              {{ keyword }}
            </span>
          </span>
          <span v-if="documentStore.ocrSummary.recognition_tips?.length" class="ocr-tip">
            {{ documentStore.ocrSummary.recognition_tips[0] }}
          </span>
        </div>
      </div>

      <!-- 单据信息区域 -->
      <div class="document-info-section">
        <div class="info-header">
          <span class="info-icon">📝</span>
          <span class="info-title">单据信息</span>
        </div>
        
        <div class="info-form">
          <!-- 单据号重复警告 -->
          <div v-if="documentStore.documentNumberWarning" class="document-number-warning">
            <span class="warning-icon">⚠️</span>
            <span class="warning-text">{{ documentStore.documentNumberWarning }}</span>
          </div>

          <!-- 入库单信息 -->
          <template v-if="localDocumentType === 'IN'">
            <div class="form-row">
              <div class="form-group">
                <label>
                  单号 
                  <span class="editable-hint" v-if="isDraft && !documentStore.isRecognizing">(可自由编辑)</span>
                  <span class="recognizing-hint" v-if="documentStore.isRecognizing">
                    <span class="recognizing-spinner-small"></span>
                    {{ documentStore.recognizingProgress || '正在识别...' }}
                    <span class="recognizing-percent">{{ documentStore.recognizingPercent }}%</span>
                  </span>
                </label>
                <!-- 识别进度条 -->
                <div v-if="documentStore.isRecognizing" class="recognizing-progress-bar">
                  <div class="progress-fill" :style="{ width: documentStore.recognizingPercent + '%' }"></div>
                </div>
                <div class="document-number-input" :class="{ 'is-recognizing': documentStore.isRecognizing }">
                  <span class="doc-prefix">R</span>
                  <input 
                    type="text" 
                    v-model="documentNumberMiddle" 
                    class="doc-middle-input" 
                    :readonly="!isDraft"
                    placeholder="输入单号"
                    @input="onMiddleNumberInput"
                    @blur="onMiddleNumberBlur"
                  />
                  <span class="doc-suffix">-{{ displayYearMonth }}</span>
                </div>
                <!-- 延续上月单据复选框 -->
                <div v-if="isDraft" class="continue-last-month-option">
                  <label class="checkbox-label">
                    <input 
                      type="checkbox" 
                      v-model="continueLastMonth" 
                      @change="onContinueLastMonthChange"
                      class="checkbox-input"
                    />
                    <span class="checkbox-text">延续上月单据（单号将归属为上月）</span>
                  </label>
                </div>
              </div>
              <div class="form-group">
                <label>用途说明</label>
                <input type="text" v-model="formData.purpose" class="form-input" placeholder="请输入入库用途说明（选填）" :disabled="!isDraft" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>📦 供应商</label>
                <input type="text" v-model="formData.supplier" class="form-input" placeholder="请输入供应商名称（选填）" :disabled="!isDraft" />
              </div>
            </div>
          </template>

          <!-- 出库单信息 -->
          <template v-else>
            <div class="form-row">
              <div class="form-group">
                <label>
                  单号 
                  <span class="editable-hint" v-if="isDraft && !documentStore.isRecognizing">(可自由编辑)</span>
                  <span class="recognizing-hint" v-if="documentStore.isRecognizing">
                    <span class="recognizing-spinner-small"></span>
                    {{ documentStore.recognizingProgress || '正在识别...' }}
                    <span class="recognizing-percent">{{ documentStore.recognizingPercent }}%</span>
                  </span>
                </label>
                <!-- 识别进度条 -->
                <div v-if="documentStore.isRecognizing" class="recognizing-progress-bar">
                  <div class="progress-fill" :style="{ width: documentStore.recognizingPercent + '%' }"></div>
                </div>
                <div class="document-number-input" :class="{ 'is-recognizing': documentStore.isRecognizing }">
                  <span class="doc-prefix">C</span>
                  <input 
                    type="text" 
                    v-model="documentNumberMiddle" 
                    class="doc-middle-input" 
                    :readonly="!isDraft"
                    placeholder="输入单号"
                    @input="onMiddleNumberInput"
                    @blur="onMiddleNumberBlur"
                  />
                  <span class="doc-suffix">-{{ displayYearMonth }}</span>
                </div>
                <!-- 延续上月单据复选框 -->
                <div v-if="isDraft" class="continue-last-month-option">
                  <label class="checkbox-label">
                    <input 
                      type="checkbox" 
                      v-model="continueLastMonth" 
                      @change="onContinueLastMonthChange"
                      class="checkbox-input"
                    />
                    <span class="checkbox-text">延续上月单据（单号将归属为上月）</span>
                  </label>
                </div>
              </div>
              <div class="form-group required">
                <label>领料人 <span class="required-mark">*</span></label>
                <input type="text" v-model="formData.requester_name" class="form-input" placeholder="请输入领料人姓名" :disabled="!isDraft" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group required">
                <label>领用单位/部门 <span class="required-mark">*</span></label>
                <select v-model="formData.project_id" class="form-select" :disabled="!isDraft">
                  <option value="">请选择领用单位/部门</option>
                  <option v-for="project in projects" :key="project.id" :value="project.id">
                    {{ project.name }}
                  </option>
                </select>
              </div>
              <div class="form-group required">
                <label>用途说明 <span class="required-mark">*</span></label>
                <input type="text" v-model="formData.purpose" class="form-input" placeholder="请输入用途说明" :disabled="!isDraft" />
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 产品列表区域 -->
      <div class="document-items-section">
        <div class="items-header">
          <div class="items-title">
            <span class="info-icon">📦</span>
            <span>产品列表</span>
            <span class="items-count">{{ documentStore.documentItems.length }} 项</span>
          </div>
        </div>

        <!-- 内联产品搜索框 -->
        <div v-if="isDraft" class="inline-product-search">
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input 
              type="text" 
              v-model="productSearchQuery" 
              class="product-search-input" 
              placeholder="输入产品名称或条码搜索并添加..."
              @input="searchProducts"
              @focus="showSearchResults = true"
              ref="productSearchInput"
            />
            <button v-if="productSearchQuery" class="clear-search-btn" @click="clearProductSearch">✕</button>
          </div>
          
          <!-- 搜索结果下拉 -->
          <div class="search-results-dropdown" v-if="showSearchResults && productSearchQuery">
            <div v-if="productSearchResults.length > 0" class="results-list">
              <div 
                v-for="product in productSearchResults" 
                :key="product.id" 
                class="search-result-item"
                @click="quickAddProduct(product)"
              >
                <div class="product-info">
                  <div class="product-name">{{ product.name }}</div>
                  <div class="product-details">
                    <span class="barcode">{{ product.barcode }}</span>
                    <span class="separator">|</span>
                    <span class="category">{{ product.category_name || '未分类' }}</span>
                  </div>
                </div>
                <div class="product-meta">
                  <div class="product-stock" :class="{ low: product.stock <= product.min_stock }">
                    库存: {{ formatQuantity(product.stock) }}
                  </div>
                  <div class="product-price" v-if="localDocumentType === 'OUT'">
                    单价: ¥{{ formatPrice(product.current_unit_price || product.price || 0) }}
                  </div>
                </div>
                <div class="add-hint">点击添加</div>
              </div>
            </div>
            <div v-else-if="!searching" class="no-results">
              <span class="no-results-icon">😕</span>
              <span>未找到匹配的产品</span>
            </div>
            <div v-else class="searching">
              <span>搜索中...</span>
            </div>
          </div>
        </div>

        <!-- 快速编辑数量/金额弹窗 -->
        <div v-if="quickEditProduct" class="quick-edit-overlay" @click.self="quickEditProduct = null">
          <div class="quick-edit-modal">
            <div class="quick-edit-header">
              <span class="edit-title">添加: {{ quickEditProduct.name }}</span>
              <button class="btn-icon" @click="quickEditProduct = null">✕</button>
            </div>
            <div class="quick-edit-body">
              <div class="quick-edit-info">
                <span class="barcode">{{ quickEditProduct.barcode }}</span>
                <span class="stock">库存: {{ formatQuantity(quickEditProduct.stock) }}</span>
              </div>
              <div class="quick-edit-form">
                <div class="form-group">
                  <label>数量</label>
                  <input 
                    type="number" 
                    v-model.number="quickEditForm.quantity" 
                    class="form-input" 
                    min="0.001" 
                    step="0.001"
                    ref="quickEditQuantityInput"
                    @wheel.prevent
                    @keyup.enter="confirmQuickAdd"
                  />
                </div>
                <div class="form-group" v-if="localDocumentType === 'IN'">
                  <label>入库总金额</label>
                  <input 
                    type="number" 
                    v-model.number="quickEditForm.total_value" 
                    class="form-input" 
                    min="0" 
                    step="0.01"
                    placeholder="请输入入库总金额"
                    @wheel.prevent
                    @keyup.enter="confirmQuickAdd"
                  />
                </div>
                <div class="form-group" v-else>
                  <label>单价 (只读)</label>
                  <input 
                    type="text" 
                    :value="'¥' + formatPrice(quickEditProduct.current_unit_price || quickEditProduct.price || 0)" 
                    class="form-input readonly" 
                    readonly
                  />
                </div>
              </div>
              <div class="quick-edit-actions">
                <button class="btn btn-outline" @click="quickEditProduct = null">取消</button>
                <button class="btn btn-primary" @click="confirmQuickAdd" :disabled="!canQuickAdd">确认添加</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 产品列表 -->
        <div class="items-list" v-if="documentStore.documentItems.length > 0">
          <div 
            v-for="item in documentStore.documentItems" 
            :key="item.id" 
            class="item-card"
          >
            <div class="item-main">
              <div class="item-info">
                <div class="item-name">{{ item.product_name }}</div>
                <div class="item-details">
                  <span class="item-barcode">{{ item.barcode }}</span>
                  <span class="item-stock" v-if="item.product">库存: {{ formatQuantity(item.product.stock) }}</span>
                </div>
              </div>
              <div class="item-quantity-controls" v-if="isDraft">
                <button class="qty-btn minus-10" @click="adjustItemQuantity(item, -10)" title="-10">-10</button>
                <button class="qty-btn minus-1" @click="adjustItemQuantity(item, -1)" title="-1">-1</button>
                <input 
                  type="number" 
                  :value="item.quantity" 
                  class="quantity-input-inline" 
                  min="0.001" 
                  step="0.001"
                  @wheel.prevent
                  @change="updateItemQuantityDirect(item, $event)"
                  @keyup.enter="$event.target.blur()"
                />
                <button class="qty-btn plus-1" @click="adjustItemQuantity(item, 1)" title="+1">+1</button>
                <button class="qty-btn plus-10" @click="adjustItemQuantity(item, 10)" title="+10">+10</button>
              </div>
              <div class="item-quantity" v-else>
                <span class="quantity-value">{{ formatQuantity(item.quantity) }}</span>
              </div>
              <!-- 入库单：显示总价输入框和自动计算的单价 -->
              <div class="item-price" v-if="localDocumentType === 'IN' && isDraft">
                <div class="total-price-input">
                  <label>总价:</label>
                  <input 
                    type="number" 
                    :value="item.total_price" 
                    class="price-input-inline"
                    min="0" 
                    step="0.01"
                    placeholder="输入总价"
                    @wheel.prevent
                    @input="updateItemTotalPrice(item, $event)"
                    @keyup.enter="$event.target.blur()"
                  />
                </div>
                <div class="unit-price">单价: ¥{{ calculateDisplayUnitPrice(item) }}</div>
              </div>
              <!-- 出库单或非编辑状态：显示只读价格 -->
              <div class="item-price" v-else>
                <div class="unit-price">单价: ¥{{ formatPrice(item.unit_price) }}</div>
                <div class="total-price">合计: ¥{{ formatPrice(item.total_price) }}</div>
              </div>
              <div class="item-actions" v-if="isDraft">
                <button class="btn-icon delete" @click="removeItem(item.id)" title="删除">🗑️</button>
              </div>
            </div>
          </div>
        </div>
        
        <div v-else class="items-empty">
          <div class="empty-icon">📦</div>
          <div class="empty-text">暂无产品</div>
          <div class="empty-hint">点击"添加产品"按钮添加产品到单据</div>
        </div>
      </div>

      <!-- 单据图片区域 -->
      <div class="document-image-section" v-if="documentStore.documentImage || isDraft">
        <div class="image-header">
          <span class="info-icon">📷</span>
          <span>单据图片</span>
        </div>
        <div class="image-content">
          <div v-if="documentStore.documentImage" class="image-preview">
            <img :src="getImageUrl()" alt="单据图片" @click="showFullImage = true" />
            <!-- 重拍和重新识别按钮 -->
            <div class="image-actions" v-if="isDraft">
              <button class="btn btn-outline btn-sm" @click="handleRetakePhoto" title="重新拍照">
                📷 重拍
              </button>
              <button class="btn btn-primary btn-sm" @click="handleReRecognize" title="重新识别">
                🔍 重新识别
              </button>
            </div>
          </div>
          <div v-else-if="isDraft" class="image-upload">
            <input type="file" accept="image/*" @change="handleImageUpload" ref="imageInput" style="display: none" />
            <div class="upload-options">
              <button class="btn btn-outline" @click="handleCapturePhoto" title="使用摄像头拍照">
                📷 拍照识别
              </button>
              <button class="btn btn-outline" @click="$refs.imageInput.click()">
                📁 上传图片
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部统计和操作 -->
      <div class="document-footer">
        <div class="footer-stats">
          <div class="stat-item">
            <span class="stat-label">产品种类</span>
            <span class="stat-value">{{ documentStore.itemCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">总数量</span>
            <span class="stat-value">{{ formatQuantity(documentStore.totalQuantity) }}</span>
          </div>
          <div class="stat-item total">
            <span class="stat-label">总金额</span>
            <span class="stat-value">¥{{ formatPrice(documentStore.totalValue) }}</span>
          </div>
        </div>
        
        <div class="footer-actions" v-if="isDraft">
          <button class="btn btn-outline" @click="handleCancel">取消单据</button>
          <button class="btn btn-primary btn-lg" @click="handleSubmit" :disabled="!documentStore.canSubmit">
            ✓ 提交单据
          </button>
        </div>
        <div class="footer-actions" v-else>
          <button class="btn btn-outline" @click="handleClose">关闭</button>
        </div>
      </div>
    </div>

    <!-- 全屏图片预览 -->
    <div v-if="showFullImage" class="full-image-modal" @click="showFullImage = false">
      <img :src="getImageUrl()" alt="单据图片" />
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'
import { useDocumentStore } from '@/stores/document'
import { useInventoryStore } from '@/stores/inventory'
import { multiply, divide, formatStorage } from '@/utils/precision'

export default {
  name: 'DocumentEditor',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    documentType: {
      type: String,
      default: 'OUT' // 'IN' or 'OUT'
    }
  },
  emits: ['close', 'submitted'],
  
  setup(props, { emit }) {
    const documentStore = useDocumentStore()
    const inventoryStore = useInventoryStore()

    // 本地单据信息（可编辑）
    const localDocumentType = ref(props.documentType)
    const localDocumentNumber = ref('')
    
    // 单据号中间7位数字（可编辑部分）
    const documentNumberMiddle = ref('0000000')
    
    // 延续上月单据功能
    const continueLastMonth = ref(false)
    
    // 计算上个月的年月
    const getPreviousYearMonth = () => {
      const now = new Date()
      let year = now.getFullYear()
      let month = now.getMonth() + 1 // 1-12
      
      if (month === 1) {
        // 1月，上个月是去年12月
        year = year - 1
        month = 12
      } else {
        month = month - 1 // 上个月
      }
      
      const yearStr = String(year).slice(-2)
      const monthStr = String(month).padStart(2, '0')
      return `${yearStr}${monthStr}`
    }
    
    // 当前年月（格式：2601）
    const currentYearMonth = computed(() => {
      const now = new Date()
      const year = String(now.getFullYear()).slice(-2)  // 取后两位
      const month = String(now.getMonth() + 1).padStart(2, '0')
      return `${year}${month}`
    })
    
    // 显示的年月（根据是否延续上月决定）
    const displayYearMonth = computed(() => {
      return continueLastMonth.value ? getPreviousYearMonth() : currentYearMonth.value
    })

    // 表单数据
    const formData = ref({
      requester_name: '',
      project_id: '',
      purpose: '',
      supplier: ''  // 供应商（仅入库单）
    })

    // 产品搜索
    const showProductSearch = ref(false)
    const showSearchResults = ref(false)
    const productSearchQuery = ref('')
    const productSearchResults = ref([])
    const searching = ref(false)
    const productSearchInput = ref(null)

    // 快速添加产品
    const quickEditProduct = ref(null)
    const quickEditForm = ref({
      quantity: 1,
      total_value: 0
    })
    const quickEditQuantityInput = ref(null)

    // 添加产品表单（保留兼容）
    const selectedProductToAdd = ref(null)
    const addProductForm = ref({
      quantity: 1,
      total_value: 0
    })

    // 编辑项目
    const editingItemId = ref(null)
    const editingQuantity = ref(0)

    // 图片预览
    const showFullImage = ref(false)
    const imageInput = ref(null)

    // 计算属性
    const projects = computed(() => inventoryStore.projects)
    
    // 使用 store 的 isDraft getter（现在基于 isEditing 状态）
    const isDraft = computed(() => documentStore.isDraft)

    const statusText = computed(() => {
      if (documentStore.isEditing) {
        return '编辑中'
      }
      return documentStore.currentDocument?.id ? '已提交' : ''
    })

    const canAddProduct = computed(() => {
      if (!selectedProductToAdd.value) return false
      if (addProductForm.value.quantity <= 0) return false
      if (props.documentType === 'IN' && addProductForm.value.total_value <= 0) return false
      return true
    })

    // 快速添加是否可用
    const canQuickAdd = computed(() => {
      if (!quickEditProduct.value) return false
      if (quickEditForm.value.quantity <= 0) return false
      if (localDocumentType.value === 'IN' && quickEditForm.value.total_value <= 0) return false
      return true
    })

    // 监听显示状态
    watch(() => props.show, async (newVal) => {
      if (newVal && documentStore.currentDocument) {
        // 同步表单数据
        formData.value = {
          requester_name: documentStore.currentDocument.requester_name || '',
          project_id: documentStore.currentDocument.project_id || '',
          purpose: documentStore.currentDocument.purpose || ''
        }
        // 同步本地单据信息
        localDocumentType.value = documentStore.currentDocument.document_type || props.documentType
        localDocumentNumber.value = documentStore.currentDocument.document_number || ''
        
        // 解析单据号中的数字部分（支持任意位数）
        const docNum = documentStore.currentDocument.document_number || ''
        // 格式: C1234567-2512 或 R1234567-2512
        const match = docNum.match(/^[CR](\d+)-/)
        if (match) {
          documentNumberMiddle.value = match[1]
        } else {
          // 尝试匹配旧格式 C1234567-202512
          const oldMatch = docNum.match(/^[CR](\d+)-\d{6}/)
          if (oldMatch) {
            documentNumberMiddle.value = oldMatch[1]
          } else {
            documentNumberMiddle.value = ''
          }
        }
        
        // 确保加载产品列表以支持拼音搜索
        if (inventoryStore.products.length === 0) {
          await inventoryStore.loadProducts()
        }
      }
    })

    // 监听 props.documentType 变化
    watch(() => props.documentType, (newVal) => {
      localDocumentType.value = newVal
    })
    
    // 监听 localDocumentType 变化，同步到 store
    watch(localDocumentType, (newType, oldType) => {
      if (documentStore.currentDocument && oldType !== undefined) {
        documentStore.currentDocument.document_type = newType
      }
    })

    // 标记是否正在用户编辑中，防止 watch 循环覆盖
    const isUserEditing = ref(false)

    // 监听 store 中单据号变化（OCR识别后更新）
    watch(() => documentStore.currentDocument?.document_number, (newVal) => {
      // OCR识别完成后允许更新（识别状态结束时强制更新）
      const isOcrUpdate = !documentStore.isRecognizing && documentStore.ocrSummary
      
      // 如果是用户正在编辑且不是OCR更新，不要覆盖输入
      if (isUserEditing.value && !isOcrUpdate) return
      
      if (newVal && props.show) {
        console.log('📝 更新单据号显示:', newVal)
        localDocumentNumber.value = newVal
        // 解析数字部分 - 支持任意位数
        // 格式1: C1234567-2512 或 R1234567-2512 (标准格式)
        let match = newVal.match(/^[CR](\d+)-/)
        if (match) {
          documentNumberMiddle.value = match[1]
          console.log('✅ 提取到数字:', match[1])
        } else {
          // 格式2: 直接多位数字
          match = newVal.match(/(\d+)/)
          if (match) {
            documentNumberMiddle.value = match[1]
            console.log('✅ 提取到数字(格式2):', match[1])
          }
        }
        // 同步单据类型
        if (documentStore.currentDocument?.document_type) {
          localDocumentType.value = documentStore.currentDocument.document_type
          console.log('📋 同步单据类型:', documentStore.currentDocument.document_type)
        }
        // OCR更新后重置编辑标志
        if (isOcrUpdate) {
          isUserEditing.value = false
        }
      }
    })

    // 中间数字输入时过滤非数字（允许用户自由编辑任意位数）
    const onMiddleNumberInput = () => {
      isUserEditing.value = true
      // 只允许数字，不限制位数
      documentNumberMiddle.value = documentNumberMiddle.value.replace(/\D/g, '')
      updateFullDocumentNumber()
    }
    
    // 失去焦点时不自动补0，保持用户输入的原始值
    const onMiddleNumberBlur = () => {
      updateFullDocumentNumber()
      // 编辑结束
      isUserEditing.value = false
      // 不在此时检查单据号，提交时统一检查完整单号
    }
    
    // 兼容旧代码
    const onMiddleNumberChange = () => {
      onMiddleNumberInput()
    }
    
    // 更新完整单据号（用于显示和同步到store）
    const updateFullDocumentNumber = () => {
      const prefix = localDocumentType.value === 'IN' ? 'R' : 'C'
      // 自动补0到7位（标准单据号格式）
      const middle = documentNumberMiddle.value || ''
      const paddedMiddle = middle ? middle.padStart(7, '0') : ''
      // 使用 displayYearMonth，根据是否延续上月自动选择正确的年月
      localDocumentNumber.value = paddedMiddle ? `${prefix}${paddedMiddle}-${displayYearMonth.value}` : ''
      
      // 同步到 store 时使用用户输入的完整单号
      if (isDraft.value && documentStore.currentDocument) {
        documentStore.currentDocument.document_number = localDocumentNumber.value
      }
    }
    
    // 延续上月单据复选框变化处理
    const onContinueLastMonthChange = () => {
      // 更新单据号的年月部分
      updateFullDocumentNumber()
    }

    // 监听表单变化，同步到 store（不调用 API）
    watch(formData, (newVal) => {
      if (isDraft.value && documentStore.currentDocument) {
        documentStore.currentDocument.requester_name = newVal.requester_name
        documentStore.currentDocument.project_id = newVal.project_id
        documentStore.currentDocument.purpose = newVal.purpose
        // 供应商只对入库单有效
        if (documentStore.currentDocument.document_type === 'IN') {
          documentStore.currentDocument.supplier = newVal.supplier
        }
      }
    }, { deep: true })

    // 方法
    const searchProducts = async () => {
      if (!productSearchQuery.value.trim()) {
        productSearchResults.value = []
        return
      }
      
      searching.value = true
      try {
        const results = await inventoryStore.searchProducts(productSearchQuery.value)
        // 过滤掉已添加的产品
        const addedIds = documentStore.documentItems.map(item => item.product_id)
        productSearchResults.value = results.filter(p => !addedIds.includes(p.id))
      } catch (error) {
        console.error('搜索产品失败:', error)
      } finally {
        searching.value = false
      }
    }

    // 清空搜索
    const clearProductSearch = () => {
      productSearchQuery.value = ''
      productSearchResults.value = []
      showSearchResults.value = false
    }

    // 快速添加产品（点击搜索结果时）- 打开快速编辑窗口
    const quickAddProduct = (product) => {
      // 清空搜索状态
      showSearchResults.value = false
      productSearchQuery.value = ''
      productSearchResults.value = []
      
      // 打开快速编辑窗口
      quickEditProduct.value = product
      quickEditForm.value = {
        quantity: 1,
        total_value: 0
      }
      
      // 在下一个tick设置焦点到数量输入框
      nextTick(() => {
        if (quickEditQuantityInput.value) {
          quickEditQuantityInput.value.focus()
          quickEditQuantityInput.value.select()
        }
      })
    }

    // 确认快速添加
    const confirmQuickAdd = () => {
      if (!canQuickAdd.value) return
      
      try {
        const quantity = quickEditForm.value.quantity || 1
        let unitPrice = 0
        let totalPrice = 0
        
        if (localDocumentType.value === 'IN') {
          // 入库：用户输入总价，计算单价
          totalPrice = quickEditForm.value.total_value || 0
          unitPrice = quantity > 0 ? totalPrice / quantity : 0
        } else {
          // 出库：使用产品当前单价
          unitPrice = quickEditProduct.value.current_unit_price || quickEditProduct.value.price || 0
          // 如果出库数量等于全部库存，直接使用库存总价值（避免计算误差）
          const productStock = quickEditProduct.value.stock || 0
          const productTotalValue = quickEditProduct.value.total_cost_value || 0
          if (quantity >= productStock && productTotalValue > 0) {
            totalPrice = productTotalValue
          } else if (productStock > 0 && productTotalValue > 0) {
            // 部分出库：按比例计算
            totalPrice = formatStorage(multiply(productTotalValue, divide(quantity, productStock)))
          } else {
            totalPrice = formatStorage(multiply(unitPrice, quantity))
          }
        }
        
        documentStore.addItem({
          product_id: quickEditProduct.value.id,
          product: quickEditProduct.value,
          product_name: quickEditProduct.value.name,
          barcode: quickEditProduct.value.barcode,
          quantity: quantity,
          unit_price: unitPrice,
          total_price: totalPrice
        })
        
        quickEditProduct.value = null
        productSearchQuery.value = ''
        productSearchResults.value = []
        showMessage('产品已添加', 'success')
      } catch (error) {
        showMessage(error.message || '添加产品失败', 'error')
      }
    }

    const selectProductToAdd = (product) => {
      selectedProductToAdd.value = product
      addProductForm.value = {
        quantity: 1,
        total_value: 0
      }
      showProductSearch.value = false
      productSearchQuery.value = ''
      productSearchResults.value = []
    }

    const confirmAddProduct = async () => {
      if (!canAddProduct.value) return
      
      try {
        // 计算单价和总价
        const quantity = addProductForm.value.quantity || 1
        let unitPrice = 0
        let totalPrice = 0
        
        if (localDocumentType.value === 'IN') {
          // 入库：用户输入总价，计算单价
          totalPrice = addProductForm.value.total_value || 0
          unitPrice = quantity > 0 ? totalPrice / quantity : 0
        } else {
          // 出库：使用产品当前单价
          unitPrice = selectedProductToAdd.value.price || 0
          // 如果出库数量等于全部库存，直接使用库存总价值（避免计算误差）
          const productStock = selectedProductToAdd.value.stock || 0
          const productTotalValue = selectedProductToAdd.value.total_cost_value || 0
          if (quantity >= productStock && productTotalValue > 0) {
            totalPrice = productTotalValue
          } else if (productStock > 0 && productTotalValue > 0) {
            // 部分出库：按比例计算
            totalPrice = formatStorage(multiply(productTotalValue, divide(quantity, productStock)))
          } else {
            totalPrice = formatStorage(multiply(unitPrice, quantity))
          }
        }
        
        documentStore.addItem({
          product_id: selectedProductToAdd.value.id,
          product: selectedProductToAdd.value,  // 传递完整产品信息
          product_name: selectedProductToAdd.value.name,
          barcode: selectedProductToAdd.value.barcode,
          quantity: quantity,
          unit_price: unitPrice,
          total_price: totalPrice
        })
        
        selectedProductToAdd.value = null
        showMessage('产品已添加', 'success')
      } catch (error) {
        showMessage(error.message || '添加产品失败', 'error')
      }
    }

    const startItemEdit = (item) => {
      editingItemId.value = item.id
      editingQuantity.value = item.quantity
    }

    const saveItemEdit = (itemId) => {
      if (editingQuantity.value <= 0) {
        showMessage('数量必须大于0', 'error')
        return
      }
      
      try {
        documentStore.updateItem(itemId, {
          quantity: editingQuantity.value
        })
        editingItemId.value = null
        showMessage('已更新', 'success')
      } catch (error) {
        showMessage(error.message || '更新失败', 'error')
      }
    }

    // 快速调整数量（-10, -1, +1, +10）
    const adjustItemQuantity = (item, delta) => {
      const newQuantity = Math.max(0.001, item.quantity + delta)
      try {
        // 出库模式：同时更新总价，使用精确计算
        if (localDocumentType.value === 'OUT') {
          // 出库模式：根据产品的库存总价值按比例计算
          const product = item.product
          const productStock = product?.stock || 0
          const productTotalValue = product?.total_cost_value || 0
          let newTotalPrice
          if (newQuantity >= productStock && productTotalValue > 0) {
            newTotalPrice = productTotalValue
          } else if (productStock > 0 && productTotalValue > 0) {
            newTotalPrice = formatStorage(multiply(productTotalValue, divide(newQuantity, productStock)))
          } else {
            newTotalPrice = formatStorage(multiply(newQuantity, item.unit_price))
          }
          documentStore.updateItem(item.id, {
            quantity: newQuantity,
            total_price: newTotalPrice
          })
        } else {
          // 入库模式：只更新数量（总价由用户输入）
          documentStore.updateItem(item.id, {
            quantity: newQuantity
          })
        }
      } catch (error) {
        showMessage(error.message || '调整失败', 'error')
      }
    }

    // 直接更新数量（输入框变化时）
    const updateItemQuantityDirect = (item, event) => {
      const newQuantity = parseFloat(event.target.value)
      if (isNaN(newQuantity) || newQuantity <= 0) {
        showMessage('数量必须大于0', 'error')
        event.target.value = item.quantity
        return
      }
      try {
        // 入库单：数量变化时重新计算单价（保持总价不变）
        if (localDocumentType.value === 'IN' && item.total_price > 0) {
          const newUnitPrice = item.total_price / newQuantity
          documentStore.updateItem(item.id, {
            quantity: newQuantity,
            unit_price: newUnitPrice
          })
        } else if (localDocumentType.value === 'OUT') {
          // 出库单：数量变化时根据产品的库存总价值按比例计算
          const product = item.product
          const productStock = product?.stock || 0
          const productTotalValue = product?.total_cost_value || 0
          let newTotalPrice
          if (newQuantity >= productStock && productTotalValue > 0) {
            newTotalPrice = productTotalValue
          } else if (productStock > 0 && productTotalValue > 0) {
            newTotalPrice = formatStorage(multiply(productTotalValue, divide(newQuantity, productStock)))
          } else {
            newTotalPrice = formatStorage(multiply(newQuantity, item.unit_price))
          }
          documentStore.updateItem(item.id, {
            quantity: newQuantity,
            total_price: newTotalPrice
          })
        } else {
          // 其他情况：只更新数量
          documentStore.updateItem(item.id, {
            quantity: newQuantity
          })
        }
      } catch (error) {
        showMessage(error.message || '更新失败', 'error')
        event.target.value = item.quantity
      }
    }

    // 更新入库单产品总价（自动计算单价，实时更新）
    const updateItemTotalPrice = (item, event) => {
      const newTotalPrice = parseFloat(event.target.value)
      // 输入过程中可能有空值或非法值，直接忽略不报错
      if (isNaN(newTotalPrice) || newTotalPrice < 0) {
        return
      }
      try {
        // 计算单价 = 总价 / 数量（仅用于前端展示）
        const newUnitPrice = item.quantity > 0 ? newTotalPrice / item.quantity : 0
        documentStore.updateItem(item.id, {
          total_price: newTotalPrice,
          unit_price: newUnitPrice
        })
      } catch (error) {
        // 静默处理错误，不干扰用户输入
        console.error('更新总价失败:', error)
      }
    }

    const cancelItemEdit = () => {
      editingItemId.value = null
    }

    const removeItem = (itemId) => {
      if (!confirm('确定要移除这个产品吗？')) return
      
      try {
        documentStore.removeItem(itemId)
        showMessage('已移除', 'success')
      } catch (error) {
        showMessage(error.message || '移除失败', 'error')
      }
    }

    const handleImageUpload = async (event) => {
      const file = event.target.files[0]
      if (!file) return
      
      try {
        await documentStore.uploadImage(file)
        showMessage('图片已上传', 'success')
      } catch (error) {
        showMessage(error.message || '上传失败', 'error')
      }
    }

    const getImageUrl = () => {
      // 优先使用 OCR 扫描的图片
      if (documentStore.documentImage?.url) {
        return documentStore.documentImage.url
      }
      // 然后使用已保存的图片
      if (documentStore.currentDocument?.id) {
        return `/api/documents/${documentStore.currentDocument.id}/image`
      }
      return ''
    }

    const handleSubmit = async () => {
      if (!documentStore.canSubmit) return
      
      // 出库单验证
      if (props.documentType === 'OUT') {
        if (!formData.value.requester_name) {
          showMessage('请填写领料人', 'error')
          return
        }
        if (!formData.value.purpose) {
          showMessage('请填写用途说明', 'error')
          return
        }
      }
      
      if (!confirm(`确定要提交这张${props.documentType === 'IN' ? '入库' : '出库'}单吗？\n\n产品数量: ${documentStore.itemCount}\n总金额: ¥${formatPrice(documentStore.totalValue)}`)) {
        return
      }
      
      try {
        // 如果勾选了延续上月单据，设置自定义时间为上月最后一天
        if (continueLastMonth.value) {
          const now = new Date()
          let year = now.getFullYear()
          let month = now.getMonth() + 1 // 1-12
          
          if (month === 1) {
            // 当前是1月，上个月是去年12月
            year = year - 1
            month = 12
          } else {
            month = month - 1
          }
          
          // 获取上月最后一天：new Date(year, month, 0)
          // month参数传入当前月（1-12），day参数为0时，返回上个月最后一天
          const lastDayOfPrevMonth = new Date(year, month, 0, 23, 59, 59, 999)
          const customTime = lastDayOfPrevMonth.toISOString()
          
          // 设置自定义创建时间到 store
          documentStore.currentDocument.custom_created_at = customTime
        }
        
        const result = await documentStore.submitDocument()
        showMessage(`单据提交成功！处理了 ${result.items_processed} 个产品`, 'success')
        
        // 刷新库存数据
        await inventoryStore.loadProducts()
        await inventoryStore.loadStats()
        await inventoryStore.loadRecentTransactions()
        
        emit('submitted', result)
        emit('close')
      } catch (error) {
        // 优先使用服务端返回的错误消息
        const errorMsg = error.response?.data?.error || error.message || '提交失败'
        showMessage(errorMsg, 'error')
      }
    }

    const handleCancel = async () => {
      try {
        await documentStore.cancelDocument()
        emit('close')
      } catch (error) {
        showMessage(error.message || '取消失败', 'error')
      }
    }

    const handleClose = () => {
      // 识别中不允许关闭
      if (documentStore.isRecognizing) {
        showMessage('正在识别中，请等待完成', 'warning')
        return
      }
      // 直接关闭，清空单据
      documentStore.clearCurrentDocument()
      emit('close')
    }

    // 更改单据类型
    const changeDocumentType = (newType) => {
      if (!isDraft.value) return
      const oldType = localDocumentType.value
      localDocumentType.value = newType
      if (documentStore.currentDocument) {
        documentStore.currentDocument.document_type = newType
        // 更新完整单据号（会自动更新前缀）
        updateFullDocumentNumber()
      }
      
      // 重新计算所有已添加产品的价格
      if (documentStore.documentItems.length > 0) {
        documentStore.documentItems.forEach(item => {
          if (newType === 'OUT') {
            // 切换到出库模式：使用产品数据库的current_unit_price
            const product = item.product
            if (product) {
              const unitPrice = product.current_unit_price || product.price || 0
              const totalPrice = item.quantity * unitPrice
              documentStore.updateItem(item.id, {
                unit_price: unitPrice,
                total_price: totalPrice
              })
            }
          } else if (newType === 'IN') {
            // 切换到入库模式：重置价格为0，需要用户重新输入
            documentStore.updateItem(item.id, {
              unit_price: 0,
              total_price: 0
            })
          }
        })
        showMessage(`已切换至${newType === 'IN' ? '入库' : '出库'}模式，价格已更新`, 'info')
      }
    }

    // 重新拍照（仅拍照更新图片，不重新识别单号）
    // 用于图片不清晰或拍摄不完整时重新拍照
    const handleRetakePhoto = async () => {
      try {
        const result = await documentStore.capturePhotoOnly()
        if (result?.success) {
          showMessage('拍照成功，图片已更新', 'success')
        } else {
          showMessage('拍照失败: ' + (result?.message || '未知错误'), 'error')
        }
      } catch (error) {
        console.error('重拍失败:', error)
        showMessage('重拍失败: ' + (error.message || '未知错误'), 'error')
      }
    }

    // 重新识别（重新拍照 + OCR识别单号）
    // 用于单号识别失败或识别错误时重新识别
    const handleReRecognize = async () => {
      try {
        const result = await documentStore.retakeAndRecognize()
        if (result?.success) {
          // 同步本地变量
          if (documentStore.currentDocument) {
            localDocumentType.value = documentStore.currentDocument.document_type
            localDocumentNumber.value = documentStore.currentDocument.document_number
          }
          showMessage('识别完成: ' + (result.result?.serial_number || ''), 'success')
        } else {
          showMessage('识别失败: ' + (result?.message || '请手动填写单号'), 'warning')
        }
      } catch (error) {
        console.error('重新识别失败:', error)
        showMessage('识别失败: ' + (error.message || '未知错误'), 'error')
      }
    }

    // 拍照识别（手动模式下使用）
    const handleCapturePhoto = async () => {
      try {
        const result = await documentStore.capturePhoto()
        if (result?.success) {
          // capturePhoto 内部已经调用了 updateFromOcr，这里只需同步本地变量
          if (documentStore.currentDocument) {
            localDocumentType.value = documentStore.currentDocument.document_type
            localDocumentNumber.value = documentStore.currentDocument.document_number
            // 解析中间7位
            const match = localDocumentNumber.value.match(/^[CR](\d{7})-/)
            if (match) {
              documentNumberMiddle.value = match[1]
            }
          }
          showMessage('识别成功: ' + (result.result?.serial_number || ''), 'success')
        } else {
          showMessage('识别失败: ' + (result?.message || '请手动填写'), 'warning')
        }
      } catch (error) {
        console.error('拍照失败:', error)
        showMessage('拍照失败: ' + (error.message || '未知错误'), 'error')
      }
    }

    const formatQuantity = (quantity) => {
      if (!quantity && quantity !== 0) return '0'
      const num = parseFloat(quantity)
      if (isNaN(num)) return '0'
      if (num % 1 === 0) return num.toString()
      return num.toFixed(3).replace(/\.?0+$/, '')
    }

    const formatPrice = (price) => {
      if (typeof price !== 'number') price = parseFloat(price) || 0
      if (price === 0) return '0'
      if (price === Math.floor(price)) return price.toString()
      // 保留4位小数，去掉末尾的0
      return price.toFixed(4).replace(/\.?0+$/, '')
    }

    // 实时计算显示用的单价（仅用于前端展示，不影响后端计算）
    const calculateDisplayUnitPrice = (item) => {
      const totalPrice = parseFloat(item.total_price) || 0
      const quantity = parseFloat(item.quantity) || 0
      if (quantity <= 0) return '0'
      const unitPrice = totalPrice / quantity
      if (unitPrice === 0) return '0'
      if (unitPrice === Math.floor(unitPrice)) return unitPrice.toString()
      // 单价显示原值，去掉末尾的0（不强制精度）
      return unitPrice.toString().replace(/\.?0+$/, '')
    }

    const showMessage = (message, type = 'info') => {
      const toast = document.createElement('div')
      toast.className = `toast toast-${type}`
      toast.textContent = message
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10001;
        background: ${type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#4299e1'};
        animation: slideIn 0.3s ease;
      `
      document.body.appendChild(toast)
      setTimeout(() => toast.remove(), 3000)
    }

    return {
      documentStore,
      formData,
      projects,
      isDraft,
      statusText,
      showProductSearch,
      showSearchResults,
      productSearchQuery,
      productSearchResults,
      searching,
      productSearchInput,
      selectedProductToAdd,
      addProductForm,
      canAddProduct,
      quickEditProduct,
      quickEditForm,
      quickEditQuantityInput,
      canQuickAdd,
      editingItemId,
      editingQuantity,
      showFullImage,
      imageInput,
      localDocumentType,
      localDocumentNumber,
      documentNumberMiddle,
      currentYearMonth,
      displayYearMonth,
      continueLastMonth,
      onContinueLastMonthChange,
      onMiddleNumberChange,
      onMiddleNumberInput,
      onMiddleNumberBlur,
      searchProducts,
      clearProductSearch,
      quickAddProduct,
      confirmQuickAdd,
      selectProductToAdd,
      confirmAddProduct,
      startItemEdit,
      saveItemEdit,
      cancelItemEdit,
      adjustItemQuantity,
      updateItemQuantityDirect,
      updateItemTotalPrice,
      removeItem,
      handleImageUpload,
      getImageUrl,
      handleSubmit,
      handleCancel,
      handleClose,
      changeDocumentType,
      handleRetakePhoto,
      handleReRecognize,
      handleCapturePhoto,
      formatQuantity,
      formatPrice,
      calculateDisplayUnitPrice
    }
  }
}
</script>

<style scoped>
/* 识别中覆盖层 */
.recognizing-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  border-radius: 16px;
}

.recognizing-content {
  text-align: center;
}

.recognizing-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #e2e8f0;
  border-top: 4px solid #4299e1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.recognizing-text {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 8px;
}

.recognizing-hint {
  font-size: 14px;
  color: #718096;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.recognizing-percent {
  font-weight: 600;
  color: #4299e1;
  min-width: 35px;
}

/* 识别进度条 */
.recognizing-progress-bar {
  height: 4px;
  background: #e2e8f0;
  border-radius: 2px;
  margin-bottom: 8px;
  overflow: hidden;
}

.recognizing-progress-bar .progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4299e1, #63b3ed);
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* 单据类型选择器 */
.document-type-selector {
  display: flex;
  background: #e2e8f0;
  border-radius: 10px;
  padding: 4px;
  gap: 4px;
}

.type-btn {
  padding: 10px 20px;
  border: 2px solid transparent;
  background: transparent;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #718096;
  cursor: pointer;
  transition: all 0.25s ease;
}

.type-btn:hover {
  background: rgba(255, 255, 255, 0.6);
}

/* 入库按钮激活状态 */
.type-btn.in-btn.active {
  background: #38a169;
  color: white;
  border-color: #2f855a;
  box-shadow: 0 2px 8px rgba(56, 161, 105, 0.4);
}

.type-btn.in-btn:not(.active):hover {
  background: #c6f6d5;
  color: #22543d;
}

/* 出库按钮激活状态 */
.type-btn.out-btn.active {
  background: #e53e3e;
  color: white;
  border-color: #c53030;
  box-shadow: 0 2px 8px rgba(229, 62, 62, 0.4);
}

.type-btn.out-btn:not(.active):hover {
  background: #fed7d7;
  color: #742a2a;
}

/* 单据号分段输入 */
.document-number-input {
  display: flex;
  align-items: center;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0;
  overflow: hidden;
}

.doc-prefix {
  padding: 10px 12px;
  background: #edf2f7;
  color: #4a5568;
  font-weight: 700;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 15px;
  border-right: 1px solid #e2e8f0;
}

.doc-middle-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 10px 8px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 15px;
  font-weight: 600;
  color: #2d3748;
  text-align: center;
  letter-spacing: 1px;
  outline: none;
  min-width: 90px;
}

.doc-middle-input:focus {
  background: #fff;
}

.doc-middle-input:read-only {
  background: #f7fafc;
  color: #718096;
}

.doc-suffix {
  padding: 10px 12px;
  background: #edf2f7;
  color: #4a5568;
  font-weight: 600;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 15px;
  border-left: 1px solid #e2e8f0;
}

/* 可编辑提示 */
.editable-hint {
  font-size: 12px;
  color: #4299e1;
  font-weight: normal;
}

/* 识别中提示 */
.recognizing-hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #dd6b20;
  font-weight: 600;
  margin-left: 10px;
  padding: 4px 12px;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border-radius: 12px;
  border: 1px solid #f6ad55;
  animation: glowing 1.5s ease-in-out infinite;
}

@keyframes glowing {
  0%, 100% { 
    box-shadow: 0 0 5px rgba(237, 137, 54, 0.3);
  }
  50% { 
    box-shadow: 0 0 15px rgba(237, 137, 54, 0.6);
  }
}

.recognizing-spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid #fed7aa;
  border-top-color: #dd6b20;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.document-number-input.is-recognizing {
  border-color: #f6ad55;
  box-shadow: 0 0 0 3px rgba(246, 173, 85, 0.3);
  animation: pulse-border 1.5s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% { 
    box-shadow: 0 0 0 3px rgba(246, 173, 85, 0.3);
  }
  50% { 
    box-shadow: 0 0 0 5px rgba(246, 173, 85, 0.5);
  }
}

/* 图片操作按钮 */
.image-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  justify-content: center;
}

.image-actions .btn {
  padding: 6px 12px;
  font-size: 13px;
}

/* 上传选项 */
.upload-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.upload-options .btn {
  width: 150px;
}

.document-editor {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
  overflow-y: auto;
}

.document-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.document-panel {
  position: relative;
  width: 100%;
  max-width: 900px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  margin: 20px 0;
}

/* 头部 */
.document-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border-radius: 16px 16px 0 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.document-type-badge {
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
}

.document-type-badge.IN {
  background: #c6f6d5;
  color: #22543d;
}

.document-type-badge.OUT {
  background: #fed7d7;
  color: #742a2a;
}

.document-number {
  font-family: monospace;
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

.document-status {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.document-status.draft {
  background: #fef3c7;
  color: #92400e;
}

.document-status.submitted {
  background: #c6f6d5;
  color: #22543d;
}

.document-status.cancelled {
  background: #e2e8f0;
  color: #4a5568;
}

.btn-icon {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: #edf2f7;
}

/* 信息区域 */
.document-info-section {
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.info-icon {
  font-size: 18px;
}

.info-title {
  font-weight: 600;
  color: #2d3748;
}

.info-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 单据号重复警告 */
.document-number-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border: 1px solid #f59e0b;
  border-radius: 8px;
  margin-bottom: 8px;
}

.document-number-warning .warning-icon {
  font-size: 18px;
}

.document-number-warning .warning-text {
  color: #92400e;
  font-size: 14px;
  font-weight: 500;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #4a5568;
}

.required-mark {
  color: #e53e3e;
}

.form-input, .form-select {
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
}

.form-input.readonly {
  background: #f7fafc;
  color: #718096;
}

/* 延续上月单据复选框 */
.continue-last-month-option {
  margin-top: 10px;
  padding: 8px 12px;
  background: #fffaf0;
  border: 1px solid #fbd38d;
  border-radius: 6px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  margin-right: 8px;
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: #ed8936;
}

.checkbox-text {
  font-size: 13px;
  color: #744210;
  font-weight: 500;
}

/* 产品列表区域 */
.document-items-section {
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  min-height: 200px;
}

.items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.items-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #2d3748;
}

.items-count {
  padding: 2px 8px;
  background: #edf2f7;
  border-radius: 12px;
  font-size: 12px;
  color: #718096;
}

/* 产品搜索弹窗 */
.product-search-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 100px;
}

.search-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
}

.search-modal-content {
  position: relative;
  width: 100%;
  max-width: 500px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-height: 70vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.search-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  font-weight: 600;
}

.search-modal-body {
  padding: 16px 20px;
  overflow-y: auto;
}

.search-results {
  margin-top: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.search-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.search-result-item:hover {
  background: #f7fafc;
}

.product-info {
  flex: 1;
}

.product-name {
  font-weight: 500;
  color: #2d3748;
}

.product-details {
  font-size: 12px;
  color: #718096;
  margin-top: 2px;
}

.product-stock {
  font-weight: 600;
  color: #38a169;
  padding: 4px 8px;
  background: #f0fff4;
  border-radius: 4px;
}

.product-stock.low {
  color: #e53e3e;
  background: #fff5f5;
}

.no-results {
  text-align: center;
  color: #718096;
  padding: 20px;
}

/* 添加产品表单 */
.add-product-form {
  background: #f7fafc;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.add-product-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
  color: #2d3748;
}

.add-product-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

/* 产品列表 */
.items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.item-card {
  background: #f7fafc;
  border-radius: 10px;
  padding: 14px 16px;
  transition: box-shadow 0.2s;
}

.item-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.item-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-weight: 600;
  font-size: 16px;
  color: #2d3748;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-details {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 4px;
}

.item-barcode {
  font-size: 14px;
  color: #718096;
}

.item-stock {
  font-size: 14px;
  color: #48bb78;
  font-weight: 500;
}

.item-quantity {
  min-width: 80px;
  text-align: center;
}

/* 数量控制区域 - 带快速调整按钮 */
.item-quantity-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.qty-btn {
  min-width: 40px;
  height: 36px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qty-btn:active {
  transform: scale(0.95);
}

.qty-btn.minus-10, .qty-btn.minus-1 {
  background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
  color: #c53030;
}

.qty-btn.minus-10:hover, .qty-btn.minus-1:hover {
  background: linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%);
}

.qty-btn.plus-1, .qty-btn.plus-10 {
  background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%);
  color: #276749;
}

.qty-btn.plus-1:hover, .qty-btn.plus-10:hover {
  background: linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%);
}

.quantity-input-inline {
  width: 80px;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  color: #2d3748;
  transition: border-color 0.15s ease;
}

.quantity-input-inline:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
}

/* 隐藏数字输入框的上下箭头 */
.quantity-input-inline::-webkit-outer-spin-button,
.quantity-input-inline::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.quantity-input-inline[type=number] {
  -moz-appearance: textfield;
}

.quantity-value {
  font-weight: 600;
  font-size: 16px;
  color: #2d3748;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.quantity-value:hover {
  background: #edf2f7;
}

.quantity-input {
  width: 80px;
  padding: 6px 8px;
  border: 2px solid #4299e1;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
}

.item-price {
  min-width: 180px;
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
}

/* 入库单总价输入区域 */
.total-price-input {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.total-price-input label {
  font-size: 14px;
  color: #4a5568;
  white-space: nowrap;
  font-weight: 500;
}

.price-input-inline {
  width: 100px;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  text-align: right;
  color: #38a169;
  transition: border-color 0.15s ease;
}

.price-input-inline:focus {
  outline: none;
  border-color: #38a169;
  box-shadow: 0 0 0 3px rgba(56, 161, 105, 0.15);
}

.price-input-inline::-webkit-outer-spin-button,
.price-input-inline::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.price-input-inline[type=number] {
  -moz-appearance: textfield;
}

.unit-price {
  font-size: 14px;
  color: #4a5568;
  font-weight: 500;
}

.total-price {
  font-size: 15px;
  font-weight: 600;
  color: #2d3748;
}

.item-actions {
  display: flex;
  gap: 4px;
}

.btn-icon.edit:hover {
  background: #ebf8ff;
}

.btn-icon.delete:hover {
  background: #fff5f5;
}

/* 空状态 */
.items-empty {
  text-align: center;
  padding: 40px 20px;
  color: #718096;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 13px;
}

/* 图片区域 */
.document-image-section {
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.image-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  color: #2d3748;
}

.image-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.image-preview img {
  width: 100%;
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.image-preview img:hover {
  transform: scale(1.01);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.image-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

/* 底部 */
.document-footer {
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f7fafc;
  border-radius: 0 0 16px 16px;
}

.footer-stats {
  display: flex;
  gap: 24px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 12px;
  color: #718096;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

.stat-item.total .stat-value {
  color: #38a169;
  font-size: 18px;
}

.footer-actions {
  display: flex;
  gap: 12px;
}

/* 按钮样式 */
.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-lg {
  padding: 12px 24px;
  font-size: 15px;
}

.btn-primary {
  background: #4299e1;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #3182ce;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-outline {
  background: white;
  border: 1px solid #e2e8f0;
  color: #4a5568;
}

.btn-outline:hover {
  background: #f7fafc;
  border-color: #cbd5e0;
}

/* 全屏图片预览 */
.full-image-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 10002;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.full-image-modal img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* OCR识别结果摘要样式 - 横向紧凑布局 */
.ocr-summary-section {
  margin: 0 24px 12px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%);
  border-radius: 10px;
  border: 1px solid #93c5fd;
}

.ocr-summary-compact {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.ocr-icon {
  font-size: 16px;
}

.ocr-serial {
  font-family: monospace;
  font-weight: 600;
  font-size: 15px;
  background: white;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #bfdbfe;
  color: #1e3a8a;
}

.ocr-confidence {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ocr-badge {
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}

.ocr-badge.in {
  background: #dcfce7;
  color: #166534;
}

.ocr-badge.out {
  background: #fee2e2;
  color: #991b1b;
}

.confidence-bar {
  width: 60px;
  height: 6px;
  background: #dbeafe;
  border-radius: 3px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.confidence-text {
  font-weight: 600;
  font-size: 13px;
  color: #2563eb;
}

.ocr-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.keyword-tag {
  background: white;
  color: #2563eb;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  border: 1px solid #bfdbfe;
}

.ocr-tip {
  font-size: 12px;
  color: #1e40af;
  margin-left: auto;
}

/* 内联产品搜索样式 */
.inline-product-search {
  margin-bottom: 16px;
  position: relative;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 14px;
  font-size: 16px;
  color: #94a3b8;
  pointer-events: none;
}

.product-search-input {
  width: 100%;
  padding: 12px 40px 12px 44px;
  font-size: 15px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  outline: none;
  transition: all 0.2s ease;
  background: #f8fafc;
}

.product-search-input:focus {
  border-color: #3b82f6;
  background: white;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.product-search-input::placeholder {
  color: #94a3b8;
}

.clear-search-btn {
  position: absolute;
  right: 12px;
  background: #e2e8f0;
  border: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.clear-search-btn:hover {
  background: #cbd5e0;
  color: #475569;
}

/* 搜索结果下拉 */
.search-results-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
  max-height: 320px;
  overflow-y: auto;
  z-index: 100;
}

.results-list {
  padding: 6px;
}

.search-results-dropdown .search-result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.search-results-dropdown .search-result-item:hover {
  background: #f0f9ff;
  border-color: #bfdbfe;
}

.search-results-dropdown .product-info {
  flex: 1;
  min-width: 0;
}

.search-results-dropdown .product-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-results-dropdown .product-details {
  font-size: 12px;
  color: #64748b;
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-results-dropdown .product-details .barcode {
  font-family: monospace;
  background: #f1f5f9;
  padding: 1px 6px;
  border-radius: 4px;
}

.search-results-dropdown .product-details .separator {
  color: #cbd5e0;
}

.search-results-dropdown .product-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.search-results-dropdown .product-stock {
  font-size: 12px;
  color: #16a34a;
  font-weight: 500;
}

.search-results-dropdown .product-stock.low {
  color: #dc2626;
}

.search-results-dropdown .product-price {
  font-size: 11px;
  color: #64748b;
}

.search-results-dropdown .add-hint {
  font-size: 11px;
  color: #3b82f6;
  font-weight: 500;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.search-results-dropdown .search-result-item:hover .add-hint {
  opacity: 1;
}

.search-results-dropdown .no-results,
.search-results-dropdown .searching {
  padding: 24px;
  text-align: center;
  color: #64748b;
  font-size: 14px;
}

.search-results-dropdown .no-results-icon {
  display: block;
  font-size: 24px;
  margin-bottom: 8px;
}

/* 快速编辑弹窗 */
.quick-edit-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 10003;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quick-edit-modal {
  background: white;
  border-radius: 16px;
  width: 380px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  animation: modalIn 0.2s ease;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.quick-edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.quick-edit-header .edit-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.quick-edit-body {
  padding: 20px;
}

.quick-edit-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 10px 14px;
  background: #f8fafc;
  border-radius: 8px;
  font-size: 13px;
}

.quick-edit-info .barcode {
  font-family: monospace;
  color: #475569;
}

.quick-edit-info .stock {
  color: #16a34a;
  font-weight: 500;
}

.quick-edit-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.quick-edit-form .form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quick-edit-form label {
  font-size: 13px;
  font-weight: 500;
  color: #475569;
}

.quick-edit-form .form-input {
  padding: 10px 14px;
  font-size: 15px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.15s ease;
}

.quick-edit-form .form-input:focus {
  border-color: #3b82f6;
}

.quick-edit-form .form-input.readonly {
  background: #f8fafc;
  color: #64748b;
}

.quick-edit-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.quick-edit-actions .btn {
  flex: 1;
  padding: 10px 16px;
  font-size: 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.quick-edit-actions .btn-outline {
  background: white;
  border: 1px solid #e2e8f0;
  color: #475569;
}

.quick-edit-actions .btn-outline:hover {
  background: #f8fafc;
}

.quick-edit-actions .btn-primary {
  background: #3b82f6;
  border: none;
  color: white;
}

.quick-edit-actions .btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.quick-edit-actions .btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
