<template>
  <div class="settings-page">
    <!-- Header -->
    <div class="settings-header">
      <div class="settings-title">
        <h2>系统设置</h2>
        <p>配置系统参数和管理选项</p>
      </div>
      <div class="settings-actions">
        <button class="btn btn-primary" @click="saveAllSettings">
          <span>💾</span>
          保存所有设置
        </button>
        <button class="btn btn-secondary" @click="resetToDefaults">
          <span>🔄</span>
          恢复默认
        </button>
      </div>
    </div>

    <!-- Settings Navigation -->
    <div class="settings-navigation">
      <button 
        v-for="tab in settingsTabs" 
        :key="tab.id"
        class="nav-tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <span>{{ tab.icon }}</span>
        <span>{{ tab.name }}</span>
      </button>
    </div>

    <!-- Settings Content -->
    <div class="settings-content">
      <!-- General Settings -->
      <div v-if="activeTab === 'general'" class="settings-section">
        <div class="section-header">
          <h3>基础设置</h3>
          <p>系统基本配置信息</p>
        </div>
        <div class="settings-form">
          <div class="form-group">
            <label class="form-label">系统名称</label>
            <input v-model="settings.general.systemName" type="text" class="form-control">
          </div>
          <div class="form-group">
            <label class="form-label">时区</label>
            <select v-model="settings.general.timezone" class="form-control">
              <option value="auto">跟随系统时区</option>
              <option value="Asia/Shanghai">中国标准时间 (UTC+8)</option>
              <option value="UTC">世界标准时间 (UTC)</option>
              <option value="America/New_York">美国东部时间 (UTC-5)</option>
              <option value="America/Los_Angeles">美国西部时间 (UTC-8)</option>
              <option value="Europe/London">欧洲伦敦时间 (UTC+0)</option>
              <option value="Asia/Tokyo">日本标准时间 (UTC+9)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">语言</label>
            <select v-model="settings.general.language" class="form-control">
              <option value="zh-CN">中文</option>
              <option value="en-US">English</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Inventory Settings -->
      <div v-if="activeTab === 'inventory'" class="settings-section">
        <div class="section-header">
          <h3>库存设置</h3>
          <p>库存管理相关配置</p>
        </div>
        <div class="settings-form">
          <div class="form-group">
            <label class="form-label">默认最小库存</label>
            <input v-model.number="settings.inventory.defaultMinStock" type="number" class="form-control" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">低库存警告阈值</label>
            <input v-model.number="settings.inventory.lowStockThreshold" type="number" class="form-control" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">库存更新间隔 (分钟)</label>
            <input v-model.number="settings.inventory.updateInterval" type="number" class="form-control" min="1">
          </div>
        </div>
      </div>

      <!-- Categories Management -->
      <div v-if="activeTab === 'categories'" class="settings-section">
        <div class="section-header">
          <h3>类别管理</h3>
          <p>管理产品分类</p>
        </div>
        <div class="category-management">
          <div class="category-form">
            <div class="form-group">
              <label class="form-label">添加新类别</label>
              <div class="input-group">
                <input v-model="newCategory.name" type="text" class="form-control" placeholder="类别名称">
                <input v-model="newCategory.description" type="text" class="form-control" placeholder="描述">
                <button class="btn btn-primary" @click="addCategory">添加</button>
              </div>
            </div>
          </div>
          <div class="category-list">
            <div v-for="category in categories" :key="category.id" class="category-item">
              <div class="category-info">
                <div class="category-name">{{ category.name }}</div>
                <div class="category-description">{{ category.description }}</div>
                <div class="category-count">{{ getCategoryProductCount(category.id) }} 个产品</div>
              </div>
              <div class="category-actions">
                <button class="btn btn-sm btn-outline" @click="editCategory(category)">编辑</button>
                <button class="btn btn-sm btn-danger" @click="deleteCategory(category)">删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Projects/Departments Management -->
      <div v-if="activeTab === 'projects'" class="settings-section">
        <div class="section-header">
          <h3>领用单位/部门管理</h3>
          <p>管理系统中的领用单位和部门信息</p>
        </div>
        <div class="settings-form">
          <div class="form-section">
            <div class="form-group">
              <label class="form-label">添加新单位/部门</label>
              <div class="input-group">
                <input v-model="newProject.name" type="text" class="form-control" placeholder="单位/部门名称">
                <input v-model="newProject.description" type="text" class="form-control" placeholder="描述">
                <button class="btn btn-primary" @click="addProject">添加</button>
              </div>
            </div>
          </div>
          <div class="project-list">
            <div v-for="project in projects" :key="project.id" class="project-item">
              <div class="project-info">
                <div class="project-name">{{ project.name }}</div>
                <div class="project-description">{{ project.description || '无描述' }}</div>
                <div class="project-count">{{ getProjectUsageCount(project.id) }} 次使用</div>
              </div>
              <div class="project-actions">
                <button class="btn btn-sm btn-outline" @click="editProject(project)">编辑</button>
                <button class="btn btn-sm btn-danger" @click="deleteProject(project)">删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Security Settings -->
      <div v-if="activeTab === 'security'" class="settings-section">
        <div class="section-header">
          <h3>安全设置</h3>
          <p>用户权限和安全配置</p>
        </div>
        <div class="settings-form">
          <div class="form-group">
            <label class="form-label">管理员密码</label>
            <form class="password-group" @submit.prevent="changePassword">
              <input v-model="passwordForm.currentPassword" type="password" class="form-control" placeholder="当前密码" autocomplete="current-password">
              <input v-model="passwordForm.newPassword" type="password" class="form-control" placeholder="新密码" autocomplete="new-password">
              <input v-model="passwordForm.confirmPassword" type="password" class="form-control" placeholder="确认密码" autocomplete="new-password">
              <button type="submit" class="btn btn-primary">更改密码</button>
            </form>
          </div>
          <div class="form-group">
            <label class="form-label">登录超时时间 (分钟)</label>
            <input v-model.number="settings.security.sessionTimeout" type="number" class="form-control" min="5">
          </div>
        </div>
      </div>

      <!-- Data Management -->
      <div v-if="activeTab === 'data'" class="settings-section">
        <div class="section-header">
          <h3>数据管理</h3>
          <p>导入导出产品数据</p>
        </div>
        <div class="data-management">
          <div class="data-import-section">
            <h4>导入产品数据</h4>
            <div class="import-actions">
              <div class="import-info">
                <p>支持 CSV 格式文件导入产品数据。条码字段请留空，稍后在条码管理页面手动生成。</p>
                <p><strong>CSV 格式说明：</strong></p>
                <p>产品名称,英文名称,条码,类别,位置,供应商,描述,当前库存,最小库存,单价,当前单价,总成本价值,条码图片,二维码图片,条码更新时间,创建时间,更新时间</p>
                <div class="field-rules">
                  <p><strong>字段说明：</strong></p>
                  <ul>
                    <li><strong>产品名称</strong> - 必填</li>
                    <li><strong>英文名称</strong> - 可留空</li>
                    <li><strong>条码</strong> - 请留空，稍后在条码管理页面生成</li>
                    <li><strong>类别</strong> - 必填，必须是系统中已存在的类别</li>
                    <li><strong>位置</strong> - 可留空</li>
                    <li><strong>供应商</strong> - 可留空</li>
                    <li><strong>描述</strong> - 可留空</li>
                    <li><strong>当前库存</strong> - 可留空，默认为0</li>
                    <li><strong>最小库存</strong> - 可留空，默认为0</li>
                    <li><strong>单价</strong> - 可留空，如果为空则在入库时计入</li>
                    <li><strong>当前单价</strong> - 可留空，如果为空则在入库后计算</li>
                    <li><strong>总成本价值</strong> - 可留空，默认为0，入库后自动计算</li>
                    <li><strong>条码图片</strong> - 可留空，系统生成条码时自动填入</li>
                    <li><strong>二维码图片</strong> - 可留空，系统生成二维码时自动填入</li>
                    <li><strong>条码更新时间</strong> - 可留空，系统自动生成</li>
                    <li><strong>创建时间</strong> - 可留空，系统自动生成</li>
                    <li><strong>更新时间</strong> - 可留空，系统自动生成</li>
                  </ul>
                </div>
              </div>
              <div class="import-controls">
                <input 
                  type="file" 
                  ref="importFileInput"
                  accept=".csv"
                  @change="handleFileImport"
                  class="file-input"
                  style="display: none;"
                />
                <button class="btn btn-primary" @click="selectImportFile">
                  <span>📁</span>
                  选择 CSV 文件
                </button>
                <button class="btn btn-secondary" @click="downloadTemplate">
                  <span>📋</span>
                  下载模板
                </button>
              </div>
            </div>
            <div v-if="importPreview.length > 0" class="import-preview">
              <h5>导入预览</h5>
              <div class="preview-table-container">
                <table class="preview-table">
                  <thead>
                    <tr>
                      <th>产品名称</th>
                      <th>英文名称</th>
                      <th>条码</th>
                      <th>类别</th>
                      <th>位置</th>
                      <th>供应商</th>
                      <th>描述</th>
                      <th>库存</th>
                      <th>最小库存</th>
                      <th>单价</th>
                      <th>当前单价</th>
                      <th>总成本价值</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, index) in importPreview" :key="index" :class="{ 'error-row': item.status === 'error' }">
                      <td>{{ item.name }}</td>
                      <td>{{ item.name_en || '-' }}</td>
                      <td>{{ item.barcode || '待生成' }}</td>
                      <td>{{ item.category_name || '-' }}</td>
                      <td>{{ item.location || '-' }}</td>
                      <td>{{ item.supplier || '-' }}</td>
                      <td>{{ item.description || '-' }}</td>
                      <td>{{ item.stock || 0 }}</td>
                      <td>{{ item.min_stock || 0 }}</td>
                      <td>{{ formatPrice(item.price || 0) }}</td>
                      <td>{{ formatPrice(item.current_unit_price || 0) }}</td>
                      <td>{{ formatPrice(item.total_cost_value || 0) }}</td>
                      <td>
                        <span class="status-badge" :class="item.status">
                          {{ getImportStatusText(item.status) }}
                        </span>
                        <div v-if="item.error" class="error-message">{{ item.error }}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="import-summary">
                <div class="summary-item">
                  <span>总计: {{ importPreview.length }} 条</span>
                </div>
                <div class="summary-item success">
                  <span>有效: {{ importPreview.filter(i => i.status === 'valid').length }} 条</span>
                </div>
                <div class="summary-item warning">
                  <span>需要更新: {{ importPreview.filter(i => i.status === 'warning').length }} 条</span>
                </div>
                <div class="summary-item error">
                  <span>错误: {{ importPreview.filter(i => i.status === 'error').length }} 条</span>
                </div>
              </div>
              <div class="import-actions">
                <button class="btn btn-primary" @click="executeImport" 
                        :disabled="importPreview.filter(i => i.status === 'valid' || i.status === 'warning').length === 0">
                  <span>✅</span>
                  确认导入
                </button>
                <button class="btn btn-outline" @click="clearImportPreview">
                  <span>🗑️</span>
                  清除预览
                </button>
              </div>
            </div>
          </div>
          
          <div class="data-export-section">
            <h4>导出产品数据</h4>
            <div class="export-actions">
              <button class="btn btn-primary btn-large" @click="exportProductsCSV">
                <span>📊</span>
                导出 CSV (Excel友好)
              </button>
              <button class="btn btn-secondary btn-large" @click="exportProductsJSON">
                <span>📄</span>
                导出 JSON
              </button>
              <button class="btn btn-info btn-large" @click="exportProductsFullCSV">
                <span>🔍</span>
                导出完整CSV (含图片数据)
              </button>
            </div>
            <div class="export-description">
              <p><small>
                • <strong>CSV (Excel友好)</strong>：图片数据显示为简短描述，适合在Excel中查看<br>
                • <strong>JSON</strong>：完整的结构化数据，适合程序处理<br>
                • <strong>完整CSV</strong>：包含完整的Base64图片数据，适合数据迁移
              </small></p>
            </div>
          </div>
          
          <div class="data-repair-section">
            <h4>数据修复</h4>
            <div class="repair-info">
              <p>修复产品价格数据：自动更新产品的当前单价和总成本价值。</p>
              <p><small>
                • 如果产品的"当前单价"为空但"单价"有值，将使用"单价"填充"当前单价"<br>
                • 如果产品的"总成本价值"为空，将根据库存数量×当前单价自动计算<br>
                • 适用于导入数据后的价格字段补全
              </small></p>
            </div>
            <div class="repair-actions">
              <button class="btn btn-warning btn-large" @click="fixProductPrices" :disabled="isFixingPrices">
                <span>🔧</span>
                {{ isFixingPrices ? '修复中...' : '修复产品价格' }}
              </button>
            </div>
            <div v-if="priceFixResult" class="repair-result">
              <div class="result-summary">
                <h5>修复结果</h5>
                <p><strong>{{ priceFixResult.message }}</strong></p>
                <div class="result-stats">
                  <div class="stat-item">
                    <span class="label">总产品数:</span>
                    <span class="value">{{ priceFixResult.verification.totalProducts }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="label">有单价的产品:</span>
                    <span class="value">{{ priceFixResult.verification.withUnitPrice }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="label">有总价值的产品:</span>
                    <span class="value">{{ priceFixResult.verification.withTotalValue }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="label">库存总价值:</span>
                    <span class="value">¥{{ formatPrice(priceFixResult.verification.totalInventoryValue) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="data-initialization-section">
            <h4>数据初始化</h4>
            <div class="init-status-display" v-if="initStatus">
              <div class="status-card" :class="initStatus.is_initialized ? 'initialized' : 'not-initialized'">
                <div class="status-header">
                  <span class="status-icon">{{ initStatus.is_initialized ? '✅' : '⚠️' }}</span>
                  <span class="status-title">{{ initStatus.is_initialized ? '已初始化' : '未初始化' }}</span>
                </div>
                <div class="status-details">
                  <div class="status-row">
                    <span>产品总数:</span>
                    <span>{{ initStatus.stock_stats.total_products }}</span>
                  </div>
                  <div class="status-row">
                    <span>有库存产品:</span>
                    <span>{{ initStatus.stock_stats.products_with_stock }}</span>
                  </div>
                  <div class="status-row">
                    <span>交易记录:</span>
                    <span>{{ initStatus.transaction_stats.total_transactions }}</span>
                  </div>
                  <div class="status-row">
                    <span>库存总价值:</span>
                    <span>¥{{ formatPrice(initStatus.stock_stats.total_stock_value || 0) }}</span>
                  </div>
                  <div v-if="initStatus.init_records.count > 0" class="status-row">
                    <span>初始化记录:</span>
                    <span>{{ initStatus.init_records.count }} 条</span>
                  </div>
                </div>
                <div v-if="initStatus.recommendations.need_initialization" class="status-message">
                  <span>{{ initStatus.recommendations.message }}</span>
                </div>
              </div>
            </div>
            <div class="init-info">
              <p>数据初始化将现有产品库存转换为入库交易记录，为月度台账提供正确的期初库存基础。</p>
              <p><small>
                • 适用于首次使用系统或重新导入数据后<br>
                • 将设置初始化日期为 2025-07-01<br>
                • 每个系统只应执行一次初始化<br>
                • 执行前请确保产品数据已正确导入
              </small></p>
            </div>
            <div class="init-actions">
              <button class="btn btn-warning" @click="checkInitializationStatus" :disabled="isCheckingInit">
                <span>🔍</span>
                {{ isCheckingInit ? '检查中...' : '检查初始化状态' }}
              </button>
              <button class="btn btn-primary" @click="initializeStockData" 
                      :disabled="isInitializing || (initStatus && initStatus.is_initialized)">
                <span>🚀</span>
                {{ isInitializing ? '初始化中...' : (initStatus && initStatus.is_initialized ? '已初始化' : '初始化库存数据') }}
              </button>
              <button class="btn btn-outline" @click="recalculateStock" :disabled="isRecalculating">
                <span>🔄</span>
                {{ isRecalculating ? '计算中...' : '重新计算库存' }}
              </button>
            </div>
            <div v-if="initResult" class="init-result">
              <div class="result-summary">
                <h5>初始化结果</h5>
                <p><strong>{{ initResult.message }}</strong></p>
                <div v-if="initResult.processed_products" class="result-stats">
                  <div class="stat-item">
                    <span class="label">处理产品数:</span>
                    <span class="value">{{ initResult.processed_products }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="label">创建交易记录:</span>
                    <span class="value">{{ initResult.transaction_count }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="label">总库存数量:</span>
                    <span class="value">{{ initResult.total_stock_quantity }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="label">总库存价值:</span>
                    <span class="value">¥{{ formatPrice(initResult.total_stock_value || 0) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Backup Settings -->
      <div v-if="activeTab === 'backup'" class="settings-section">
        <div class="section-header">
          <h3>备份设置</h3>
          <p>数据备份、恢复和快照管理</p>
        </div>
        <div class="backup-section">
          <!-- 数据库备份操作 -->
          <div class="backup-database-section">
            <h4>数据库备份</h4>
            <div class="backup-info">
              <p>完整备份包含所有产品、交易记录、快照数据和系统配置。</p>
            </div>
            <div class="backup-actions">
              <button class="btn btn-primary" @click="createBackup">
                <span>💾</span>
                立即备份
              </button>
              <button class="btn btn-secondary" @click="downloadBackup">
                <span>📥</span>
                下载备份
              </button>
              <button class="btn btn-warning" @click="restoreBackup">
                <span>📤</span>
                恢复备份
              </button>
            </div>
          </div>
          
          <!-- 快照管理操作 -->
          <div class="snapshot-management-section">
            <h4>快照管理</h4>
            <div class="snapshot-info">
              <p>快照用于优化历史数据查询性能，系统每月自动生成。您可以手动管理快照数据。</p>
            </div>
            <div class="snapshot-actions">
              <button class="btn btn-primary" @click="generateCurrentSnapshot" title="为当前月份生成库存快照">
                <span>📸</span>
                生成当前快照
              </button>
              <button class="btn btn-info" @click="exportSnapshotData" title="导出所有快照数据为JSON文件">
                <span>📊</span>
                导出快照数据
              </button>
              <button class="btn btn-warning" @click="cleanupOldSnapshots" title="删除6个月前的旧快照数据">
                <span>🧹</span>
                清理旧快照
              </button>
            </div>
            <div class="snapshot-stats" v-if="snapshotStats">
              <div class="stat-item">
                <span class="stat-label">快照月数:</span>
                <span class="stat-value">{{ snapshotStats.overview?.total_months || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">产品快照:</span>
                <span class="stat-value">{{ snapshotStats.overview?.total_product_snapshots || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">最新快照:</span>
                <span class="stat-value">
                  {{ snapshotStats.overview?.latest_snapshot ? 
                      `${snapshotStats.overview.latest_snapshot.year}年${snapshotStats.overview.latest_snapshot.month}月` : 
                      '无' }}
                </span>
              </div>
              <div class="stat-item">
                <span class="stat-label">最后生成时间:</span>
                <span class="stat-value">
                  {{ snapshotStats.overview?.latest_snapshot?.snapshot_date ? 
                      formatDate(snapshotStats.overview.latest_snapshot.snapshot_date) : 
                      '无' }}
                </span>
              </div>
              <div class="stat-item">
                <span class="stat-label">总价值:</span>
                <span class="stat-value">¥{{ formatCurrency(snapshotStats.overview?.total_value || 0) }}</span>
              </div>
            </div>
          </div>
          
          <!-- 备份配置 -->
          <div class="backup-settings">
            <h4>备份配置</h4>
            <div class="form-group checkbox-group">
              <label class="checkbox-label">
                <input v-model="settings.backup.autoBackup" type="checkbox" class="form-checkbox">
                启用自动备份
              </label>
            </div>
            <div class="form-group">
              <label class="form-label">备份频率</label>
              <select v-model="settings.backup.frequency" class="form-control">
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">保留备份数量</label>
              <input v-model.number="settings.backup.retentionCount" type="number" class="form-control" min="1">
            </div>
          </div>
          <div class="backup-history">
            <h4>备份历史</h4>
            <div class="backup-list">
              <div v-for="backup in backupHistory" :key="backup.id" class="backup-item">
                <div class="backup-info">
                  <div class="backup-name">{{ backup.name }}</div>
                  <div class="backup-date">{{ formatDate(backup.created_at) }}</div>
                  <div class="backup-size">{{ formatFileSize(backup.size) }}</div>
                </div>
                <div class="backup-actions">
                  <button class="btn btn-sm btn-outline" @click="downloadBackupFile(backup)">下载</button>
                  <button class="btn btn-sm btn-danger" @click="deleteBackup(backup)">删除</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- System Info -->
      <div v-if="activeTab === 'system'" class="settings-section">
        <div class="section-header">
          <h3>系统信息</h3>
          <p>系统状态和版本信息</p>
        </div>
        <div class="system-info">
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">系统版本</div>
              <div class="info-value">{{ systemInfo.version }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">数据库版本</div>
              <div class="info-value">{{ systemInfo.dbVersion }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">运行时间</div>
              <div class="info-value">{{ systemInfo.uptime }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">数据库大小</div>
              <div class="info-value">{{ formatFileSize(systemInfo.dbSize) }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">总产品数</div>
              <div class="info-value">{{ systemInfo.totalProducts }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">总交易数</div>
              <div class="info-value">{{ systemInfo.totalTransactions }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">快照月数</div>
              <div class="info-value">{{ systemInfo.totalSnapshots || 0 }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">最新快照</div>
              <div class="info-value">{{ systemInfo.latestSnapshot || '无' }}</div>
            </div>
          </div>
          <div class="system-actions">
            <button class="btn btn-warning" @click="clearCache">
              <span>🗑️</span>
              清理缓存
            </button>
            <button class="btn btn-danger" @click="resetSystem">
              <span>⚠️</span>
              重置系统
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useInventoryStore } from '@/stores/inventory'
import { generateProductBarcode } from '@/utils/barcode'
import { categoryAPI, projectAPI, settingsAPI, snapshotAPI } from '@/services/api'
import { showToast } from '@/utils/index'

export default {
  name: 'SettingsPage',
  setup() {
    const inventoryStore = useInventoryStore()
    
    // Reactive data
    const activeTab = ref('general')
    const newCategory = ref({ name: '', description: '' })
    const newProject = ref({ name: '', description: '' })
    const passwordForm = ref({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
    const backupHistory = ref([])
    const importFileInput = ref(null)
    const importPreview = ref([])
    const importProgress = ref(0)
    const snapshotStats = ref(null)
    
    // 价格修复相关
    const isFixingPrices = ref(false)
    const priceFixResult = ref(null)
    
    // 数据初始化相关
    const initStatus = ref(null)
    const initResult = ref(null)
    const isCheckingInit = ref(false)
    const isInitializing = ref(false)
    const isRecalculating = ref(false)
    
    // Settings data
    const settings = ref({
      general: {
        systemName: '备品备件管理系统',
        timezone: 'auto',
        language: 'zh-CN'
      },
      inventory: {
        defaultMinStock: 10,
        lowStockThreshold: 5,
        updateInterval: 30
      },
      security: {
        sessionTimeout: 60
      },
      backup: {
        autoBackup: true,
        frequency: 'daily',
        retentionCount: 7
      }
    })
    
    // Loading state
    const settingsLoading = ref(false)
    
    // Settings tabs
    const settingsTabs = ref([
      { id: 'general', name: '基础设置', icon: '⚙️' },
      { id: 'inventory', name: '库存设置', icon: '📦' },
      { id: 'categories', name: '类别管理', icon: '📂' },
      { id: 'projects', name: '单位/部门管理', icon: '🏢' },
      { id: 'data', name: '数据管理', icon: '📊' },
      { id: 'security', name: '安全设置', icon: '🔒' },
      { id: 'backup', name: '备份设置', icon: '💾' },
      { id: 'system', name: '系统信息', icon: '💻' }
    ])
    
    // Computed properties
    const categories = computed(() => inventoryStore.categories)
    const projects = computed(() => inventoryStore.projects)
    const products = computed(() => inventoryStore.products)
    
    const systemInfo = computed(() => ({
      version: '1.0.0',
      dbVersion: 'SQLite 3.41.0',
      uptime: '15 天 8 小时',
      dbSize: 5242880,
      totalProducts: products.value.length,
      totalTransactions: inventoryStore.transactions.length,
      totalSnapshots: snapshotStats.value?.overview?.total_months || 0,
      latestSnapshot: snapshotStats.value?.overview?.latest_snapshot ? 
        `${snapshotStats.value.overview.latest_snapshot.year}年${snapshotStats.value.overview.latest_snapshot.month}月` : 
        '无'
    }))
    
    // Methods
    const getCategoryProductCount = (categoryId) => {
      return products.value.filter(p => p.category_id === categoryId).length
    }
    
    const addCategory = async () => {
      if (!newCategory.value.name.trim()) {
        showToast('请输入类别名称', 'error')
        return
      }
      
      try {
        await categoryAPI.create({
          name: newCategory.value.name.trim(),
          description: newCategory.value.description.trim() || null
        })
        
        // 重新加载类别数据
        await inventoryStore.loadCategories()
        
        newCategory.value = { name: '', description: '' }
        showToast('类别添加成功', 'success')
      } catch (error) {
        console.error('添加类别失败:', error)
        showToast('添加失败: ' + (error.response?.data?.message || error.message), 'error')
      }
    }
    
    const editCategory = async (category) => {
      const newName = prompt('请输入新的类别名称:', category.name)
      if (newName && newName.trim() && newName !== category.name) {
        try {
          await categoryAPI.update(category.id, {
            name: newName.trim(),
            description: category.description
          })
          
          // 重新加载类别数据
          await inventoryStore.loadCategories()
          
          showToast('类别更新成功', 'success')
        } catch (error) {
          console.error('更新类别失败:', error)
          showToast('更新失败: ' + (error.response?.data?.message || error.message), 'error')
        }
      }
    }
    
    const deleteCategory = async (category) => {
      const productCount = getCategoryProductCount(category.id)
      
      let confirmMessage = `确定要删除类别 "${category.name}" 吗？`
      if (productCount > 0) {
        confirmMessage = `类别 "${category.name}" 下有 ${productCount} 个产品。删除后这些产品将被移至"未分类"。确定继续吗？`
      }
      
      if (confirm(confirmMessage)) {
        try {
          await categoryAPI.delete(category.id)
          
          // 重新加载相关数据
          await Promise.all([
            inventoryStore.loadCategories(),
            inventoryStore.loadProducts() // 重新加载产品数据，因为产品的类别可能被更新
          ])
          
          showToast('类别删除成功', 'success')
        } catch (error) {
          console.error('删除类别失败:', error)
          showToast('删除类别失败: ' + (error.response?.data?.message || error.message), 'error')
        }
      }
    }
    
    // Project Management Methods
    const getProjectUsageCount = (projectId) => {
      // 获取该项目的使用次数（交易记录数）
      const project = projects.value.find(p => p.id === projectId)
      return project ? project.transaction_count || 0 : 0
    }
    
    const addProject = async () => {
      if (!newProject.value.name.trim()) {
        showToast('请输入单位/部门名称', 'error')
        return
      }
      
      try {
        await projectAPI.create({
          name: newProject.value.name.trim(),
          description: newProject.value.description.trim() || null
        })
        
        // 重新加载项目数据
        await inventoryStore.loadProjects()
        
        newProject.value = { name: '', description: '' }
        showToast('单位/部门添加成功', 'success')
      } catch (error) {
        console.error('添加单位/部门失败:', error)
        showToast('添加失败: ' + (error.response?.data?.message || error.message), 'error')
      }
    }
    
    const editProject = async (project) => {
      const newName = prompt('修改单位/部门名称:', project.name)
      if (newName && newName.trim() && newName !== project.name) {
        try {
          await projectAPI.update(project.id, {
            name: newName.trim(),
            description: project.description
          })
          
          // 重新加载项目数据
          await inventoryStore.loadProjects()
          
          showToast('单位/部门修改成功', 'success')
        } catch (error) {
          console.error('修改单位/部门失败:', error)
          showToast('修改失败: ' + (error.response?.data?.message || error.message), 'error')
        }
      }
    }
    
    const deleteProject = async (project) => {
      const usageCount = getProjectUsageCount(project.id)
      
      let confirmMessage = `确定要删除单位/部门 "${project.name}" 吗？`
      if (usageCount > 0) {
        confirmMessage = `单位/部门 "${project.name}" 已被使用过 ${usageCount} 次。删除后相关交易记录将保留但无法关联到此单位/部门。确定继续吗？`
      }
      
      if (confirm(confirmMessage)) {
        try {
          await projectAPI.delete(project.id)
          
          // 重新加载项目数据
          await inventoryStore.loadProjects()
          
          showToast('单位/部门删除成功', 'success')
        } catch (error) {
          console.error('删除单位/部门失败:', error)
          showToast('删除单位/部门失败: ' + (error.response?.data?.message || error.message), 'error')
        }
      }
    }
    
    const changePassword = async () => {
      if (!passwordForm.value.currentPassword || !passwordForm.value.newPassword) {
        showToast('请填写完整的密码信息', 'error')
        return
      }
      
      if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
        showToast('新密码和确认密码不一致', 'error')
        return
      }
      
      if (passwordForm.value.newPassword.length < 6) {
        showToast('新密码至少需要6位', 'error')
        return
      }
      
      try {
        await settingsAPI.changePassword({
          currentPassword: passwordForm.value.currentPassword,
          newPassword: passwordForm.value.newPassword
        })
        
        passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
        showToast('密码更改成功', 'success')
      } catch (error) {
        console.error('修改密码失败:', error)
        showToast('密码更改失败: ' + (error.response?.data?.message || error.message), 'error')
      }
    }
    
    const createBackup = async () => {
      try {
        const response = await settingsAPI.createBackup()
        await loadBackupHistory() // 重新加载备份列表
        showToast('备份创建成功', 'success')
      } catch (error) {
        console.error('创建备份失败:', error)
        showToast('备份创建失败: ' + (error.response?.data?.message || error.message), 'error')
      }
    }

    const loadBackupHistory = async () => {
      try {
        const response = await settingsAPI.listBackups()
        backupHistory.value = response.data.backups.map(backup => ({
          id: backup.filename,
          name: backup.filename.replace('.db', ''),
          created_at: backup.created_at,
          size: backup.size,
          filename: backup.filename
        }))
      } catch (error) {
        console.error('加载备份历史失败:', error)
      }
    }
    
    const downloadBackup = async () => {
      try {
        showToast('正在生成备份...', 'info')
        
        const response = await settingsAPI.exportData(['products', 'categories', 'projects', 'transactions'])
        const data = response.data
        
        // 添加备份元信息
        const backupData = {
          backup_info: {
            created_at: new Date().toISOString(),
            version: '1.0.0',
            type: 'full_backup'
          },
          ...data
        }
        
        // 创建JSON文件并下载
        const jsonString = JSON.stringify(backupData, null, 2)
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' })
        
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `backup_${new Date().toISOString().split('T')[0]}.json`
        link.style.display = 'none'
        
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        showToast('备份下载成功', 'success')
      } catch (error) {
        console.error('下载备份失败:', error)
        showToast('备份下载失败: ' + (error.response?.data?.message || error.message), 'error')
      }
    }
    
    const restoreBackup = () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = (e) => {
        const file = e.target.files[0]
        if (file) {
          const reader = new FileReader()
          reader.onload = (e) => {
            try {
              const data = JSON.parse(e.target.result)
              if (confirm('确定要恢复备份吗？这将覆盖现有数据。')) {
                // In a real app, this would restore the data
                showToast('备份恢复成功', 'success')
              }
            } catch (error) {
              showToast('备份文件格式错误', 'error')
            }
          }
          reader.readAsText(file)
        }
      }
      input.click()
    }
    
    const downloadBackupFile = async (backup) => {
      try {
        showToast('备份下载中...', 'info')
        
        // 修复：使用正确的API调用方式
        const response = await settingsAPI.downloadBackup(backup.filename)
        
        // 修复：确保response.data是Blob对象
        const blob = response.data instanceof Blob ? response.data : new Blob([response.data])
        
        // 创建下载链接
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = backup.filename
        link.style.display = 'none'
        
        // 添加到DOM并触发下载
        document.body.appendChild(link)
        link.click()
        
        // 清理
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        showToast('备份下载成功', 'success')
      } catch (error) {
        console.error('下载备份失败:', error)
        showToast('备份下载失败: ' + (error.response?.data?.message || error.message), 'error')
      }
    }
    
    const deleteBackup = async (backup) => {
      if (confirm(`确定要删除备份 "${backup.name}" 吗？`)) {
        try {
          await settingsAPI.deleteBackup(backup.filename)
          await loadBackupHistory() // 重新加载备份列表
          showToast('备份删除成功', 'success')
        } catch (error) {
          console.error('删除备份失败:', error)
          showToast('备份删除失败: ' + (error.response?.data?.message || error.message), 'error')
        }
      }
    }
    
    const clearCache = () => {
      if (confirm('确定要清理系统缓存吗？')) {
        showToast('缓存清理成功', 'success')
      }
    }
    
    const resetSystem = async () => {
      if (confirm('⚠️ 警告：这将删除所有产品、交易记录和快照数据，但会保留部门和产品类别。确定要继续吗？')) {
        if (confirm('这是最后确认，重置后数据无法恢复。确定要重置系统吗？')) {
          try {
            showToast('正在重置系统...', 'info')
            const response = await settingsAPI.resetSystem()
            
            // 重新加载数据
            await inventoryStore.loadInitialData()
            
            showToast(
              `系统重置成功！已删除 ${response.data.productsDeleted} 个产品和 ${response.data.transactionsDeleted} 条交易记录`,
              'success'
            )
          } catch (error) {
            console.error('重置系统失败:', error)
            showToast('系统重置失败: ' + (error.response?.data?.message || error.message), 'error')
          }
        }
      }
    }
    
    // 快照相关方法
    const loadSnapshotStats = async () => {
      try {
        const response = await snapshotAPI.getStats()
        snapshotStats.value = response.data.data
      } catch (error) {
        console.error('加载快照统计失败:', error)
      }
    }
    
    const exportSnapshotData = async () => {
      try {
        showToast('正在导出快照数据...', 'info', 2000)
        
        // 获取所有快照数据
        const response = await snapshotAPI.getList()
        const snapshots = response.data.data?.snapshots || []
        
        if (snapshots.length === 0) {
          showToast('没有可导出的快照数据', 'warning')
          return
        }
        
        // 准备导出数据
        const exportData = {
          export_time: new Date().toISOString(),
          total_snapshots: snapshots.length,
          snapshots: snapshots
        }
        
        // 创建并下载文件
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
          type: 'application/json' 
        })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `snapshot_data_${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        showToast(`快照数据导出成功 (${snapshots.length} 条记录)`, 'success')
      } catch (error) {
        console.error('导出快照数据失败:', error)
        showToast('导出快照数据失败: ' + (error.response?.data?.message || error.message), 'error')
      }
    }
    
    const cleanupOldSnapshots = async () => {
      if (confirm('确定要清理旧的快照数据吗？这将删除6个月前的快照。')) {
        try {
          showToast('正在清理旧快照...', 'info')
          const response = await snapshotAPI.cleanupOldSnapshots()
          
          if (response.data.success) {
            await loadSnapshotStats() // 重新加载统计
            showToast(response.data.message, 'success')
          } else {
            throw new Error(response.data.error || '清理失败')
          }
        } catch (error) {
          console.error('清理旧快照失败:', error)
          showToast('清理旧快照失败: ' + (error.response?.data?.message || error.message), 'error')
        }
      }
    }
    
    const createSnapshotBackup = async () => {
      try {
        showToast('正在创建快照备份...', 'info')
        
        // 获取所有快照统计和详情
        const statsResponse = await snapshotAPI.getStats()
        const listResponse = await snapshotAPI.getList()
        
        // 准备备份数据
        const backupData = {
          backup_time: new Date().toISOString(),
          backup_type: 'snapshot_backup',
          version: '1.0',
          statistics: statsResponse.data.data,
          snapshots: listResponse.data.data?.snapshots || []
        }
        
        // 创建并下载备份文件
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { 
          type: 'application/json' 
        })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `snapshot_backup_${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        showToast('快照备份创建成功', 'success')
      } catch (error) {
        console.error('创建快照备份失败:', error)
        showToast('创建快照备份失败: ' + (error.response?.data?.message || error.message), 'error')
      }
    }

    const generateCurrentSnapshot = async () => {
      try {
        showToast('正在生成当前月份快照...', 'info', 2000) // 缩短显示时间
        const response = await snapshotAPI.generateCurrentSnapshot()
        if (response.data.success) {
          await loadSnapshotStats() // 重新加载统计
          const message = response.data.message || '当前月份快照生成成功'
          showToast(message, 'success')
        } else {
          throw new Error(response.data.message || '生成快照失败')
        }
      } catch (error) {
        console.error('生成当前月份快照失败:', error)
        showToast('生成当前月份快照失败: ' + (error.response?.data?.message || error.message), 'error')
      }
    }
    
    const saveAllSettings = async () => {
      if (settingsLoading.value) return
      
      settingsLoading.value = true
      try {
        // 将嵌套的设置对象扁平化为服务器期望的格式
        const flatSettings = {}
        Object.keys(settings.value).forEach(category => {
          Object.keys(settings.value[category]).forEach(key => {
            flatSettings[`${category}.${key}`] = settings.value[category][key]
          })
        })
        
        await settingsAPI.updateSettings(flatSettings)
        showToast('设置保存成功', 'success')
      } catch (error) {
        console.error('保存设置失败:', error)
        showToast('保存设置失败: ' + (error.response?.data?.message || error.message), 'error')
      } finally {
        settingsLoading.value = false
      }
    }
    
    const loadSettings = async () => {
      try {
        const response = await settingsAPI.getSettings()
        const serverSettings = response.data
        
        // 将服务器的扁平化设置转换为嵌套对象
        Object.keys(serverSettings).forEach(key => {
          const [category, setting] = key.split('.')
          if (category && setting && settings.value[category]) {
            settings.value[category][setting] = serverSettings[key].value
          }
        })
      } catch (error) {
        console.error('加载设置失败:', error)
        // 如果加载失败，使用默认设置
      }
    }
    
    const resetToDefaults = async () => {
      if (confirm('确定要恢复所有设置到默认值吗？')) {
        // 重置为默认值
        settings.value = {
          general: {
            systemName: '备品备件管理系统',
            timezone: 'auto',
            language: 'zh-CN'
          },
          inventory: {
            defaultMinStock: 10,
            lowStockThreshold: 5,
            updateInterval: 30
          },
          security: {
            sessionTimeout: 60
          },
          backup: {
            autoBackup: true,
            frequency: 'daily',
            retentionCount: 7
          }
        }
        
        // 保存默认设置到服务器
        await saveAllSettings()
        showToast('设置已恢复默认值', 'success')
      }
    }
    
    // Import/Export functions
    const selectImportFile = () => {
      importFileInput.value.click()
    }
    
    const handleFileImport = (event) => {
      const file = event.target.files[0]
      if (!file) return
      
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const csvData = e.target.result
          parseCSVData(csvData)
        } catch (error) {
          showToast('文件读取失败', 'error')
        }
      }
      reader.readAsText(file)
    }
    
    const parseCSVData = async (csvData) => {
      // 确保产品数据是最新且完整的，加载所有产品用于重复检测
      await inventoryStore.loadAllProducts()
      console.log(`Current products in store: ${products.value.length}`)
      
      const lines = csvData.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        showToast('CSV文件格式错误或为空', 'error')
        return
      }
      
      // 更智能的CSV解析，处理引号包围的字段
      const parseCSVLine = (line) => {
        const result = []
        let current = ''
        let inQuotes = false
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        result.push(current.trim())
        return result
      }
      
      const headers = parseCSVLine(lines[0])
      console.log('CSV headers:', headers)
      
      const preview = []
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        
        if (values.length < 2) continue // Skip invalid rows
        
        // 根据实际CSV文件格式解析
        // 实际格式：产品名称,英文名称,条码,类别,位置,供应商,描述,当前库存,最小库存,单价,当前单价,总成本价值,创建时间,更新时间
        const item = {
          name: values[0] ? values[0].replace(/^"|"$/g, '') : '', // 移除引号
          name_en: values[1] ? values[1].replace(/^"|"$/g, '') : '',
          barcode: values[2] ? values[2].replace(/^"|"$/g, '') : null,
          category_name: values[3] ? values[3].replace(/^"|"$/g, '') : '',
          location: values[4] ? values[4].replace(/^"|"$/g, '') : '',
          supplier: values[5] ? values[5].replace(/^"|"$/g, '') : '',
          description: values[6] ? values[6].replace(/^"|"$/g, '') : '',
          stock: values[7] ? parseFloat(values[7]) || 0 : 0,
          min_stock: values[8] ? parseFloat(values[8]) || 0 : 0,
          price: values[9] ? parseFloat(values[9]) || 0 : 0,
          current_unit_price: values[10] ? parseFloat(values[10]) || 0 : 0,
          total_cost_value: values[11] ? parseFloat(values[11]) || 0 : 0,
          created_at: values[12] ? values[12].replace(/^"|"$/g, '') : '',
          updated_at: values[13] ? values[13].replace(/^"|"$/g, '') : '',
          // 条码相关字段设为空，因为CSV中没有这些字段
          barcode_image: '',
          qr_code_image: '',
          barcode_updated_at: '',
          status: 'valid'
        }
        
        // 智能计算单价和总价值的互相转换
        if (item.stock > 0) {
          // 情况1：有总价值但没有单价 - 根据总价值计算单价，但保持原始总价值不变
          if (item.total_cost_value > 0 && (!item.current_unit_price || item.current_unit_price === 0) && (!item.price || item.price === 0)) {
            const calculatedUnitPrice = parseFloat((item.total_cost_value / item.stock).toFixed(4));
            item.current_unit_price = calculatedUnitPrice;
            item.price = calculatedUnitPrice; // 同时设置历史单价
            // 保持原始总价值不变，不重新计算
            console.log(`Auto-calculated unit price for "${item.name}": ${calculatedUnitPrice} (from total: ${item.total_cost_value}, stock: ${item.stock}) - keeping original total value`);
          }
          // 情况2：有单价但没有总价值 - 根据单价计算总价值
          else if (!item.total_cost_value || item.total_cost_value === 0) {
            const unitPrice = item.current_unit_price || item.price || 0;
            if (unitPrice > 0) {
              item.total_cost_value = parseFloat((unitPrice * item.stock).toFixed(4));
              console.log(`Auto-calculated total value for "${item.name}": ${item.total_cost_value} (from unit price: ${unitPrice}, stock: ${item.stock})`);
            }
          }
          // 情况3：既有单价又有总价值 - 检查是否一致，如果不一致以总价值为准重新计算单价
          else if (item.total_cost_value > 0 && (item.current_unit_price > 0 || item.price > 0)) {
            const existingUnitPrice = item.current_unit_price || item.price || 0;
            const calculatedTotal = existingUnitPrice * item.stock;
            const tolerance = 0.0001; // 允许0.0001的误差
            
            if (Math.abs(calculatedTotal - item.total_cost_value) > tolerance) {
              // 不一致时，以总价值为准重新计算单价，但保持原始总价值
              const recalculatedUnitPrice = parseFloat((item.total_cost_value / item.stock).toFixed(4));
              item.current_unit_price = recalculatedUnitPrice;
              item.price = recalculatedUnitPrice;
              // 保持原始总价值不变
              console.log(`Price inconsistency detected for "${item.name}". Recalculated unit price: ${recalculatedUnitPrice} (total: ${item.total_cost_value}, stock: ${item.stock}) - keeping original total value`);
            }
          }
        }
        
        // 如果没有current_unit_price但有price，则使用price
        if (!item.current_unit_price && item.price > 0) {
          item.current_unit_price = item.price;
        }
        
        // 验证必填字段和重复检查
        if (!item.name) {
          item.status = 'error'
          item.error = '产品名称不能为空'
        } else if (!item.category_name) {
          item.status = 'error'
          item.error = '类别不能为空'
        } else {
          // 验证类别是否存在
          const categoryExists = categories.value.some(cat => cat.name === item.category_name)
          if (!categoryExists) {
            item.status = 'error'
            item.error = `类别"${item.category_name}"不存在`
          } else {
            // 检查产品名称是否已存在（精确匹配，忽略大小写）
            const existingProduct = products.value.find(p => 
              p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
            )
            if (existingProduct) {
              item.status = 'warning'
              item.error = '产品已存在，将更新现有信息'
              item.existing_id = existingProduct.id
              console.log(`Found existing product: "${item.name}" -> ID: ${existingProduct.id}`)
            } else {
              item.status = 'valid'
              console.log(`New product: "${item.name}" in category "${item.category_name}"`)
            }
          }
        }
        
        // 不自动生成条码，保持为空等待用户手动生成
        // 注释掉自动生成条码的逻辑
        // if (!item.barcode) {
        //   item.barcode = generateProductBarcode()
        // }
        
        preview.push(item)
      }
      
      importPreview.value = preview
      
      // 统计结果
      const validCount = preview.filter(item => item.status === 'valid').length
      const warningCount = preview.filter(item => item.status === 'warning').length
      const errorCount = preview.filter(item => item.status === 'error').length
      
      // 计算总价值用于验证
      const totalValueFromCSV = preview
        .filter(item => (item.status === 'valid' || item.status === 'warning') && item.total_cost_value > 0)
        .reduce((sum, item) => sum + item.total_cost_value, 0)
      
      console.log(`CSV导入预览统计:`)
      console.log(`- 总记录数: ${preview.length}`)
      console.log(`- 有效记录: ${validCount}`)
      console.log(`- 警告记录: ${warningCount}`)
      console.log(`- 错误记录: ${errorCount}`)
      console.log(`- 预期总价值: ¥${totalValueFromCSV.toFixed(4)}`)
      
      showToast(`解析完成，共 ${preview.length} 条记录，新增: ${validCount}，更新: ${warningCount}，错误: ${errorCount}。预期总价值: ¥${totalValueFromCSV.toFixed(4)}`, 'success')
    }
    
    const clearImportPreview = () => {
      importPreview.value = []
      if (importFileInput.value) {
        importFileInput.value.value = ''
      }
    }
    
    const executeImport = async () => {
      const validItems = importPreview.value.filter(item => item.status === 'valid' || item.status === 'warning')
      if (validItems.length === 0) {
        showToast('没有有效的数据可导入', 'warning')
        return
      }

      const newItems = validItems.filter(item => item.status === 'valid').length
      const updateItems = validItems.filter(item => item.status === 'warning').length
      
      let confirmMessage = `确定要导入 ${validItems.length} 条产品数据吗？`
      if (newItems > 0 && updateItems > 0) {
        confirmMessage = `确定要导入 ${validItems.length} 条产品数据吗？\n\n新增: ${newItems} 条\n更新: ${updateItems} 条`
      } else if (updateItems > 0) {
        confirmMessage = `确定要更新 ${updateItems} 条现有产品数据吗？`
      }
      
      if (!confirm(confirmMessage)) {
        return
      }
      
      try {
        importProgress.value = 0
        showToast('开始导入数据...', 'info')
        
        // 在导入前计算预期总价值
        const expectedTotalValue = validItems
          .filter(item => item.total_cost_value > 0)
          .reduce((sum, item) => sum + item.total_cost_value, 0)
        
        console.log(`开始导入 ${validItems.length} 条产品`)
        console.log(`预期导入总价值: ¥${expectedTotalValue.toFixed(4)}`)
        
        // Get or create categories
        const categoryMap = new Map()
        for (const category of categories.value) {
          categoryMap.set(category.name, category.id)
        }
        
        for (let i = 0; i < validItems.length; i++) {
          const item = validItems[i]
          
          // Handle category
          let category_id = null
          if (item.category_name) {
            if (categoryMap.has(item.category_name)) {
              category_id = categoryMap.get(item.category_name)
            } else {
              // Create new category
              const newCat = {
                id: Date.now() + i,
                name: item.category_name,
                description: ''
              }
              inventoryStore.categories.push(newCat)
              categoryMap.set(item.category_name, newCat.id)
              category_id = newCat.id
            }
          }
          
          // Create or update product
          const productData = {
            name: item.name,
            name_en: item.name_en,
            category_id: category_id,
            description: item.description,
            stock: item.stock,
            min_stock: item.min_stock,
            price: item.price || 0,
            current_unit_price: item.current_unit_price || 0,
            total_cost_value: item.total_cost_value || 0,
            location: item.location,
            supplier: item.supplier
          }
          
          // 只有当条码不为空时才添加条码字段
          if (item.barcode && item.barcode.trim()) {
            productData.barcode = item.barcode.trim()
          }
          
          // 添加条码相关字段（如果存在）
          if (item.barcode_image && item.barcode_image.trim()) {
            productData.barcode_image = item.barcode_image.trim()
          }
          if (item.qr_code_image && item.qr_code_image.trim()) {
            productData.qr_code_image = item.qr_code_image.trim()
          }
          if (item.barcode_updated_at && item.barcode_updated_at.trim()) {
            productData.barcode_updated_at = item.barcode_updated_at.trim()
          }
          
          // Check if product exists and should be updated
          if (item.existing_id) {
            await inventoryStore.updateProduct(item.existing_id, productData)
          } else {
            await inventoryStore.createProduct(productData)
          }
          importProgress.value = Math.round(((i + 1) / validItems.length) * 100)
        }
        
        const newItemsCount = validItems.filter(item => item.status === 'valid').length
        const updateItemsCount = validItems.filter(item => item.status === 'warning').length
        
        let successMessage = '导入完成！'
        if (newItemsCount > 0 && updateItemsCount > 0) {
          successMessage = `导入完成！新增 ${newItemsCount} 条，更新 ${updateItemsCount} 条产品`
        } else if (newItemsCount > 0) {
          successMessage = `导入完成！新增 ${newItemsCount} 条产品`
        } else if (updateItemsCount > 0) {
          successMessage = `导入完成！更新 ${updateItemsCount} 条产品`
        }
        
        showToast(successMessage, 'success')
        
        // 重新加载产品数据以确保下次导入时重复检测正常工作
        await inventoryStore.loadProducts()
        
        // 验证导入后的总价值
        const actualTotalValue = inventoryStore.products
          .filter(p => p.total_cost_value > 0)
          .reduce((sum, p) => sum + p.total_cost_value, 0)
        
        console.log(`导入完成验证:`)
        console.log(`- 预期总价值: ¥${expectedTotalValue.toFixed(4)}`)
        console.log(`- 实际总价值: ¥${actualTotalValue.toFixed(4)}`)
        console.log(`- 差异: ¥${(actualTotalValue - expectedTotalValue).toFixed(4)}`)
        
        if (Math.abs(actualTotalValue - expectedTotalValue) > 0.0001) {
          console.warn('⚠️ 导入后总价值与预期不符，可能存在精度问题')
        }
        
        clearImportPreview()
      } catch (error) {
        showToast('导入失败: ' + error.message, 'error')
      }
    }
    
    const downloadTemplate = () => {
      const csvContent = `产品名称,英文名称,条码,类别,位置,供应商,描述,当前库存,最小库存,单价,当前单价,总成本价值,创建时间,更新时间
"M8x20内六角螺钉","M8x20 Socket Head Cap Screw","","螺丝","A区-01货架","XXX五金公司","M8*20mm内六角螺钉，304不锈钢",100,10,0.50,0.50,50.00,"",""
"304不锈钢管","304 Stainless Steel Pipe","","金属零件","B区-02货架","ABC金属公司","φ25mm*2mm 304不锈钢管",50,5,15.80,15.80,790.00,"",""
"电气开关","Electric Switch","SW001","电仪","","电气供应商","",0,0,"","","","",""
"PP塑料盒","","","PP材质","","","用于存储小零件",20,5,"","",100.00,"",""
"安全帽","Safety Helmet","","劳保","仓库-C区","劳保用品公司","工地用安全帽",10,2,25.00,"",250.00,"",""`
      
      // Add BOM (Byte Order Mark) for Excel UTF-8 recognition
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'product_import_template.csv'
      link.click()
      
      showToast('模板下载成功', 'success')
    }
    
    const exportProductsCSV = async () => {
      try {
        // 获取完整的产品数据，包含类别名称
        const response = await settingsAPI.exportData(['products'])
        const productsData = response.data.data.products || []
        
        const headers = [
          '产品名称',
          '英文名称', 
          '条码',
          '类别',
          '位置',
          '供应商',
          '描述',
          '当前库存',
          '最小库存',
          '单价',
          '当前单价',
          '总成本价值',
          '条码图片',
          '二维码图片',
          '条码更新时间',
          '创建时间',
          '更新时间'
        ]
        
        // 处理长文本数据的函数，避免Excel中出现换行
        const sanitizeText = (text) => {
          if (!text) return ''
          // 移除换行符和回车符，避免CSV格式问题
          return text.toString().replace(/[\r\n]/g, ' ').replace(/"/g, '""')
        }
        
        // 处理图片数据的函数
        const processImageData = (imageData) => {
          if (!imageData) return '[无图片]'
          if (imageData.startsWith('data:image/')) {
            return '[Base64图片数据]' // 用简短描述替代长数据
          }
          return sanitizeText(imageData)
        }
        
        const csvContent = [
          headers.join(','),
          ...productsData.map(product => [
            `"${sanitizeText(product.name || '')}"`,
            `"${sanitizeText(product.name_en || '')}"`,
            `"${sanitizeText(product.barcode || '')}"`,
            `"${sanitizeText(product.category_name || '')}"`,
            `"${sanitizeText(product.location || '')}"`,
            `"${sanitizeText(product.supplier || '')}"`,
            `"${sanitizeText(product.description || '')}"`,
            product.stock || 0,
            product.min_stock || 0,
            product.price || 0,
            product.current_unit_price || 0,
            product.total_cost_value || 0,
            `"${processImageData(product.barcode_image)}"`,
            `"${processImageData(product.qr_code_image)}"`,
            `"${sanitizeText(product.barcode_updated_at || '')}"`,
            `"${sanitizeText(product.created_at || '')}"`,
            `"${sanitizeText(product.updated_at || '')}"`
          ].join(','))
        ].join('\n')
        
        // Add BOM (Byte Order Mark) for Excel UTF-8 recognition
        const BOM = '\uFEFF'
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `products_complete_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
        
        showToast('产品数据导出成功', 'success')
      } catch (error) {
        console.error('导出产品数据失败:', error)
        showToast('导出失败: ' + (error.response?.data?.message || error.message), 'error')
      }
    }
    
    const exportProductsJSON = async () => {
      try {
        // 获取完整的产品数据，包含类别名称
        const response = await settingsAPI.exportData(['products'])
        const productsData = response.data.data.products || []
        
        // 格式化JSON数据，使其更易读
        const jsonContent = JSON.stringify({
          export_date: new Date().toISOString(),
          total_products: productsData.length,
          products: productsData
        }, null, 2)
        
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `products_complete_${new Date().toISOString().split('T')[0]}.json`
        link.click()
        
        showToast('产品JSON数据导出成功', 'success')
      } catch (error) {
        console.error('导出产品JSON数据失败:', error)
        showToast('导出失败: ' + (error.response?.data?.message || error.message), 'error')
      }
    }
    
    // 导出包含完整图片数据的CSV（适合程序读取）
    const exportProductsFullCSV = async () => {
      try {
        const response = await settingsAPI.exportData(['products'])
        const productsData = response.data.data.products || []
        
        const headers = [
          '产品名称',
          '英文名称', 
          '条码',
          '类别',
          '位置',
          '供应商',
          '描述',
          '当前库存',
          '最小库存',
          '单价',
          '当前单价',
          '总成本价值',
          '条码图片',
          '二维码图片',
          '条码更新时间',
          '创建时间',
          '更新时间'
        ]
        
        // 完整数据导出（包含Base64图片数据）
        const csvContent = [
          headers.join(','),
          ...productsData.map(product => [
            `"${(product.name || '').replace(/"/g, '""')}"`,
            `"${(product.name_en || '').replace(/"/g, '""')}"`,
            `"${(product.barcode || '').replace(/"/g, '""')}"`,
            `"${(product.category_name || '').replace(/"/g, '""')}"`,
            `"${(product.location || '').replace(/"/g, '""')}"`,
            `"${(product.supplier || '').replace(/"/g, '""')}"`,
            `"${(product.description || '').replace(/"/g, '""')}"`,
            product.stock || 0,
            product.min_stock || 0,
            product.price || 0,
            product.current_unit_price || 0,
            product.total_cost_value || 0,
            `"${(product.barcode_image || '').replace(/"/g, '""')}"`,
            `"${(product.qr_code_image || '').replace(/"/g, '""')}"`,
            `"${(product.barcode_updated_at || '').replace(/"/g, '""')}"`,
            `"${(product.created_at || '').replace(/"/g, '""')}"`,
            `"${(product.updated_at || '').replace(/"/g, '""')}"`
          ].join(','))
        ].join('\n')
        
        const BOM = '\uFEFF'
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `products_full_data_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
        
        showToast('完整产品CSV数据导出成功（包含图片数据）', 'success')
      } catch (error) {
        console.error('导出完整产品数据失败:', error)
        showToast('导出失败: ' + (error.response?.data?.message || error.message), 'error')
      }
    }
    
    const getImportStatusText = (status) => {
      switch (status) {
        case 'valid': return '新增'
        case 'warning': return '更新'
        case 'error': return '错误'
        default: return '未知'
      }
    }
    
    // 修复产品价格数据
    const fixProductPrices = async () => {
      if (!confirm('确定要修复产品价格数据吗？\n\n此操作将：\n1. 如果"当前单价"为空，将使用"单价"填充\n2. 如果"总成本价值"为空，将根据库存×当前单价自动计算\n\n请确保在修复前已备份数据。')) {
        return
      }
      
      try {
        isFixingPrices.value = true
        priceFixResult.value = null
        
        showToast('开始修复产品价格数据...', 'info')
        
        const response = await fetch('/api/settings/fix-prices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        priceFixResult.value = result
        
        showToast(result.message, 'success')
        
        // 刷新产品数据
        await inventoryStore.loadProducts()
        
      } catch (error) {
        console.error('价格修复失败:', error)
        showToast('价格修复失败: ' + error.message, 'error')
      } finally {
        isFixingPrices.value = false
      }
    }
    
    // 数据初始化相关方法
    const checkInitializationStatus = async () => {
      try {
        isCheckingInit.value = true
        showToast('正在检查初始化状态...', 'info')
        
        const response = await fetch('/api/init/init-status')
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const status = await response.json()
        initStatus.value = status
        
        if (status.is_initialized) {
          showToast('系统已完成初始化', 'success')
        } else {
          showToast('系统尚未初始化，建议执行数据初始化', 'warning')
        }
        
      } catch (error) {
        console.error('检查初始化状态失败:', error)
        showToast('检查初始化状态失败: ' + error.message, 'error')
      } finally {
        isCheckingInit.value = false
      }
    }
    
    const initializeStockData = async () => {
      if (!confirm(
        '确定要执行数据初始化吗？\n\n' +
        '此操作将:\n' +
        '• 将现有产品库存转换为初始入库交易记录\n' +
        '• 设置初始化日期为 2025-07-01\n' +
        '• 为月度账本提供正确的期初库存基础\n\n' +
        '注意: 此操作只应在首次使用系统或重新导入数据后执行一次！'
      )) {
        return
      }
      
      try {
        isInitializing.value = true
        initResult.value = null
        
        showToast('正在执行数据初始化，请稍候...', 'info')
        
        const response = await fetch('/api/init/initialize-stock', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            initDate: '2025-07-01 00:00:00',
            description: '系统初始化库存'
          })
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        initResult.value = result
        
        showToast(`数据初始化成功！处理了 ${result.processed_products} 个产品`, 'success')
        
        // 刷新初始化状态和其他相关数据
        await checkInitializationStatus()
        await inventoryStore.loadProducts()
        await inventoryStore.loadRecentTransactions()
        
      } catch (error) {
        console.error('数据初始化失败:', error)
        showToast('数据初始化失败: ' + error.message, 'error')
      } finally {
        isInitializing.value = false
      }
    }
    
    const recalculateStock = async () => {
      if (!confirm('确定要重新计算库存吗？\n\n此操作将重新计算所有产品的库存数量和价值。')) {
        return
      }
      
      try {
        isRecalculating.value = true
        
        showToast('正在重新计算库存...', 'info')
        
        const response = await fetch('/api/init/recalculate-stock', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        
        showToast(`库存重新计算完成！更新了 ${result.updated_products} 个产品`, 'success')
        
        // 刷新相关数据
        await inventoryStore.loadProducts()
        await checkInitializationStatus()
        
      } catch (error) {
        console.error('重新计算库存失败:', error)
        showToast('重新计算库存失败: ' + error.message, 'error')
      } finally {
        isRecalculating.value = false
      }
    }
    
    const formatDate = (dateString) => {
      const date = new Date(dateString)
      const timezone = settings.value.general.timezone === 'auto' 
        ? Intl.DateTimeFormat().resolvedOptions().timeZone 
        : settings.value.general.timezone
      
      return date.toLocaleString('zh-CN', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }
    
    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }
    
    const formatCurrency = (value) => {
      if (!value || isNaN(value)) return '0.0000'
      return parseFloat(value).toLocaleString('zh-CN', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
      })
    }
    
    const formatPrice = (value) => {
      if (!value || isNaN(value)) return '0'
      return parseFloat(value).toFixed(4).replace(/\.?0+$/, '')
    }
    
    // Load data on mount
    onMounted(() => {
      inventoryStore.loadInitialData()
      loadSettings()
      loadBackupHistory()
      loadSnapshotStats()
      checkInitializationStatus()
    })
    
    return {
      activeTab,
      newCategory,
      newProject,
      passwordForm,
      backupHistory,
      settings,
      settingsLoading,
      settingsTabs,
      categories,
      projects,
      systemInfo,
      importFileInput,
      importPreview,
      importProgress,
      getCategoryProductCount,
      getProjectUsageCount,
      addCategory,
      addProject,
      editCategory,
      editProject,
      deleteCategory,
      deleteProject,
      changePassword,
      createBackup,
      downloadBackup,
      restoreBackup,
      downloadBackupFile,
      deleteBackup,
      clearCache,
      resetSystem,
      saveAllSettings,
      resetToDefaults,
      loadSettings,
      loadBackupHistory,
      selectImportFile,
      handleFileImport,
      clearImportPreview,
      executeImport,
      downloadTemplate,
      exportProductsCSV,
      exportProductsJSON,
      exportProductsFullCSV,
      getImportStatusText,
      formatDate,
      formatFileSize,
      formatCurrency,
      formatPrice,
      // 快照相关方法
      snapshotStats,
      loadSnapshotStats,
      exportSnapshotData,
      cleanupOldSnapshots,
      createSnapshotBackup,
      generateCurrentSnapshot,
      // 价格修复功能
      isFixingPrices,
      priceFixResult,
      fixProductPrices,
      // 数据初始化功能
      initStatus,
      initResult,
      isCheckingInit,
      isInitializing,
      isRecalculating,
      checkInitializationStatus,
      initializeStockData,
      recalculateStock
    }
  }
}
</script>

<style scoped>
.settings-page {
  padding: 20px;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.settings-title h2 {
  margin: 0;
  color: #2d3748;
}

.settings-title p {
  margin: 4px 0 0 0;
  color: #718096;
}

.settings-actions {
  display: flex;
  gap: 12px;
}

.settings-navigation {
  display: flex;
  background: white;
  border-radius: 8px;
  padding: 8px;
  margin-bottom: 24px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow-x: auto;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.3s ease;
  font-size: 14px;
  color: #4a5568;
  white-space: nowrap;
}

.nav-tab.active {
  background: #3182ce;
  color: white;
}

.nav-tab:hover:not(.active) {
  background: #f1f5f9;
}

.settings-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.settings-section {
  padding: 24px;
}

.section-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.section-header h3 {
  margin: 0 0 4px 0;
  color: #2d3748;
}

.section-header p {
  margin: 0;
  color: #718096;
  font-size: 14px;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-weight: 500;
  color: #4a5568;
  font-size: 14px;
}

.form-control {
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
}

.form-control:focus {
  outline: none;
  border-color: #3182ce;
  box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
}

.checkbox-group {
  flex-direction: row;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}

.form-checkbox {
  width: 16px;
  height: 16px;
}

.input-group {
  display: flex;
  gap: 8px;
}

.input-group .form-control {
  flex: 1;
}

.category-management {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f7fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.category-info {
  flex: 1;
}

.category-name {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 4px;
}

.category-description {
  color: #718096;
  font-size: 14px;
  margin-bottom: 4px;
}

.category-count {
  color: #4a5568;
  font-size: 12px;
}

.category-actions {
  display: flex;
  gap: 8px;
}

/* Project Management Styles */
.project-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f0f8ff;
  border-radius: 8px;
  border: 1px solid #bee3f8;
}

.project-info {
  flex: 1;
}

.project-name {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 4px;
}

.project-description {
  color: #718096;
  font-size: 14px;
  margin-bottom: 4px;
}

.project-count {
  color: #4a5568;
  font-size: 12px;
}

.project-actions {
  display: flex;
  gap: 8px;
}

.password-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.backup-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.backup-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.backup-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.backup-history h4 {
  margin: 0 0 16px 0;
  color: #2d3748;
}

.backup-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.backup-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f7fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.backup-info {
  flex: 1;
}

.backup-name {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 4px;
}

.backup-date {
  color: #718096;
  font-size: 12px;
}

.backup-size {
  color: #4a5568;
  font-size: 12px;
}

.backup-actions {
  display: flex;
  gap: 8px;
}

.system-info {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.info-item {
  padding: 16px;
  background: #f7fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.info-label {
  font-size: 12px;
  color: #718096;
  margin-bottom: 4px;
}

.info-value {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
}

.system-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* Data Management Styles */
.data-management {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.data-import-section,
.data-export-section {
  padding: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f7fafc;
}

.data-import-section h4,
.data-export-section h4 {
  margin: 0 0 16px 0;
  color: #2d3748;
}

.import-actions,
.export-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* 大按钮样式 */
.btn-large {
  padding: 16px 24px;
  font-size: 16px;
  font-weight: 600;
  min-width: 160px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-large span {
  font-size: 18px;
}

.export-description {
  margin-top: 16px;
  padding: 12px;
  background-color: #f7fafc;
  border-radius: 8px;
  border-left: 4px solid #4299e1;
}

.export-description p {
  margin: 0;
  color: #4a5568;
  line-height: 1.6;
}

.import-info {
  margin-bottom: 16px;
}

.import-info p {
  margin: 4px 0;
  color: #4a5568;
  font-size: 14px;
}

.import-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.import-preview {
  margin-top: 20px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.import-preview h5 {
  margin: 0 0 12px 0;
  color: #2d3748;
}

.preview-table-container {
  overflow: auto;
  max-height: 400px;
  margin-bottom: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.preview-table th,
.preview-table td {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  text-align: left;
}

.preview-table th {
  background: #f7fafc;
  font-weight: 600;
  color: #2d3748;
}

.import-summary {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.summary-item {
  padding: 8px 12px;
  border-radius: 4px;
  background: #e2e8f0;
  font-size: 14px;
  font-weight: 500;
  color: #2d3748;
}

.summary-item.success {
  background: #c6f6d5;
  color: #2f855a;
}

.summary-item.warning {
  background: #feebc8;
  color: #c05621;
}

.summary-item.error {
  background: #fed7d7;
  color: #c53030;
}

.status-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.valid {
  background: #c6f6d5;
  color: #2f855a;
}

.status-badge.warning {
  background: #feebc8;
  color: #c05621;
}

.status-badge.error {
  background: #fed7d7;
  color: #c53030;
}

.status-badge.warning {
  background: #feebc8;
  color: #c05621;
}

.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
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

@media (max-width: 768px) {
  .settings-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .settings-navigation {
    flex-direction: column;
    gap: 8px;
  }
  
  .nav-tab {
    width: 100%;
    justify-content: center;
  }
  
  .input-group {
    flex-direction: column;
  }
  
  .backup-actions {
    flex-direction: column;
  }
  
  .system-actions {
    flex-direction: column;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .data-management {
    gap: 24px;
  }
  
  .import-actions,
  .export-actions {
    flex-direction: column;
  }
  
  .import-controls {
    flex-direction: column;
  }
  
  .import-summary {
    flex-direction: column;
    gap: 8px;
  }
}

/* 字段说明样式 */
.field-rules {
  margin-top: 12px;
  padding: 12px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
}

.field-rules ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
  list-style-type: disc;
}

.field-rules li {
  margin: 4px 0;
  font-size: 14px;
  line-height: 1.4;
}

.field-rules li strong {
  color: #2563eb;
  font-weight: 600;
}

/* 错误行样式 */
.error-row {
  background-color: #fff5f5 !important;
}

.error-message {
  color: #dc3545;
  font-size: 12px;
  margin-top: 4px;
  font-style: italic;
}

.preview-table {
  font-size: 13px;
}

.preview-table th {
  white-space: nowrap;
  padding: 8px 6px;
  font-size: 12px;
}

.preview-table td {
  padding: 8px 6px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

/* 快照管理样式 */
.snapshot-data-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
}

.snapshot-data-section h4 {
  color: var(--text-primary);
  margin-bottom: 15px;
}

.snapshot-info {
  background: var(--background-secondary);
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.snapshot-info p {
  color: var(--text-secondary);
  margin: 0;
  font-size: 14px;
}

.snapshot-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.snapshot-stats {
  background: var(--background-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  margin-top: 16px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
}

.stat-item:last-child {
  border-bottom: none;
}

.stat-label {
  color: var(--text-secondary);
  font-size: 14px;
  flex: 1;
}

.stat-value {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 14px;
  text-align: right;
  flex: 1;
}

/* Highlight the last generation time */
.stat-item:nth-child(4) .stat-label {
  color: #3182ce;
  font-weight: 500;
}

.stat-item:nth-child(4) .stat-value {
  color: #2b6cb0;
}

@media (max-width: 768px) {
  .snapshot-actions {
    flex-direction: column;
  }
  
  .snapshot-actions .btn {
    width: 100%;
  }
}

/* 价格修复功能样式 */
.price-fix-section {
  background: var(--background-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  margin-top: 16px;
}

.price-fix-button {
  display: flex;
  align-items: center;
  gap: 8px;
}

.price-fix-result {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 16px;
  margin-top: 16px;
}

.price-fix-result.success {
  background: #f0fff4;
  border-color: #68d391;
  color: #22543d;
}

.price-fix-result.error {
  background: #fed7d7;
  border-color: #fc8181;
  color: #742a2a;
}

.fix-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.fix-stat-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  font-size: 14px;
}

.fix-stat-label {
  color: var(--text-secondary);
}

.fix-stat-value {
  font-weight: 600;
  color: var(--text-primary);
}

/* Data initialization styles */
.data-initialization-section {
  margin-top: 24px;
  padding: 24px;
  background: #fafbfc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.data-initialization-section h3 {
  margin: 0 0 16px 0;
  color: #2d3748;
  font-size: 18px;
  font-weight: 600;
}

.initialization-status {
  margin-bottom: 20px;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  margin-bottom: 12px;
}

.status-card .icon {
  font-size: 16px;
}

.status-card.pending {
  border-color: #f6ad55;
  background: #fffbf0;
}

.status-card.initialized {
  border-color: #68d391;
  background: #f0fff4;
}

.status-card.error {
  border-color: #fc8181;
  background: #fff5f5;
}

.initialization-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.initialization-result {
  margin-top: 16px;
  padding: 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.result-summary {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.result-item {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
}

.result-item.success {
  background: #c6f6d5;
  color: #2f855a;
}

.result-item.info {
  background: #bee3f8;
  color: #2b6cb0;
}

.result-details {
  font-size: 14px;
  color: #4a5568;
  line-height: 1.5;
}
</style>
