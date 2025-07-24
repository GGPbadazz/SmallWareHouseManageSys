<template>
  <div class="welcome-container">
    <div class="card">
      <div class="card-header">
        <div class="card-title">欢迎使用备品备件管理系统</div>
        <div class="card-subtitle">Spare Parts Management System</div>
      </div>
      <div class="card-body">
        <div class="welcome-content">
          <div class="welcome-icon">🏭</div>
          <div class="welcome-text">系统已准备就绪</div>
          <div class="welcome-subtext">请使用顶部导航切换到不同功能页面</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Home'
}
</script>

<style scoped>
.welcome-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
}

.welcome-content {
  text-align: center;
  padding: var(--spacing-2xl);
}

.welcome-icon {
  font-size: 4rem;
  margin-bottom: var(--spacing-lg);
  opacity: 0.8;
}

.welcome-text {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: var(--spacing-md);
  color: var(--text-primary);
}

.welcome-subtext {
  font-size: 1rem;
  color: var(--text-secondary);
}
</style>
