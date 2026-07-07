<template>
  <div class="scanner-page">
    <!-- 当前单据提示 -->
    <div v-if="documentStore.currentDocument" class="current-document-bar">
      <div class="document-info">
        <span class="document-badge" :class="documentStore.currentDocument.document_type">
          {{ documentStore.currentDocument.document_type === 'IN' ? '入库单' : '出库单' }}
        </span>
        <span class="document-number">{{ documentStore.currentDocument.document_number }}</span>
        <span class="document-items">{{ documentStore.itemCount }} 个产品</span>
      </div>
      <div class="document-actions">
        <button class="btn btn-outline btn-sm" @click="showDocumentEditor = true">
          编辑单据
        </button>
        <button class="btn btn-primary btn-sm" @click="submitCurrentDocument" :disabled="!documentStore.canSubmit">
          提交单据
        </button>
      </div>
    </div>

    <!-- 单据操作区域 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">出库入库</div>
        <div class="card-subtitle">通过单据进行出入库操作</div>
      </div>
      <div class="card-body">
        <!-- 单据操作按钮 -->
        <div class="document-buttons-main">
          <!-- 快速识别按钮 - 直接拍照识别 -->
          <button 
            class="doc-btn ocr-btn"
            @click="quickOcrScan"
            :disabled="isScanning || cameraCooldown > 0"
          >
            <span class="btn-icon">📷</span>
            <span class="btn-label">{{ isScanning ? '识别中...' : (cameraCooldown > 0 ? `等待 ${cameraCooldown}s` : '识别单据') }}</span>
            <span class="btn-desc">拍照自动识别单号</span>
          </button>
          
          <!-- 手动填写按钮 -->
          <button 
            class="doc-btn manual-btn"
            @click="openManualDocument"
          >
            <span class="btn-icon">📝</span>
            <span class="btn-label">单据填写</span>
            <span class="btn-desc">手动填写单据信息</span>
          </button>
          
          <!-- 重连相机按钮 -->
          <button 
            class="doc-btn camera-btn"
            @click="restartCamera"
            :disabled="cameraRestarting"
          >
            <span class="btn-icon">{{ cameraRestarting ? '⏳' : '🔄' }}</span>
            <span class="btn-label">{{ cameraRestarting ? '重连中...' : '重连相机' }}</span>
            <span class="btn-desc">拍照黑屏时点击</span>
          </button>
          
          <!-- 相机状态指示器 -->
          <div class="camera-status-indicator">
            <span class="status-dot" :class="cameraStatusClass"></span>
            <span class="status-text">{{ cameraStatusText }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 最近交易记录 -->
    <div class="card mt-4">
      <div class="card-header">
        <div class="card-title">最近交易记录</div>
        <div class="card-subtitle">显示最近20条出入库操作</div>
      </div>
      <div class="card-body">
        <div v-if="recentTransactions.length === 0" class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">暂无交易记录</div>
          <div class="empty-state-subtext">通过单据进行出入库操作</div>
        </div>
        <div v-else class="transactions-table">
          <!-- 表头 -->
          <div class="transaction-header">
            <div class="header-cell type">类型</div>
            <div class="header-cell product">产品信息</div>
            <div class="header-cell datetime">操作时间</div>
            <div class="header-cell quantity">数量</div>
            <div class="header-cell unit-price">当时单价</div>
            <div class="header-cell total-price">操作合计</div>
            <div class="header-cell requester">领料人</div>
            <div class="header-cell project">领用单位/部门</div>
            <div class="header-cell purpose">用途说明</div>
            <div class="header-cell current-stock">交易后库存</div>
            <div class="header-cell stock-unit-price">库存单价</div>
            <div class="header-cell stock-value">库存价值</div>
          </div>
          
          <!-- 数据行 -->
          <div 
            v-for="transaction in recentTransactions" 
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
                <div class="product-code">{{ transaction.barcode }}</div>
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
                {{ formatQuantity(transaction.stock_after) }}
              </span>
            </div>
            <div class="table-cell stock-unit-price">
              <span class="price-value stock-unit">¥{{ formatPrice(transaction.stock_unit_price) }}</span>
            </div>
            <div class="table-cell stock-value">
              <span class="price-value stock">¥{{ formatPrice(transaction.stock_value) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Document Editor Modal -->
    <DocumentEditor
      :show="showDocumentEditor"
      :documentType="documentStore.currentDocument?.document_type || 'OUT'"
      @close="closeDocumentEditor"
      @submitted="handleDocumentSubmitted"
    />

    <!-- Camera Preview Modal -->
    <div v-if="showCameraPreview" class="camera-preview-modal">
      <div class="modal-overlay" @click="closeCameraPreview"></div>
      <div class="camera-modal-content">
        <div class="camera-modal-header">
          <span class="modal-title">📷 识别单据</span>
          <button class="btn-icon" @click="closeCameraPreview">✕</button>
        </div>
        <div class="camera-modal-body">
          <div class="camera-container">
            <img 
              :src="videoStreamUrl" 
              class="camera-video"
              :class="{ 'hidden': !cameraConnected }"
              alt="摄像头预览"
              @load="cameraConnected = true"
              @error="handleVideoError"
            />
            <div v-if="!cameraConnected" class="camera-loading">
              <div class="loading-spinner"></div>
              <p>正在连接摄像头...</p>
            </div>
          </div>
          <div class="camera-controls">
            <p class="camera-tip">将单据放置在摄像头前，点击"拍照识别"按钮</p>
            <button 
              class="btn btn-primary btn-lg capture-btn"
              @click="captureAndRecognize"
              :disabled="isCapturing || !cameraConnected"
            >
              <span v-if="isCapturing">🔄 识别中...</span>
              <span v-else>📸 拍照识别</span>
            </button>
            <button class="btn btn-outline" @click="closeCameraPreview">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useInventoryStore } from '@/stores/inventory'
import { useDocumentStore } from '@/stores/document'
import DocumentEditor from './DocumentEditor.vue'

export default {
  name: 'ScannerPage',
  components: {
    DocumentEditor
  },
  setup() {
    const inventoryStore = useInventoryStore()
    const documentStore = useDocumentStore()
    
    // Document related state
    const showDocumentEditor = ref(false)
    const isScanning = ref(false)
    const cameraRestarting = ref(false)
    const cameraCooldown = ref(0)  // 重启后冷却倒计时
    const cameraStatus = ref('unknown')  // 'connected', 'disconnected', 'unknown'
    let statusCheckInterval = null
    let cooldownInterval = null
    
    // Camera service URL from environment
    const cameraServiceBaseUrl = import.meta.env.VITE_CAMERA_SERVICE_URL || 'http://localhost:8766'
    
    // Camera preview state
    const showCameraPreview = ref(false)
    const cameraConnected = ref(false)
    const cameraBusy = ref(false)  // 相机是否正在处理其他请求
    const isCapturing = ref(false)
    const videoStreamUrl = ref(`${cameraServiceBaseUrl}/video/stream`)
    
    // Computed properties
    const recentTransactions = computed(() => inventoryStore.transactions.slice(0, 20))
    
    const cameraStatusClass = computed(() => {
      if (cameraBusy.value) return 'status-busy'
      if (cameraStatus.value === 'connected') return 'status-connected'
      if (cameraStatus.value === 'disconnected') return 'status-disconnected'
      return 'status-unknown'
    })
    
    const cameraStatusText = computed(() => {
      if (cameraBusy.value) return '相机忙碌中'
      if (cameraStatus.value === 'connected') return '相机已连接'
      if (cameraStatus.value === 'disconnected') return '相机未连接'
      return '检测中...'
    })
    
    // Toast notification
    const showToast = (message, type = 'info') => {
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
        z-index: 9999;
        background: ${type === 'success' ? '#48bb78' : type === 'warning' ? '#ed8936' : type === 'error' ? '#e53e3e' : '#4299e1'};
        animation: slideIn 0.3s ease;
      `
      document.body.appendChild(toast)
      setTimeout(() => toast.remove(), 3000)
    }
    
    // 格式化方法
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
      if (price === 0) return '0'
      if (price === Math.floor(price)) return price.toString()
      const str = price.toString()
      if (str.includes('.')) {
        const [integer, decimal] = str.split('.')
        const trimmedDecimal = decimal.substring(0, 4).replace(/0+$/, '')
        return trimmedDecimal ? integer + '.' + trimmedDecimal : integer
      }
      return str
    }
    
    const formatQuantity = (quantity) => {
      if (!quantity && quantity !== 0) return '0'
      const num = parseFloat(quantity)
      if (isNaN(num)) return '0'
      if (num % 1 === 0) return num.toString()
      return num.toFixed(3).replace(/\.?0+$/, '')
    }
    
    // ==================== 单据操作方法 ====================
    
    // 快速OCR识别
    const quickOcrScan = async () => {
      if (isScanning.value) return
      
      isScanning.value = true
      
      // 先打开单据编辑窗口，显示识别中状态
      documentStore.startRecognizing()
      showDocumentEditor.value = true
      
      try {
        const cameraServiceUrl = import.meta.env.VITE_CAMERA_SERVICE_URL || 'http://localhost:8766'
        
        // 更新进度：拍照中
        documentStore.updateRecognizingProgress('正在拍照...', 20)
        
        // 阶段1: 快速拍照，立即获得预览图（15秒超时）
        const photoController = new AbortController()
        const photoTimeout = setTimeout(() => photoController.abort(), 15000)
        
        const photoResponse = await fetch(`${cameraServiceUrl}/camera/photo`, { 
          method: 'POST',
          signal: photoController.signal
        })
        clearTimeout(photoTimeout)
        const photoResult = await photoResponse.json()
        
        if (!photoResult.success) {
          throw new Error(photoResult.message || '拍照失败')
        }
        
        // 立即显示预览图
        documentStore.updateRecognizingProgress('已拍照，正在识别...', 40)
        documentStore.setPreviewImage(photoResult)
        
        // 阶段2: 异步进行 OCR 识别（不阻塞预览显示，30秒超时）
        documentStore.updateRecognizingProgress('正在OCR识别...', 60)
        
        const ocrController = new AbortController()
        const ocrTimeout = setTimeout(() => ocrController.abort(), 30000)
        
        const ocrResponse = await fetch(`${cameraServiceUrl}/ocr/recognize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: photoResult.temp_file_id, backend_url: window.location.origin }),
          signal: ocrController.signal
        })
        clearTimeout(ocrTimeout)
        const ocrResult = await ocrResponse.json()
        
        console.log('🔍 OCR识别返回结果:', JSON.stringify(ocrResult, null, 2))
        
        // 更新进度：处理结果
        documentStore.updateRecognizingProgress('处理识别结果...', 90)
        
        if (ocrResult.success && ocrResult.serial_number) {
          documentStore.updateRecognizingProgress('识别完成', 100)
          showToast(`✅ 识别成功: ${ocrResult.serial_number}`, 'success')
          
          // 合并预览图信息和 OCR 结果
          const mergedData = {
            ...photoResult,
            ...ocrResult
          }
          console.log('📦 合并后的数据:', JSON.stringify(mergedData, null, 2))
          
          await documentStore.updateFromOcr(mergedData)
        } else {
          showToast('⚠️ 识别失败，请手动填写单号或点击重新识别', 'warning')
          // 识别失败但保留图片，允许用户重新识别
          documentStore.finishRecognizingWithImage(photoResult)
        }
      } catch (error) {
        console.error('快速识别错误:', error)
        if (error.name === 'AbortError') {
          showToast('⏰ 识别超时，请检查相机连接或重试', 'error')
        } else {
          showToast('❌ OCR服务连接失败', 'error')
        }
        documentStore.finishRecognizing(false)
      } finally {
        isScanning.value = false
      }
    }
    
    // 手动填写单据
    const openManualDocument = () => {
      documentStore.initNewDocument('out')
      showDocumentEditor.value = true
    }
    
    // 关闭单据编辑器
    const closeDocumentEditor = () => {
      showDocumentEditor.value = false
      documentStore.clearCurrentDocument()
    }
    
    // 单据提交成功回调
    const handleDocumentSubmitted = async () => {
      showDocumentEditor.value = false
      showToast('✅ 单据提交成功！', 'success')
      await inventoryStore.loadProducts()
      await inventoryStore.loadRecentTransactions()
    }
    
    // 提交当前单据
    const submitCurrentDocument = async () => {
      try {
        await documentStore.submitDocument()
        showDocumentEditor.value = false
        showToast('✅ 单据提交成功！', 'success')
        await inventoryStore.loadProducts()
        await inventoryStore.loadRecentTransactions()
      } catch (error) {
        console.error('提交失败:', error)
        showToast('❌ 提交失败: ' + (error.message || '未知错误'), 'error')
      }
    }
    
    // ==================== 摄像头预览相关方法 ====================
    
    const openCameraPreview = async () => {
      showCameraPreview.value = true
      cameraConnected.value = false
      const cameraServiceUrl = import.meta.env.VITE_CAMERA_SERVICE_URL || 'http://localhost:8766'
      videoStreamUrl.value = `${cameraServiceUrl}/video/stream`
    }
    
    const closeCameraPreview = async () => {
      showCameraPreview.value = false
      cameraConnected.value = false
      videoStreamUrl.value = ''
      try {
        const cameraServiceUrl = import.meta.env.VITE_CAMERA_SERVICE_URL || 'http://localhost:8766'
        await fetch(`${cameraServiceUrl}/video/stop`, { method: 'POST' })
      } catch (error) {
        console.log('停止视频流:', error.message)
      }
    }
    
    const captureAndRecognize = async () => {
      if (isCapturing.value) return
      
      isCapturing.value = true
      showToast('📷 正在拍照识别...', 'info')
      
      try {
        const cameraServiceUrl = import.meta.env.VITE_CAMERA_SERVICE_URL || 'http://localhost:8766'
        
        // 拍照和OCR识别（30秒超时）
        const captureController = new AbortController()
        const captureTimeout = setTimeout(() => captureController.abort(), 30000)
        
        const response = await fetch(`${cameraServiceUrl}/camera/capture`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backend_url: window.location.origin }),
          signal: captureController.signal
        })
        clearTimeout(captureTimeout)
        const result = await response.json()
        
        if (result.success && result.serial_number) {
          showToast(`✅ 识别成功: ${result.serial_number}`, 'success')
          closeCameraPreview()
          await documentStore.createFromOcr(result)
          showDocumentEditor.value = true
        } else if (result.success === false && result.allow_manual_input) {
          showToast('⚠️ OCR识别失败，请手动输入单号', 'warning')
          closeCameraPreview()
          documentStore.initNewDocument('out')
          showDocumentEditor.value = true
        } else {
          showToast(result.message || 'OCR识别失败，请重试', 'error')
        }
      } catch (error) {
        console.error('拍照识别错误:', error)
        if (error.name === 'AbortError') {
          showToast('⏰ 拍照识别超时，请重试', 'error')
        } else {
          showToast('❌ OCR服务连接失败', 'error')
        }
      } finally {
        isCapturing.value = false
      }
    }
    
    const restartCamera = async () => {
      if (cameraRestarting.value) return
      
      cameraRestarting.value = true
      cameraStatus.value = 'unknown'
      // 立即启动冷却时间，让识别按钮变灰
      startCooldown(5)
      showToast('🔄 正在重连相机...', 'info')
      
      try {
        // 直接调用相机服务的重连接口
        const cameraServiceUrl = import.meta.env.VITE_CAMERA_SERVICE_URL || 'http://localhost:8766'
        const response = await fetch(`${cameraServiceUrl}/camera/reconnect`, { method: 'POST' })
        const result = await response.json()
        
        if (result.success) {
          showToast('✅ 相机已重连，等待5秒后可识别', 'success')
        } else {
          showToast('❌ 重连失败: ' + (result.message || '未知错误'), 'error')
          // 重连失败，取消冷却
          cameraCooldown.value = 0
          if (cooldownInterval) {
            clearInterval(cooldownInterval)
            cooldownInterval = null
          }
        }
      } catch (error) {
        console.error('重连相机错误:', error)
        showToast('❌ 连接失败，请检查相机服务是否运行', 'error')
        // 连接失败，取消冷却
        cameraCooldown.value = 0
        if (cooldownInterval) {
            clearInterval(cooldownInterval)
            cooldownInterval = null
          }
      } finally {
        cameraRestarting.value = false
      }
    }
    
    // 启动冷却倒计时
    const startCooldown = (seconds) => {
      cameraCooldown.value = seconds
      if (cooldownInterval) clearInterval(cooldownInterval)
      cooldownInterval = setInterval(() => {
        cameraCooldown.value--
        if (cameraCooldown.value <= 0) {
          clearInterval(cooldownInterval)
          cooldownInterval = null
          // 冷却结束后检查一次状态
          checkCameraStatus()
        }
      }, 1000)
    }
    
    // 检查相机状态（静默模式，不打印错误）
    const checkCameraStatus = async () => {
      // 如果正在冷却中，不检查状态
      if (cameraCooldown.value > 0) return
      
      try {
        const cameraServiceUrl = import.meta.env.VITE_CAMERA_SERVICE_URL || 'http://localhost:8766'
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        
        const response = await fetch(`${cameraServiceUrl}/camera/status`, { 
          method: 'GET',
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        
        const result = await response.json()
        // 优先检查busy状态，然后检查connected状态
        if (result.busy) {
          cameraStatus.value = 'busy'
        } else if (result.connected) {
          cameraStatus.value = 'connected'
        } else {
          cameraStatus.value = 'disconnected'
        }
      } catch (error) {
        // 静默处理错误，只更新状态
        cameraStatus.value = 'disconnected'
      }
    }
    
    const handleVideoError = () => {
      cameraConnected.value = false
      console.log('摄像头连接失败')
    }
    
    // 生命周期
    onMounted(async () => {
      await inventoryStore.loadProducts()
      await inventoryStore.loadRecentTransactions()
      await inventoryStore.loadProjects()
      
      // 初始检查相机状态
      checkCameraStatus()
      // 每5秒检查一次相机状态
      statusCheckInterval = setInterval(checkCameraStatus, 5000)
    })
    
    onUnmounted(() => {
      if (statusCheckInterval) clearInterval(statusCheckInterval)
      if (cooldownInterval) clearInterval(cooldownInterval)
    })
    
    return {
      // Store
      documentStore,
      // State
      showDocumentEditor,
      isScanning,
      cameraRestarting,
      cameraCooldown,
      cameraStatus,
      showCameraPreview,
      cameraConnected,
      isCapturing,
      videoStreamUrl,
      // Computed
      recentTransactions,
      cameraStatusClass,
      cameraStatusText,
      // Methods
      formatDateTime,
      formatPrice,
      formatQuantity,
      showToast,
      quickOcrScan,
      openManualDocument,
      restartCamera,
      closeDocumentEditor,
      handleDocumentSubmitted,
      submitCurrentDocument,
      openCameraPreview,
      closeCameraPreview,
      captureAndRecognize,
      handleVideoError
    }
  }
}
</script>

<style scoped>
.scanner-page {
  padding: 0;
}

.card {
  overflow: visible;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
}

.card-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a202c;
}

.card-subtitle {
  font-size: 14px;
  color: #718096;
  margin-top: 4px;
}

.card-body {
  padding: 16px;
}

.mt-4 {
  margin-top: 24px;
}

/* 当前单据提示条 */
.current-document-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: linear-gradient(135deg, #ebf8ff 0%, #e6fffa 100%);
  border-radius: 12px;
  margin-bottom: 20px;
  border: 1px solid #90cdf4;
}

.document-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.document-badge {
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
}

.document-badge.IN {
  background: #c6f6d5;
  color: #276749;
}

.document-badge.OUT {
  background: #fed7d7;
  color: #c53030;
}

.document-number {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

.document-items {
  font-size: 14px;
  color: #718096;
}

.document-actions {
  display: flex;
  gap: 12px;
}

/* 单据操作按钮 */
.document-buttons-main {
  display: flex;
  gap: 24px;
  justify-content: center;
  padding: 20px 0;
}

.doc-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 32px;
  border: 2px solid #e2e8f0;
  border-radius: 16px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 200px;
}

.doc-btn:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
}

.doc-btn.ocr-btn {
  border-color: #4299e1;
  background: linear-gradient(135deg, #ebf8ff 0%, #bee3f8 100%);
}

.doc-btn.ocr-btn:hover {
  background: linear-gradient(135deg, #bee3f8 0%, #90cdf4 100%);
}

.doc-btn.manual-btn {
  border-color: #48bb78;
  background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%);
}

.doc-btn.manual-btn:hover {
  background: linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%);
}

.doc-btn.camera-btn {
  border-color: #ed8936;
  background: linear-gradient(135deg, #fffaf0 0%, #feebc8 100%);
}

.doc-btn.camera-btn:hover {
  background: linear-gradient(135deg, #feebc8 0%, #fbd38d 100%);
}

.doc-btn .btn-icon {
  font-size: 42px;
}

.doc-btn .btn-label {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
}

.doc-btn .btn-desc {
  font-size: 14px;
  color: #718096;
}

.doc-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 相机状态指示器 */
.camera-status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #f7fafc;
  border-radius: 12px;
  border: 2px solid #e2e8f0;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-dot.status-connected {
  background: #48bb78;
  box-shadow: 0 0 8px rgba(72, 187, 120, 0.6);
}

.status-dot.status-disconnected {
  background: #e53e3e;
  box-shadow: 0 0 8px rgba(229, 62, 62, 0.6);
  animation: none;
}

.status-dot.status-busy {
  background: #ed8936;
  box-shadow: 0 0 8px rgba(237, 137, 54, 0.6);
  animation: pulse 0.5s infinite; /* 更快的闪烁表示处理中 */
}

.status-dot.status-unknown {
  background: #ed8936;
  box-shadow: 0 0 8px rgba(237, 137, 54, 0.6);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-text {
  font-size: 14px;
  font-weight: 500;
  color: #4a5568;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: #a0aec0;
}

.empty-state-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state-text {
  font-size: 16px;
  font-weight: 500;
  color: #718096;
}

.empty-state-subtext {
  font-size: 14px;
  color: #a0aec0;
  margin-top: 8px;
}

/* 交易记录表格 */
.transactions-table {
  overflow-x: auto;
  width: 100%;
}

.transaction-header {
  display: grid;
  grid-template-columns: 1fr 2fr 1.5fr 1fr 1.2fr 1.2fr 1.2fr 1.5fr 1.5fr 1.2fr 1.2fr 1.2fr;
  gap: 6px;
  padding: 12px 8px;
  background: #f7fafc;
  border-radius: 8px 8px 0 0;
  font-weight: 600;
  font-size: 14px;
  color: #4a5568;
}

.transaction-row {
  display: grid;
  grid-template-columns: 1fr 2fr 1.5fr 1fr 1.2fr 1.2fr 1.2fr 1.5fr 1.5fr 1.2fr 1.2fr 1.2fr;
  gap: 6px;
  padding: 12px 8px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
  transition: background 0.2s ease;
}

.transaction-row:hover {
  background: #f7fafc;
}

.transaction-row.IN {
  border-left: 3px solid #48bb78;
}

.transaction-row.OUT {
  border-left: 3px solid #e53e3e;
}

.header-cell, .table-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.transaction-type-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
}

.transaction-type-badge.IN {
  background: #c6f6d5;
  color: #276749;
}

.transaction-type-badge.OUT {
  background: #fed7d7;
  color: #c53030;
}

.product-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.product-name {
  font-weight: 500;
  color: #2d3748;
}

.product-code {
  font-size: 12px;
  color: #a0aec0;
}

.datetime-info {
  font-size: 12px;
  color: #718096;
}

.quantity-value {
  font-weight: 600;
  color: #2d3748;
}

.price-value {
  color: #2d3748;
}

.price-value.total {
  font-weight: 600;
  color: #3182ce;
}

.requester-name, .project-name, .purpose-text {
  color: #4a5568;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stock-value {
  font-weight: 500;
}

.stock-value.low-stock {
  color: #e53e3e;
}

/* 按钮样式 */
.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-lg {
  padding: 14px 28px;
  font-size: 16px;
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

.btn-outline {
  background: transparent;
  border: 1px solid #e2e8f0;
  color: #4a5568;
}

.btn-outline:hover {
  background: #f7fafc;
  border-color: #cbd5e0;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
}

/* 摄像头预览模态框 */
.camera-preview-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
}

.camera-modal-content {
  position: relative;
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.camera-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
}

.camera-modal-body {
  padding: 24px;
}

.camera-container {
  background: #1a202c;
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 4/3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.camera-video.hidden {
  display: none;
}

.camera-loading {
  text-align: center;
  color: white;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #4a5568;
  border-top-color: #4299e1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.camera-controls {
  margin-top: 20px;
  text-align: center;
}

.camera-tip {
  color: #718096;
  margin-bottom: 16px;
}

.capture-btn {
  margin-right: 12px;
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
</style>
