<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>系统管理员登录</h1>
        <p>条码管理系统</p>
      </div>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <input 
            id="username"
            type="text" 
            v-model="loginForm.username"
            class="form-control"
            placeholder="请输入用户名"
            autocomplete="username"
            required
          >
        </div>
        
        <div class="form-group">
          <label for="password">密码</label>
          <input 
            id="password"
            type="password" 
            v-model="loginForm.password"
            class="form-control"
            placeholder="请输入密码"
            autocomplete="current-password"
            required
          >
        </div>
        
        <button 
          type="submit" 
          class="btn btn-primary btn-block"
          :disabled="loading"
        >
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>
      
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authAPI } from '@/services/api'

export default {
  name: 'LoginPage',
  setup() {
    const router = useRouter()
    
    const loginForm = ref({
      username: '',
      password: ''
    })
    
    const loading = ref(false)
    const error = ref('')
    
    const handleLogin = async () => {
      if (!loginForm.value.username || !loginForm.value.password) {
        error.value = '请输入用户名和密码'
        return
      }
      
      loading.value = true
      error.value = ''
      
      try {
        const response = await authAPI.login(loginForm.value)
        
        if (response.data.token) {
          // 保存token到localStorage
          localStorage.setItem('auth_token', response.data.token)
          
          // 跳转到首页
          router.push('/')
        } else {
          error.value = '登录失败，请重试'
        }
      } catch (err) {
        console.error('Login error:', err)
        if (err.response?.status === 401) {
          error.value = '用户名或密码错误'
        } else {
          error.value = '登录失败，请重试'
        }
      } finally {
        loading.value = false
      }
    }
    
    return {
      loginForm,
      loading,
      error,
      handleLogin
    }
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 12px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-header h1 {
  color: #2d3748;
  font-size: 24px;
  margin: 0 0 8px 0;
}

.login-header p {
  color: #718096;
  font-size: 14px;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 8px;
  color: #2d3748;
  font-weight: 500;
  font-size: 14px;
}

.form-control {
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.form-control:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5a67d8;
}

.btn-primary:disabled {
  background: #a0aec0;
  cursor: not-allowed;
}

.btn-block {
  width: 100%;
}

.error-message {
  margin-top: 16px;
  padding: 12px;
  background: #fed7d7;
  border: 1px solid #feb2b2;
  border-radius: 8px;
  color: #c53030;
  font-size: 14px;
  text-align: center;
}
</style>
