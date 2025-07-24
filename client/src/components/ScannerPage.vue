<template>
  <div class="scanner-page">
    <!-- 搜索界面 -->
    <div class="search-interface">
      <!-- 搜索操作区域 -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">出库入库</div>
          <div class="card-subtitle">输入产品名称、条码或类别进行搜索</div>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">搜索产品</label>
            <div class="search-box">
              <div class="search-icon">🔍</div>
              <input 
                type="text" 
                v-model="searchQuery"
                class="form-control search-input"
                placeholder="扫描条码或输入产品名称..."
                @input="performSearch"
                @keyup.enter="selectFirstResult"
                ref="searchInput"
              />
              <button 
                v-if="searchQuery.trim()" 
                class="search-clear-btn"
                @click="clearSearch"
                type="button"
              >
                ✕
              </button>
              <div class="scan-indicator">
                <span class="scan-icon">📱</span>
                <span class="scan-text">扫码枪随时可用</span>
              </div>
              <div v-if="searchResults.length > 0" class="search-results show">
                <div 
                  v-for="product in searchResults" 
                  :key="product.id"
                  class="search-result-item"
                  @click="operationMode === 'single' ? selectProduct(product) : null"
                >
                  <div class="search-result-content">
                    <div class="search-result-name">{{ product.name }}</div>
                    <div class="search-result-details">
                      {{ product.barcode }} | {{ product.category_name || '未分类' }}
                    </div>
                  </div>
                  <div class="search-result-stock" :class="{ 'low': product.stock <= product.min_stock }">
                    {{ product.stock }}
                  </div>
                  <div v-if="operationMode === 'batch'" class="search-result-actions">
                    <button 
                      class="btn btn-outline btn-sm"
                      @click.stop="addToBatch(product)"
                      :disabled="isBatchProductExists(product.id)"
                    >
                      {{ isBatchProductExists(product.id) ? '已添加' : '添加到批量' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 紧凑的操作区域 -->
          <div class="compact-operations">
            <!-- 操作类型选择 -->
            <div class="operation-selector">
              <button 
                :class="['operation-btn-compact', 'stock-in-btn', { active: operationType === 'IN' }]"
                @click="setOperation('IN')"
              >
                入库
              </button>
              <button 
                :class="['operation-btn-compact', 'stock-out-btn', { active: operationType === 'OUT' }]"
                @click="setOperation('OUT')"
              >
                出库
              </button>
            </div>
            
            <!-- 操作模式选择 -->
            <div class="mode-selector">
              <button 
                :class="['mode-btn-compact', { active: operationMode === 'single' }]"
                @click="setOperationMode('single')"
              >
                单品
              </button>
              <button 
                :class="['mode-btn-compact', { active: operationMode === 'batch' }]"
                @click="setOperationMode('batch')"
              >
                批量
              </button>
            </div>
          </div>
          
          <!-- 键盘快捷键提示 -->
          <div class="keyboard-shortcuts-compact">
            <div class="shortcuts-label">快捷键：</div>
            <div class="shortcuts-list">
              <span class="shortcut-item">Ctrl+1 入库</span>
              <span class="shortcut-item">Ctrl+2 出库</span>
              <span class="shortcut-item">Ctrl+S 单个</span>
              <span class="shortcut-item">Ctrl+B 批量</span>
              <span class="shortcut-item">+/- 数量</span>
              <span class="shortcut-item">Ctrl+Enter 执行</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 产品信息显示区域 -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">{{ rightPanelTitle }}</div>
          <div class="card-subtitle">{{ rightPanelSubtitle }}</div>
        </div>
        <div class="card-body">
          <!-- 单品模式显示 -->
          <div v-if="operationMode === 'single'">
            <div v-if="selectedProduct" class="product-info">
              <!-- 产品信息表格 -->
              <div class="info-panel product-details">
                <div class="info-header">
                  <div class="left-section">
                    <div class="info-icon">📦</div>
                    <div class="info-title">产品详情</div>
                  </div>
                  <button class="btn btn-outline btn-sm" @click="showProductBarcode">
                    查看条码
                  </button>
                </div>
                <div class="info-grid">
                  <div class="info-row">
                    <div class="info-label">
                      <span class="label-text">产品名称</span>
                    </div>
                    <div class="info-value">
                      <span class="value-text">{{ selectedProduct.name }}</span>
                    </div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">
                      <span class="label-text">产品条码</span>
                    </div>
                    <div class="info-value">
                      <span class="value-text">{{ selectedProduct.barcode }}</span>
                    </div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">
                      <span class="label-text">产品类别</span>
                    </div>
                    <div class="info-value">
                      <span class="value-text">{{ selectedProduct.category_name || '未分类' }}</span>
                    </div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">
                      <span class="label-text">存储位置</span>
                    </div>
                    <div class="info-value">
                      <span class="value-text">{{ selectedProduct.location || '-' }}</span>
                    </div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">
                      <span class="label-text">当前库存</span>
                    </div>
                    <div class="info-value">
                      <span class="stock-value" :class="{ 'low': selectedProduct.stock <= selectedProduct.min_stock }">
                        {{ selectedProduct.stock }}
                      </span>
                    </div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">
                      <span class="label-text">操作数量</span>
                    </div>
                    <div class="info-value">
                      <div class="quantity-input-group-inline">
                        <button class="btn-quantity-inline" @click="decreaseQuantity">－</button>
                        <input type="number" v-model.number="quantity" class="quantity-input-inline" min="1">
                        <button class="btn-quantity-inline" @click="increaseQuantity">＋</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 出库信息区域 - 优化表格式 -->
              <div v-if="operationType === 'OUT'" class="info-panel out-info">
                <div class="info-header">
                  <div class="left-section">
                    <div class="info-icon">📋</div>
                    <div class="info-title">出库信息</div>
                  </div>
                </div>
                <div class="info-grid">
                  <div class="info-row">
                    <div class="info-label required">
                      <span class="label-text">领料人</span>
                      <span class="required-mark">*</span>
                    </div>
                    <div class="info-input">
                      <input type="text" v-model="requesterName" class="form-input" placeholder="请输入领料人姓名">
                    </div>
                  </div>
                  <div class="info-row">
                    <div class="info-label required">
                      <span class="label-text">领用单位/部门</span>
                      <span class="required-mark">*</span>
                    </div>
                    <div class="info-input">
                      <select v-model="projectId" class="form-select">
                        <option value="">请选择领用单位/部门</option>
                        <option v-for="project in projects" :key="project.id" :value="project.id">
                          {{ project.name }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div class="info-row">
                    <div class="info-label required">
                      <span class="label-text">用途说明</span>
                      <span class="required-mark">*</span>
                    </div>
                    <div class="info-input">
                      <input type="text" v-model="purpose" class="form-input" placeholder="请输入用途说明">
                    </div>
                  </div>
                  <div class="info-row readonly">
                    <div class="info-label">
                      <span class="label-text">产品单价</span>
                    </div>
                    <div class="info-value">
                      <div class="price-display">¥{{ (selectedProduct.price || 0).toFixed(2) }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 入库信息区域 - 优化表格式 -->
              <div v-if="operationType === 'IN'" class="info-panel in-info">
                <div class="info-header">
                  <div class="left-section">
                    <div class="info-icon">📦</div>
                    <div class="info-title">入库信息</div>
                  </div>
                </div>
                <div class="info-grid">
                  <div class="info-row">
                    <div class="info-label required">
                      <span class="label-text">产品单价</span>
                      <span class="required-mark">*</span>
                    </div>
                    <div class="info-input">
                      <input 
                        type="number" 
                        :value="unitPrice" 
                        @input="handleUnitPriceInput($event.target.value)"
                        class="form-input price-input" 
                        placeholder="请输入产品单价" 
                        min="0" 
                        step="0.01"
                        :disabled="priceInputMode === 'total' && totalPrice > 0"
                      />
                    </div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">
                      <span class="label-text">或总价</span>
                    </div>
                    <div class="info-input">
                      <input 
                        type="number" 
                        :value="totalPrice" 
                        @input="handleTotalPriceInput($event.target.value)"
                        class="form-input price-input" 
                        placeholder="请输入总价" 
                        min="0" 
                        step="0.01"
                        :disabled="priceInputMode === 'unit' && unitPrice > 0"
                      />
                    </div>
                  </div>
                  <!-- 实时计算显示 -->
                  <div v-if="quantity > 0 && (unitPrice > 0 || totalPrice > 0)" class="info-row readonly">
                    <div class="info-label">
                      <span class="label-text">价格计算</span>
                    </div>
                    <div class="info-value">
                      <div class="price-calculation">
                        <div class="calculation-item">
                          <span class="calculation-label">单价:</span>
                          <span class="calculation-value">¥{{ calculatedUnitPrice }}</span>
                        </div>
                        <div class="calculation-separator">×</div>
                        <div class="calculation-item">
                          <span class="calculation-label">数量:</span>
                          <span class="calculation-value">{{ quantity }}</span>
                        </div>
                        <div class="calculation-separator">=</div>
                        <div class="calculation-item total">
                          <span class="calculation-label">总价:</span>
                          <span class="calculation-value">¥{{ calculatedTotalPrice }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <button class="btn btn-primary btn-lg w-full" @click="executeTransaction" :disabled="!canExecuteTransaction">
                <span>✅</span>
                <span>确认操作</span>
              </button>
            </div>
            
            <div v-else class="empty-state">
              <div class="empty-state-icon">🔍</div>
              <div class="empty-state-text">请搜索产品</div>
              <div class="empty-state-subtext">在左侧搜索框中输入产品信息</div>
            </div>
          </div>

          <!-- 批量模式显示 -->
          <div v-else>
            <div class="batch-operations-panel">
              <div class="batch-header">
                <div class="batch-title">批量操作列表</div>
                <button class="btn btn-outline btn-sm" @click="clearBatchList" v-if="batchProducts.length > 0">
                  清空列表
                </button>
              </div>
              
              <!-- 批量操作信息区域 - 移到前面，始终显示 -->
              <div class="info-panel batch-info">
                <div class="info-header">
                  <div class="left-section">
                    <div class="info-icon">{{ operationType === 'IN' ? '📦' : '📋' }}</div>
                    <div class="info-title">{{ operationType === 'IN' ? '批量入库信息' : '批量出库信息' }}</div>
                  </div>
                </div>
                <div class="info-grid">
                  <div v-if="operationType === 'OUT'" class="info-row">
                    <div class="info-label required">
                      <span class="label-text">领料人</span>
                      <span class="required-mark">*</span>
                    </div>
                    <div class="info-input">
                      <input type="text" v-model="requesterName" class="form-input" placeholder="请输入领料人姓名">
                    </div>
                  </div>
                  <div v-if="operationType === 'OUT'" class="info-row">
                    <div class="info-label required">
                      <span class="label-text">领用单位/部门</span>
                      <span class="required-mark">*</span>
                    </div>
                    <div class="info-input">
                      <select v-model="projectId" class="form-select">
                        <option value="">请选择领用单位/部门</option>
                        <option v-for="project in projects" :key="project.id" :value="project.id">
                          {{ project.name }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div v-if="operationType === 'OUT'" class="info-row">
                    <div class="info-label required">
                      <span class="label-text">用途说明</span>
                      <span class="required-mark">*</span>
                    </div>
                    <div class="info-input">
                      <input type="text" v-model="purpose" class="form-input" placeholder="请输入用途说明">
                    </div>
                  </div>
                  <!-- 批量入库信息显示 -->
                  <div v-if="operationType === 'IN'" class="info-row">
                    <div class="info-label">
                      <span class="label-text">入库说明</span>
                    </div>
                    <div class="info-value">
                      <span class="value-text">请在下方为每个产品设置对应的单价</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="batch-product-list">
                <div v-if="batchProducts.length === 0" class="batch-empty-state">
                  <div class="batch-empty-state-icon">🛒</div>
                  <div>暂无产品</div>
                  <div style="font-size: 12px; margin-top: 4px;">搜索并选择产品添加到批量列表</div>
                </div>
                
                <div v-else>
                  <div class="batch-summary">
                    <div class="batch-summary-item">
                      <span>产品种类:</span>
                      <span>{{ batchProducts.length }}</span>
                    </div>
                    <div class="batch-summary-item">
                      <span>总操作数量:</span>
                      <span>{{ totalBatchQuantity }}</span>
                    </div>
                  </div>
                  
                  <div 
                    v-for="product in batchProducts" 
                    :key="product.id"
                    class="batch-product-item"
                  >
                    <!-- 完整的产品信息面板 -->
                    <div class="info-panel product-details batch-product-panel">
                      <div class="info-header">
                        <div class="left-section">
                          <div class="info-icon">📦</div>
                          <div class="info-title">{{ product.name }}</div>
                        </div>
                        <button class="batch-remove-btn" @click="removeFromBatch(product.id)">移除</button>
                      </div>
                      <div class="info-grid">
                        <div class="info-row">
                          <div class="info-label">
                            <span class="label-text">产品条码</span>
                          </div>
                          <div class="info-value">
                            <span class="value-text">{{ product.barcode }}</span>
                          </div>
                        </div>
                        <div class="info-row">
                          <div class="info-label">
                            <span class="label-text">产品类别</span>
                          </div>
                          <div class="info-value">
                            <span class="value-text">{{ product.category_name || '未分类' }}</span>
                          </div>
                        </div>
                        <div class="info-row">
                          <div class="info-label">
                            <span class="label-text">存储位置</span>
                          </div>
                          <div class="info-value">
                            <span class="value-text">{{ product.location || '-' }}</span>
                          </div>
                        </div>
                        <div class="info-row">
                          <div class="info-label">
                            <span class="label-text">当前库存</span>
                          </div>
                          <div class="info-value">
                            <span class="stock-value" :class="{ 'low': product.stock <= product.min_stock }">
                              {{ product.stock }}
                            </span>
                          </div>
                        </div>
                        <div class="info-row">
                          <div class="info-label">
                            <span class="label-text">操作数量</span>
                          </div>
                          <div class="info-value">
                            <div class="quantity-input-group-inline">
                              <button class="btn-quantity-inline" @click="updateBatchQuantity(product.id, Math.max(1, product.batchQuantity - 1))">－</button>
                              <input 
                                type="number" 
                                class="quantity-input-inline" 
                                :value="product.batchQuantity" 
                                min="1" 
                                @change="updateBatchQuantity(product.id, $event.target.value)"
                              />
                              <button class="btn-quantity-inline" @click="updateBatchQuantity(product.id, product.batchQuantity + 1)">＋</button>
                            </div>
                          </div>
                        </div>
                        <div v-if="operationType === 'IN'" class="info-row">
                          <div class="info-label">
                            <span class="label-text">价格输入方式</span>
                          </div>
                          <div class="info-input">
                            <div class="price-mode-selector">
                              <label class="price-mode-option">
                                <input 
                                  type="radio" 
                                  :checked="product.batchPriceMode === 'unit'"
                                  @change="product.batchPriceMode = 'unit'; product.batchTotalPrice = 0"
                                />
                                <span>按单价</span>
                              </label>
                              <label class="price-mode-option">
                                <input 
                                  type="radio" 
                                  :checked="product.batchPriceMode === 'total'"
                                  @change="product.batchPriceMode = 'total'; product.batchPrice = 0"
                                />
                                <span>按总价</span>
                              </label>
                            </div>
                          </div>
                        </div>
                        <div v-if="operationType === 'IN'" class="info-row">
                          <div class="info-label required">
                            <span class="label-text">产品单价</span>
                            <span class="required-mark">*</span>
                          </div>
                          <div class="info-input">
                            <input 
                              type="number" 
                              class="form-input price-input" 
                              :value="product.batchPrice || 0" 
                              min="0" 
                              step="0.01"
                              placeholder="请输入产品单价"
                              :disabled="product.batchPriceMode === 'total'"
                              @input="updateBatchUnitPrice(product.id, $event.target.value)"
                            />
                          </div>
                        </div>
                        <div v-if="operationType === 'IN'" class="info-row">
                          <div class="info-label">
                            <span class="label-text">商品总价</span>
                          </div>
                          <div class="info-input">
                            <input 
                              type="number" 
                              class="form-input price-input" 
                              :value="product.batchTotalPrice || 0" 
                              min="0" 
                              step="0.01"
                              placeholder="请输入总价"
                              :disabled="product.batchPriceMode === 'unit'"
                              @input="updateBatchTotalPrice(product.id, $event.target.value)"
                            />
                          </div>
                        </div>
                        <!-- 实时计算显示 -->
                        <div v-if="operationType === 'IN' && product.batchQuantity > 0 && (product.batchPrice > 0 || product.batchTotalPrice > 0)" class="info-row readonly">
                          <div class="info-label">
                            <span class="label-text">价格计算</span>
                          </div>
                          <div class="info-value">
                            <div class="price-calculation">
                              <div class="calculation-item">
                                <span class="calculation-label">单价:</span>
                                <span class="calculation-value">¥{{ getBatchCalculatedUnitPrice(product) }}</span>
                              </div>
                              <div class="calculation-separator">×</div>
                              <div class="calculation-item">
                                <span class="calculation-label">数量:</span>
                                <span class="calculation-value">{{ product.batchQuantity }}</span>
                              </div>
                              <div class="calculation-separator">=</div>
                              <div class="calculation-item total">
                                <span class="calculation-label">总价:</span>
                                <span class="calculation-value">¥{{ getBatchCalculatedTotalPrice(product) }}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div v-if="operationType === 'OUT'" class="info-row readonly">
                          <div class="info-label">
                            <span class="label-text">产品单价</span>
                          </div>
                          <div class="info-value">
                            <div class="price-display">¥{{ (product.price || 0).toFixed(2) }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div class="batch-actions">
                    <button 
                      class="btn btn-primary btn-lg w-full" 
                      @click="executeBatchOperation" 
                      :disabled="!canExecuteBatchTransaction"
                    >
                      <span>✅</span>
                      <span>执行批量{{ operationType === 'IN' ? '入库' : '出库' }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
          <div class="empty-state-subtext">搜索并选择产品添加到批量列表</div>
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
              <span class="quantity-value">{{ transaction.quantity }}</span>
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
                {{ transaction.stock_after || 0 }}
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
    
    <!-- Barcode Display Modal -->
    <BarcodeDisplay 
      :show="showBarcodeModal"
      :product="selectedProduct"
      @close="closeBarcodeModal"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useInventoryStore } from '@/stores/inventory'
import SignaturePad from 'signature_pad'
import BarcodeDisplay from './BarcodeDisplay.vue'

export default {
  name: 'ScannerPage',
  components: {
    BarcodeDisplay
  },
  setup() {
    const inventoryStore = useInventoryStore()
    
    // Reactive data
    const searchQuery = ref('')
    const searchResults = ref([])
    const selectedProduct = ref(null)
    const operationType = ref('IN')
    const operationMode = ref('single')
    const quantity = ref(1)
    const unitPrice = ref(0) // 单价字段
    const totalPrice = ref(0) // 总价字段
    const priceInputMode = ref('unit') // 'unit' or 'total' - 价格输入模式
    const requesterName = ref('')
    const projectId = ref('')
    const purpose = ref('')
    const batchProducts = ref([]) // Array to store batch operation products
    
    // Global scanning functionality
    const scanBuffer = ref('')
    const scanTimeout = ref(null)
    const lastScanTime = ref(0)
    
    // Signature functionality
    const signatureCanvas = ref(null)
    const signaturePad = ref(null)
    const hasSignature = ref(false)
    const showBarcodeModal = ref(false)
    
    // Computed properties
    const stats = computed(() => inventoryStore.stats)
    const projects = computed(() => inventoryStore.projects)
    const recentTransactions = computed(() => inventoryStore.transactions.slice(0, 20))
    
    const rightPanelTitle = computed(() => {
      if (operationMode.value === 'single') {
        return selectedProduct.value ? '产品信息' : '产品信息'
      } else {
        return '批量操作'
      }
    })
    
    const rightPanelSubtitle = computed(() => {
      if (operationMode.value === 'single') {
        return selectedProduct.value ? '选择的产品详细信息' : '选择的产品详细信息'
      } else {
        return '批量出入库操作'
      }
    })
    
    // 计算的单价和总价
    const calculatedUnitPrice = computed(() => {
      if (priceInputMode.value === 'total' && quantity.value > 0 && totalPrice.value > 0) {
        return (totalPrice.value / quantity.value).toFixed(2)
      }
      return unitPrice.value
    })
    
    const calculatedTotalPrice = computed(() => {
      if (priceInputMode.value === 'unit' && quantity.value > 0 && unitPrice.value > 0) {
        return (unitPrice.value * quantity.value).toFixed(2)
      }
      return totalPrice.value
    })
    
    const canExecuteTransaction = computed(() => {
      if (!selectedProduct.value || quantity.value <= 0) return false
      
      if (operationType.value === 'OUT') {
        // 出库必填：领料人、领用单位/部门、用途说明
        if (!requesterName.value || !projectId.value || !purpose.value) return false
      } else if (operationType.value === 'IN') {
        // 入库必填：单价或总价至少有一个有效值
        const hasValidUnitPrice = unitPrice.value > 0
        const hasValidTotalPrice = totalPrice.value > 0
        if (!hasValidUnitPrice && !hasValidTotalPrice) return false
      }
      
      return true
    })
    
    const totalBatchQuantity = computed(() => {
      return batchProducts.value.reduce((sum, p) => sum + p.batchQuantity, 0)
    })
    
    const canExecuteBatchTransaction = computed(() => {
      if (batchProducts.value.length === 0) return false
      
      if (operationType.value === 'OUT') {
        // 批量出库必填：领料人、领用单位/部门、用途说明
        if (!requesterName.value || !projectId.value || !purpose.value) return false
      } else if (operationType.value === 'IN') {
        // 批量入库必填：每个产品都要有有效的单价或总价
        const hasInvalidPrice = batchProducts.value.some(product => {
          const hasValidUnitPrice = product.batchPrice && product.batchPrice > 0
          const hasValidTotalPrice = product.batchTotalPrice && product.batchTotalPrice > 0
          return !hasValidUnitPrice && !hasValidTotalPrice
        })
        if (hasInvalidPrice) return false
      }
      
      return true
    })
    
    // Methods
    const performSearch = async () => {
      if (searchQuery.value.trim().length < 1) {
        searchResults.value = []
        return
      }
      
      try {
        const results = await inventoryStore.searchProducts(searchQuery.value)
        searchResults.value = results.slice(0, 10) // Limit to 10 results
      } catch (error) {
        console.error('Search failed:', error)
        searchResults.value = []
      }
    }
    
    const clearSearch = () => {
      searchQuery.value = ''
      searchResults.value = []
      selectedProduct.value = null
    }
    
    const selectProduct = (product) => {
      selectedProduct.value = product
      searchQuery.value = product.name
      searchResults.value = []
    }
    
    const selectFirstResult = () => {
      if (searchResults.value.length > 0) {
        selectProduct(searchResults.value[0])
      }
    }
    
    // Global scanning functions
    const handleGlobalKeyPress = (event) => {
      const currentTime = Date.now()
      
      // If it's Enter key, process the scan result
      if (event.key === 'Enter') {
        if (scanBuffer.value.trim()) {
          handleBarcodeScanned(scanBuffer.value.trim())
          scanBuffer.value = ''
        }
        return
      }
      
      // If it's a printable character, add to scan buffer
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        // If more than 100ms since last input, clear buffer (new scan starting)
        if (currentTime - lastScanTime.value > 100) {
          scanBuffer.value = ''
        }
        
        scanBuffer.value += event.key
        lastScanTime.value = currentTime
        
        // Set timeout to clear buffer
        if (scanTimeout.value) {
          clearTimeout(scanTimeout.value)
        }
        scanTimeout.value = setTimeout(() => {
          scanBuffer.value = ''
        }, 1000)
      }
    }
    
    const handleBarcodeScanned = async (barcode) => {
      console.log('扫描到条码:', barcode)
      
      // Clear search box and set new barcode
      searchQuery.value = barcode
      
      // Perform search
      await performSearch()
      
      // If product found, auto-select first one
      if (searchResults.value.length > 0) {
        const firstProduct = searchResults.value[0]
        selectedProduct.value = firstProduct
        
        // Handle based on current mode
        if (operationMode.value === 'single') {
          // Single mode: directly show product info
          showToast(`已选择产品: ${firstProduct.name}`, 'success')
        } else {
          // Batch mode: add to batch list
          addToBatch(firstProduct)
        }
      } else {
        // No product found, show warning
        showToast(`未找到条码为 ${barcode} 的产品`, 'warning')
      }
    }
    
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
        background: ${type === 'success' ? '#48bb78' : type === 'warning' ? '#ed8936' : '#4299e1'};
        animation: slideIn 0.3s ease;
      `
      
      document.body.appendChild(toast)
      setTimeout(() => toast.remove(), 3000)
    }
    
    const setOperation = (type) => {
      operationType.value = type
      // Reset form fields when switching operation type
      if (type === 'IN') {
        requesterName.value = ''
        projectId.value = ''
        purpose.value = ''
      }
    }
    
    // 价格处理方法
    const handleUnitPriceInput = (value) => {
      if (value > 0) {
        priceInputMode.value = 'unit'
        unitPrice.value = parseFloat(value) || 0
        totalPrice.value = 0 // 清空总价输入
      }
    }
    
    const handleTotalPriceInput = (value) => {
      if (value > 0) {
        priceInputMode.value = 'total'
        totalPrice.value = parseFloat(value) || 0
        unitPrice.value = 0 // 清空单价输入
      }
    }
    
    const clearPriceInputs = () => {
      unitPrice.value = 0
      totalPrice.value = 0
      priceInputMode.value = 'unit'
    }
    
    // Signature functions
    const initSignaturePad = () => {
      if (signatureCanvas.value) {
        signaturePad.value = new SignaturePad(signatureCanvas.value, {
          backgroundColor: '#f8f9fa',
          penColor: '#000000',
          minWidth: 1,
          maxWidth: 3
        })
        
        signaturePad.value.addEventListener('endStroke', () => {
          hasSignature.value = !signaturePad.value.isEmpty()
        })
      }
    }
    
    const clearSignature = () => {
      if (signaturePad.value) {
        signaturePad.value.clear()
        hasSignature.value = false
      }
    }
    
    const getSignatureData = () => {
      if (signaturePad.value && !signaturePad.value.isEmpty()) {
        return signaturePad.value.toDataURL()
      }
      return null
    }
    
    const showProductBarcode = () => {
      if (selectedProduct.value) {
        showBarcodeModal.value = true
      }
    }
    
    const closeBarcodeModal = () => {
      showBarcodeModal.value = false
    }
    
    const setOperationMode = (mode) => {
      operationMode.value = mode
      // Reset selected product when switching mode
      selectedProduct.value = null
      searchQuery.value = ''
      searchResults.value = []
    }
    
    const increaseQuantity = () => {
      quantity.value += 1
    }
    
    const decreaseQuantity = () => {
      if (quantity.value > 1) {
        quantity.value -= 1
      }
    }
    
    const executeTransaction = async () => {
      if (!canExecuteTransaction.value) {
        console.log('Transaction validation failed', {
          selectedProduct: selectedProduct.value,
          quantity: quantity.value,
          operationType: operationType.value,
          requesterName: requesterName.value,
          projectId: projectId.value,
          purpose: purpose.value,
          unitPrice: unitPrice.value
        })
        return
      }
      
      const transactionData = {
        product_id: selectedProduct.value.id,
        type: operationType.value,
        quantity: quantity.value,
        unit_price: operationType.value === 'IN' ? parseFloat(calculatedUnitPrice.value) : (selectedProduct.value.price || 0),
        requester_name: requesterName.value || null,
        project_id: projectId.value || null,
        purpose: purpose.value || null
      }
      
      console.log('Executing transaction with data:', transactionData)
      
      try {
        const result = await inventoryStore.createTransaction(transactionData)
        console.log('Transaction created successfully:', result)
        showMessage('操作成功！', 'success')
        
        // Reset form
        quantity.value = 1
        requesterName.value = ''
        projectId.value = ''
        purpose.value = ''
        clearPriceInputs() // 使用新的清空价格方法
        
        // Force refresh selected product data after transaction
        console.log('Refreshing product data...')
        await inventoryStore.loadProducts()
        const updatedProduct = inventoryStore.getProductById(selectedProduct.value.id)
        if (updatedProduct) {
          console.log('Updated product:', updatedProduct)
          selectedProduct.value = { ...updatedProduct }
        } else {
          console.warn('Could not find updated product:', selectedProduct.value.id)
        }
        
        // Also refresh recent transactions
        await inventoryStore.loadRecentTransactions()
        
      } catch (error) {
        console.error('Transaction failed:', error)
        console.error('Error details:', error.response || error)
        showMessage('操作失败: ' + (error.response?.data?.error || error.message), 'error')
      }
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
      if (!price || price === 0) return '0.00'
      return parseFloat(price).toFixed(2)
    }
    
    const getCostMethodText = (transaction) => {
      // 根据交易时间和类型判断成本计算方法
      // 这里可以根据实际业务逻辑调整
      if (transaction.type === 'OUT') {
        return '加权平均'
      }
      return ''
    }
    
    const showMessage = (message, type = 'info') => {
      // Simple message implementation
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
      
      setTimeout(() => {
        messageEl.remove()
      }, 3000)
    }
    
    // Batch operation methods
    const addToBatch = (product) => {
      if (!product) return
      
      // Check if product already exists in batch
      const existingIndex = batchProducts.value.findIndex(p => p.id === product.id)
      if (existingIndex !== -1) {
        showMessage('该产品已在批量列表中', 'warning')
        return
      }
      
      // Add product to batch with default quantity of 1
      batchProducts.value.push({
        ...product,
        batchQuantity: 1,
        batchPrice: 0,  // 单价 - 初始为0，让用户选择输入方式
        batchTotalPrice: 0,  // 总价
        batchPriceMode: 'unit'  // 价格输入模式：'unit' 或 'total'，默认单价模式
      })
      
      showMessage(`已添加 ${product.name} 到批量列表`, 'success')
    }
    
    const removeFromBatch = (productId) => {
      batchProducts.value = batchProducts.value.filter(p => p.id !== productId)
      showMessage('已从批量列表移除', 'success')
    }
    
    const updateBatchQuantity = (productId, quantity) => {
      const product = batchProducts.value.find(p => p.id === productId)
      if (product) {
        // 确保quantity是正整数
        const parsedQuantity = parseInt(quantity)
        if (isNaN(parsedQuantity) || parsedQuantity < 1) {
          product.batchQuantity = 1
        } else {
          product.batchQuantity = parsedQuantity
        }
        
        // 添加调试日志
        console.log(`更新产品 ${productId} 的批量数量为: ${product.batchQuantity}`)
      }
    }
    
    const updateBatchPrice = (productId, price) => {
      const product = batchProducts.value.find(p => p.id === productId)
      if (product) {
        // 确保price是正数
        const parsedPrice = parseFloat(price)
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          product.batchPrice = 0
        } else {
          product.batchPrice = parsedPrice
        }
        
        // 添加调试日志
        console.log(`更新产品 ${productId} 的批量价格为: ${product.batchPrice}`)
      }
    }
    
    // 新的批量单价更新方法
    const updateBatchUnitPrice = (productId, price) => {
      const product = batchProducts.value.find(p => p.id === productId)
      if (product && price > 0) {
        product.batchPriceMode = 'unit'
        product.batchPrice = parseFloat(price) || 0
        product.batchTotalPrice = 0 // 清空总价输入
      }
    }
    
    // 新的批量总价更新方法
    const updateBatchTotalPrice = (productId, totalPrice) => {
      const product = batchProducts.value.find(p => p.id === productId)
      if (product && totalPrice > 0) {
        product.batchPriceMode = 'total'
        product.batchTotalPrice = parseFloat(totalPrice) || 0
        product.batchPrice = 0 // 清空单价输入
      }
    }
    
    // 计算批量产品的实际单价
    const getBatchCalculatedUnitPrice = (product) => {
      if (product.batchPriceMode === 'total' && product.batchQuantity > 0 && product.batchTotalPrice > 0) {
        return (product.batchTotalPrice / product.batchQuantity).toFixed(2)
      }
      return (product.batchPrice || 0).toFixed(2)
    }
    
    // 计算批量产品的实际总价
    const getBatchCalculatedTotalPrice = (product) => {
      if (product.batchPriceMode === 'unit' && product.batchQuantity > 0 && product.batchPrice > 0) {
        return (product.batchPrice * product.batchQuantity).toFixed(2)
      }
      return (product.batchTotalPrice || 0).toFixed(2)
    }
    
    const clearBatchList = () => {
      if (batchProducts.value.length === 0) {
        showMessage('批量列表已经为空', 'info')
        return
      }
      
      if (confirm('确定要清空批量列表吗？')) {
        batchProducts.value = []
        showMessage('批量列表已清空', 'success')
      }
    }
    
    const isBatchProductExists = (productId) => {
      return batchProducts.value.some(p => p.id === productId)
    }
    
    const executeBatchOperation = async () => {
      if (!canExecuteBatchTransaction.value) return
      
      const operationText = operationType.value === 'IN' ? '入库' : '出库'
      const totalItems = batchProducts.value.length
      const totalQuantity = totalBatchQuantity.value
      
      if (!confirm(`确定要执行批量${operationText}操作吗？\n\n产品种类: ${totalItems}\n总操作数量: ${totalQuantity}`)) {
        return
      }
      
      try {
        showMessage(`正在执行批量${operationText}操作...`, 'info')
        
        // 数据验证
        const validatedProducts = batchProducts.value.map(product => {
          const quantity = parseInt(product.batchQuantity)
          if (isNaN(quantity) || quantity < 1) {
            throw new Error(`产品 ${product.name} 的数量无效: ${product.batchQuantity}`)
          }
          if (!product.id || product.id < 1) {
            throw new Error(`产品 ${product.name} 的ID无效: ${product.id}`)
          }
          return {
            ...product,
            batchQuantity: quantity
          }
        })
        
        // Prepare bulk transaction data
        const bulkTransactionData = {
          transactions: validatedProducts.map(product => {
            const transactionData = {
              product_id: parseInt(product.id),
              type: operationType.value,
              quantity: parseInt(product.batchQuantity),
              requester_name: requesterName.value || null,
              project_id: projectId.value || null,
              purpose: purpose.value || null
            }
            
            // 如果是入库操作，添加单价信息
            if (operationType.value === 'IN') {
              // 使用计算出的实际单价
              const calculatedUnitPrice = parseFloat(getBatchCalculatedUnitPrice(product))
              transactionData.unit_price = calculatedUnitPrice
            }
            
            return transactionData
          }),
          global: {
            requester_name: requesterName.value || null,
            project_id: projectId.value || null,
            purpose: purpose.value || null
          }
        }
        
        // 添加调试日志
        console.log('准备发送批量交易数据:', JSON.stringify(bulkTransactionData, null, 2))
        
        // Execute bulk transactions
        const result = await inventoryStore.createBulkTransactions(bulkTransactionData)
        
        // Process results
        if (result.failed === 0) {
          showMessage(`批量${operationText}操作成功！处理了 ${result.successful} 个产品`, 'success')
          batchProducts.value = []
          // 清空搜索框
          clearSearch()
          // Reset form
          if (operationType.value === 'OUT') {
            requesterName.value = ''
            projectId.value = ''
            purpose.value = ''
          }
        } else {
          showMessage(`批量操作部分成功：成功 ${result.successful} 个，失败 ${result.failed} 个`, 'warning')
        }
        
      } catch (error) {
        console.error('批量操作失败:', error)
        
        // 详细错误处理
        if (error.response && error.response.status === 400) {
          const errorData = error.response.data
          if (errorData.errors && errorData.errors.length > 0) {
            const errorMessages = errorData.errors.map(err => 
              `${err.path}: ${err.msg} (值: ${err.value})`
            ).join('\n')
            showMessage(`批量操作失败 - 数据验证错误:\n${errorMessages}`, 'error')
          } else {
            showMessage(`批量操作失败 - 400错误: ${JSON.stringify(errorData)}`, 'error')
          }
        } else {
          showMessage(`批量操作失败: ${error.message}`, 'error')
        }
      }
    }
    
    // Keyboard shortcuts
    const handleKeyDown = (event) => {
      // Ctrl/Cmd + Enter: Execute transaction
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        if (operationMode.value === 'single' && canExecuteTransaction.value) {
          executeTransaction()
        } else if (operationMode.value === 'batch' && canExecuteBatchTransaction.value) {
          executeBatchOperation()
        }
      }
      
      // Ctrl/Cmd + 1: Switch to IN operation
      if ((event.ctrlKey || event.metaKey) && event.key === '1') {
        event.preventDefault()
        setOperation('IN')
      }
      
      // Ctrl/Cmd + 2: Switch to OUT operation
      if ((event.ctrlKey || event.metaKey) && event.key === '2') {
        event.preventDefault()
        setOperation('OUT')
      }
      
      // Ctrl/Cmd + S: Switch to single mode
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        setOperationMode('single')
      }
      
      // Ctrl/Cmd + B: Switch to batch mode
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault()
        setOperationMode('batch')
      }
      
      // Plus/Equals: Increase quantity
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        increaseQuantity()
      }
      
      // Minus: Decrease quantity
      if (event.key === '-') {
        event.preventDefault()
        decreaseQuantity()
      }
      
      // Enter: Select first search result
      if (event.key === 'Enter' && searchResults.value.length > 0 && !selectedProduct.value) {
        event.preventDefault()
        selectFirstResult()
      }
    }
    
    onMounted(() => {
      // Focus on search input
      setTimeout(() => {
        const searchInput = document.querySelector('.search-input')
        if (searchInput) {
          searchInput.focus()
        }
        
        // Initialize signature pads after DOM is ready
        initSignaturePad()
        initBatchSignaturePad()
      }, 500)
      
      // Add keyboard event listeners
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('keydown', handleGlobalKeyPress)
      
      // Load initial data
      inventoryStore.loadInitialData()
    })
    
    onUnmounted(() => {
      // Remove keyboard event listeners
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keydown', handleGlobalKeyPress)
      
      // Clear scan timeout
      if (scanTimeout.value) {
        clearTimeout(scanTimeout.value)
      }
    })
    
    return {
      searchQuery,
      searchResults,
      selectedProduct,
      operationType,
      operationMode,
      quantity,
      unitPrice,
      totalPrice,
      priceInputMode,
      calculatedUnitPrice,
      calculatedTotalPrice,
      requesterName,
      projectId,
      purpose,
      batchProducts,
      stats,
      projects,
      recentTransactions,
      rightPanelTitle,
      rightPanelSubtitle,
      canExecuteTransaction,
      totalBatchQuantity,
      canExecuteBatchTransaction,
      signatureCanvas,
      hasSignature,
      showBarcodeModal,
      performSearch,
      selectProduct,
      selectFirstResult,
      handleBarcodeScanned,
      showToast,
      setOperation,
      handleUnitPriceInput,
      handleTotalPriceInput,
      clearPriceInputs,
      setOperationMode,
      increaseQuantity,
      decreaseQuantity,
      executeTransaction,
      formatDate,
      formatDateTime,
      formatPrice,
      getCostMethodText,
      addToBatch,
      removeFromBatch,
      updateBatchQuantity,
      updateBatchPrice,
      clearBatchList,
      isBatchProductExists,
      executeBatchOperation,
      clearSignature,
      showProductBarcode,
      closeBarcodeModal,
      clearSearch,
      updateBatchUnitPrice,
      updateBatchTotalPrice,
      getBatchCalculatedUnitPrice,
      getBatchCalculatedTotalPrice
    }
  }
}
</script>

<style scoped>
.scanner-page {
  padding: 0;
}

.search-interface {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-xl);
}

/* 紧凑的操作区域 */
.compact-operations {
  display: flex;
  gap: 16px;
  align-items: center;
  margin: 16px 0 12px 0;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.operation-selector {
  display: flex;
  gap: 8px;
}

.operation-btn-compact {
  padding: 8px 16px;
  border: 2px solid transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
  color: #4a5568;
  border-color: #e2e8f0;
}

.operation-btn-compact.stock-in-btn.active {
  background: #38a169;
  color: white;
  border-color: #38a169;
}

.operation-btn-compact.stock-out-btn.active {
  background: #e53e3e;
  color: white;
  border-color: #e53e3e;
}

.operation-btn-compact:hover {
  border-color: #cbd5e0;
  background: #edf2f7;
}

.mode-selector {
  display: flex;
  gap: 6px;
  border-left: 1px solid #e2e8f0;
  padding-left: 16px;
}

.mode-btn-compact {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: white;
  color: #4a5568;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-btn-compact.active {
  background: #4299e1;
  color: white;
  border-color: #4299e1;
}

.mode-btn-compact:hover:not(.active) {
  border-color: #4299e1;
  background: #ebf8ff;
}

/* 价格模式选择器样式 */
.price-mode-selector {
  display: flex;
  gap: 16px;
}

.price-mode-option {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #4a5568;
  transition: color 0.2s ease;
}

.price-mode-option:hover {
  color: #2d3748;
}

.price-mode-option input[type="radio"] {
  accent-color: #4299e1;
  scale: 1.1;
}

/* 搜索清除按钮样式 */
.search-clear-btn {
  position: absolute;
  right: 130px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  color: #a0aec0;
  font-size: 14px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  z-index: 10;
}

.search-clear-btn:hover {
  background: #edf2f7;
  color: #4a5568;
}

.search-clear-btn:active {
  background: #e2e8f0;
}

/* 紧凑的快捷键提示 */
.keyboard-shortcuts-compact {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f7fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  margin-top: 12px;
}

.keyboard-shortcuts-compact .shortcuts-label {
  font-size: 12px;
  font-weight: 600;
  color: #4a5568;
  white-space: nowrap;
}

.keyboard-shortcuts-compact .shortcuts-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.keyboard-shortcuts-compact .shortcut-item {
  padding: 2px 6px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
  font-size: 11px;
  color: #718096;
  font-family: monospace;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .search-interface {
    grid-template-columns: 1fr;
  }
}

.search-box {
  position: relative;
}

.search-icon {
  position: absolute;
  left: var(--spacing-md);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.search-input {
  padding-left: 3rem;
  padding-right: 150px;
}

.scan-indicator {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  color: #68d391;
  font-size: 12px;
  font-weight: 500;
}

.scan-icon {
  animation: scanning 2s infinite;
}

@keyframes scanning {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.scan-text {
  color: #4a5568;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-top: none;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  box-shadow: var(--shadow-lg);
  max-height: 500px;
  overflow-y: auto;
  z-index: 1000;
}

.search-result-item {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.search-result-item:hover {
  background: var(--background-color);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-name {
  font-weight: 600;
  color: var(--text-primary);
}

.search-result-details {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: var(--spacing-xs);
}

.search-result-stock {
  font-family: var(--font-family-mono);
  font-weight: 600;
  float: right;
  color: var(--success-color);
}

.search-result-stock.low {
  color: var(--error-color);
}

/* Signature styles */
.signature-container {
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 8px;
  background: #f8f9fa;
}

.signature-canvas {
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: white;
  cursor: crosshair;
  display: block;
  width: 100%;
  max-width: 300px;
  height: 150px;
}

.signature-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.signature-status {
  font-size: 12px;
  font-weight: 500;
  color: #dc3545;
}

.signature-status.has-signature {
  color: #28a745;
}

/* 单价显示样式 */
.price-display {
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  text-align: center;
}

.inbound-info-section {
  background: #f0f8ff;
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  border: 1px solid #e6f3ff;
  margin-top: var(--spacing-lg);
}

.inbound-info-section h4 {
  color: #2b6cb0;
  margin-bottom: var(--spacing-md);
  font-size: 1rem;
  font-weight: 600;
}

/* 数量控制样式 */
.quantity-control {
  margin: var(--spacing-lg) 0;
}

.quantity-input-group {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: var(--spacing-sm);
}

.btn-quantity-decrease,
.btn-quantity-increase {
  width: 48px;
  height: 48px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  background: white;
  color: #4a5568;
  font-size: 24px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-quantity-decrease:hover {
  background: #f56565;
  color: white;
  border-color: #f56565;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(245, 101, 101, 0.3);
}

.btn-quantity-increase:hover {
  background: #48bb78;
  color: white;
  border-color: #48bb78;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(72, 187, 120, 0.3);
}

.btn-quantity-decrease:active,
.btn-quantity-increase:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.quantity-display {
  width: 80px;
  height: 48px;
  text-align: center;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 20px;
  font-weight: 600;
  color: #2d3748;
  background: white;
  transition: all 0.2s ease;
}

.quantity-display:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

/* 批量操作的数量控制 */
.batch-quantity-control {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: var(--spacing-sm);
}

.btn-quantity {
  width: 32px;
  height: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #4a5568;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.btn-quantity:hover {
  background: #4299e1;
  color: white;
  border-color: #4299e1;
  transform: translateY(-1px);
}

.batch-quantity-input {
  width: 60px;
  height: 32px;
  text-align: center;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #2d3748;
  background: white;
}

.batch-quantity-input:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.1);
}

/* 优化的信息面板样式 */
.info-panel {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.info-panel.out-info {
  border-left: 4px solid #e53e3e;
  background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 5%, #f8fafc 15%);
}

.info-panel.in-info {
  border-left: 4px solid #38a169;
  background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 5%, #f8fafc 15%);
}

.info-panel.batch-info {
  border-left: 4px solid #3182ce;
  background: linear-gradient(135deg, #ebf8ff 0%, #bee3f8 5%, #f8fafc 15%);
}

.info-panel.product-details {
  border-left: 4px solid #805ad5;
  background: linear-gradient(135deg, #faf5ff 0%, #e9d8fd 5%, #f8fafc 15%);
}

.info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
}

.info-header .left-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-icon {
  font-size: 18px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.info-title {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-row {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 12px;
  align-items: center;
  min-height: 36px;
}

.info-row.readonly {
  background: #f7fafc;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.info-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 500;
  color: #4a5568;
}

.label-text {
  line-height: 1.2;
}

.required-mark {
  color: #e53e3e;
  font-weight: 600;
  font-size: 12px;
}

.info-input {
  display: flex;
  align-items: center;
}

.info-value {
  display: flex;
  align-items: center;
}

.value-text {
  font-size: 14px;
  color: #2d3748;
  font-weight: 500;
}

.stock-value {
  font-size: 14px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  background: #f0fff4;
  color: #38a169;
  border: 1px solid #c6f6d5;
}

.stock-value.low {
  background: #fff5f5;
  color: #e53e3e;
  border-color: #fed7d7;
}

.form-input,
.form-select {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  color: #2d3748;
  background: white;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.form-input::placeholder {
  color: #a0aec0;
}

.price-input {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  text-align: right;
}

.price-display {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  background: #f0fff4;
  border: 1px solid #c6f6d5;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #38a169;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

/* 价格计算显示样式 */
.price-calculation {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

.calculation-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.calculation-item.total {
  background: #e6fffa;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #81e6d9;
}

.calculation-label {
  font-size: 11px;
  color: #718096;
  font-weight: 500;
}

.calculation-value {
  font-size: 14px;
  color: #2d3748;
  font-weight: 600;
}

.calculation-item.total .calculation-value {
  color: #319795;
  font-size: 16px;
}

.calculation-separator {
  font-size: 18px;
  color: #4a5568;
  font-weight: 600;
  margin: 0 4px;
}

/* 禁用状态的输入框样式 */
.form-input:disabled {
  background: #f7fafc;
  color: #a0aec0;
  cursor: not-allowed;
  border-color: #e2e8f0;
}

/* 内联数量控制器 */
.quantity-input-group-inline {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-quantity-inline {
  width: 32px;
  height: 32px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-quantity-inline:hover {
  background: #f7fafc;
  border-color: #cbd5e0;
}

.quantity-input-inline {
  width: 60px;
  height: 32px;
  text-align: center;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
}

/* 批量操作控件样式 */
.batch-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

/* 批量产品面板样式 */
.batch-product-panel {
  margin-bottom: 16px;
}

.batch-product-panel .info-header {
  justify-content: space-between;
}

.batch-product-panel .batch-remove-btn {
  background: #fed7d7;
  color: #e53e3e;
  border: 1px solid #fbb6ce;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.batch-product-panel .batch-remove-btn:hover {
  background: #fbb6ce;
  color: #c53030;
}

.batch-quantity-control,
.batch-price-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.control-label {
  font-size: 12px;
  color: #4a5568;
  font-weight: 500;
  min-width: 32px;
}

.batch-price-input {
  width: 80px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 12px;
  text-align: right;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

.batch-price-input:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.1);
}

.batch-quantity-input {
  width: 50px;
  height: 28px;
  text-align: center;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 12px;
}

.btn-quantity {
  width: 24px;
  height: 24px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-quantity:hover {
  background: #f7fafc;
}

.batch-remove-btn {
  background: #fed7d7;
  color: #e53e3e;
  border: 1px solid #fbb6ce;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  margin-top: 4px;
}

.batch-remove-btn:hover {
  background: #fbb6ce;
}

/* 批量模式下的产品信息间距优化 */
.batch-product-list .info-panel {
  margin-bottom: 20px;
}

.batch-product-list .info-panel:last-child {
  margin-bottom: 16px;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .info-row {
    grid-template-columns: 90px 1fr;
    gap: 8px;
    min-height: 32px;
  }
  
  .info-panel {
    padding: 12px;
    margin-bottom: 16px;
  }
  
  .info-grid {
    gap: 10px;
  }
  
  .form-input,
  .form-select {
    height: 32px;
    padding: 0 8px;
    font-size: 13px;
  }
  
  .info-label {
    font-size: 13px;
  }
  
  .info-title {
    font-size: 15px;
  }
  
  .batch-controls {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  
  .quantity-input-group-inline {
    gap: 2px;
  }
  
  .btn-quantity-inline {
    width: 28px;
    height: 28px;
    font-size: 14px;
  }
  
  .quantity-input-inline {
    width: 50px;
    height: 28px;
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .search-interface {
    grid-template-columns: 1fr;
  }
  
  .compact-operations {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .operation-selector,
  .mode-selector {
    justify-content: center;
    border-left: none;
    padding-left: 0;
  }
  
  .mode-selector {
    border-top: 1px solid #e2e8f0;
    padding-top: 12px;
  }
  
  .keyboard-shortcuts-compact {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .keyboard-shortcuts-compact .shortcuts-list {
    justify-content: flex-start;
  }
  
  .search-input {
    padding-right: 100px;
  }
  
  .scan-indicator {
    right: 10px;
  }
  
  .scan-text {
    display: none;
  }
  
  .btn-quantity-decrease,
  .btn-quantity-increase {
    width: 56px;
    height: 56px;
    font-size: 28px;
  }
  
  .quantity-display {
    width: 100px;
    height: 56px;
    font-size: 24px;
  }
  
  .quantity-input-group {
    gap: 16px;
  }
}

/* 交易记录表格样式 */
.transactions-table {
  display: flex;
  flex-direction: column;
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

/* 类型列 */
.table-cell.type {
  justify-content: center;
}

.transaction-type-badge {
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  color: white;
  text-align: center;
  min-width: 32px;
}

.transaction-type-badge.IN {
  background: #10b981;
}

.transaction-type-badge.OUT {
  background: #ef4444;
}

/* 产品信息列 */
.table-cell.product {
  flex-direction: column;
  align-items: flex-start;
  padding: 6px;
}

.product-info {
  width: 100%;
}

.product-name {
  font-weight: 500;
  color: #111827;
  font-size: 13px;
  line-height: 1.2;
  margin-bottom: 2px;
}

.product-code {
  color: #6b7280;
  font-size: 11px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

/* 时间列 */
.table-cell.datetime {
  font-size: 12px;
  color: #4b5563;
}

/* 操作人员列 */
.table-cell.operator {
  font-size: 12px;
  color: #374151;
}

/* 新增：领料人、项目、用途列样式 */
.table-cell.requester,
.table-cell.project,
.table-cell.purpose {
  font-size: 12px;
  color: #374151;
  padding: 6px 4px;
}

.requester-name {
  color: #7c3aed;
  font-weight: 500;
}

.project-name {
  color: #059669;
  font-weight: 500;
}

.purpose-text {
  color: #6b7280;
  line-height: 1.2;
  word-wrap: break-word;
}

/* 数量列 */
.table-cell.quantity {
  justify-content: center;
  font-weight: 600;
  color: #3b82f6;
}

/* 价格列 */
.table-cell.unit-price,
.table-cell.total-price,
.table-cell.stock-value {
  justify-content: flex-end;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 12px;
}

.price-value {
  font-weight: 500;
  color: #8b5cf6;
}

.price-value.total {
  color: #059669;
  font-weight: 600;
}

.price-value.stock {
  color: #f59e0b;
  font-weight: 500;
}

/* 库存单价列 */
.table-cell.stock-unit-price {
  justify-content: flex-end;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 12px;
}

.price-value.stock-unit {
  color: #7c3aed;
  font-weight: 600;
  background: #f3e8ff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

/* 库存数量列 */
.table-cell.current-stock {
  justify-content: center;
  font-weight: 600;
  color: #059669;
}

.stock-value {
  font-weight: 600;
  color: #059669;
}

.stock-value.low-stock {
  color: #ef4444;
  background: #fef2f2;
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 11px;
}

/* 详情列 */
.table-cell.details {
  flex-direction: column;
  align-items: flex-start;
  padding: 4px 6px;
  font-size: 11px;
}

.detail-info {
  width: 100%;
}

.project {
  color: #7c3aed;
  font-weight: 500;
  margin-bottom: 1px;
}

.purpose {
  color: #6b7280;
  line-height: 1.2;
}

.cost-method {
  background: #e5e7eb;
  padding: 1px 4px;
  border-radius: 8px;
  font-size: 10px;
  color: #374151;
  font-weight: 500;
}

/* 总计行样式 */
.transaction-summary {
  background: #f8fafc;
  border-top: 2px solid #e5e7eb;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
}

.summary-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.summary-label {
  font-weight: 600;
  color: #374151;
  font-size: 14px;
}

.summary-value {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-weight: 700;
  color: #059669;
  font-size: 16px;
  background: #ecfdf5;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #a7f3d0;
}

.summary-note {
  font-size: 12px;
  color: #6b7280;
  font-style: italic;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .transaction-header,
  .transaction-row {
    grid-template-columns: 50px 1fr 60px 70px 80px;
  }
  
  /* 隐藏部分列在移动端 */
  .header-cell.datetime,
  .header-cell.requester,
  .header-cell.project,
  .header-cell.purpose,
  .header-cell.stock-unit-price,
  .header-cell.stock-value,
  .table-cell.datetime,
  .table-cell.requester,
  .table-cell.project,
  .table-cell.purpose,
  .table-cell.stock-unit-price,
  .table-cell.stock-value {
    display: none;
  }
  
  .product-name {
    font-size: 12px;
  }
  
  .product-code {
    font-size: 10px;
  }
  
  .transaction-summary {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  
  .summary-note {
    font-size: 11px;
  }
}

@media (max-width: 1200px) {
  .transaction-header,
  .transaction-row {
    grid-template-columns: 50px 1fr 120px 50px 70px 80px 90px 100px 130px 70px 80px 90px;
  }
  
  .header-cell,
  .table-cell {
    padding: 6px 3px;
    font-size: 11px;
  }
}
</style>
