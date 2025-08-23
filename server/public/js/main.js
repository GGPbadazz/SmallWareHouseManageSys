class InventoryApp {
    constructor() {
        this.currentPage = 'search';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDashboardStats();
        this.loadRecentTransactions();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchPage(e.target.dataset.page);
            });
        });

        // Search functionality
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.searchProducts();
        });

        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchProducts();
            }
        });

        // Stock operations
        document.getElementById('stockInBtn').addEventListener('click', () => {
            this.showStockInDialog();
        });

        document.getElementById('stockOutBtn').addEventListener('click', () => {
            this.showStockOutDialog();
        });

        // Generate barcode
        document.getElementById('generateBtn').addEventListener('click', () => {
            this.generateBarcode();
        });
    }

    async loadDashboardStats() {
        try {
            const response = await fetch('/api/products/stats');
            const stats = await response.json();
            
            document.getElementById('totalProducts').textContent = stats.totalProducts || 0;
            document.getElementById('lowStock').textContent = stats.lowStockItems || 0;
            document.getElementById('todayTransactions').textContent = stats.todayTransactions || 0;
            document.getElementById('totalValue').textContent = `¥${stats.totalValue?.toLocaleString() || 0}`;
        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
        }
    }

    async loadRecentTransactions() {
        try {
            const response = await fetch('/api/transactions/recent');
            const transactions = await response.json();
            
            const container = document.getElementById('transactionsList');
            container.innerHTML = transactions.map(transaction => `
                <div class="transaction-item">
                    <div>
                        <strong>${transaction.product_name}</strong>
                        <div class="transaction-meta">${transaction.created_at}</div>
                    </div>
                    <div class="transaction-status ${transaction.type.toLowerCase()}">
                        ${transaction.type}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load recent transactions:', error);
        }
    }

    async searchProducts() {
        const searchTerm = document.getElementById('searchInput').value.trim();
        if (!searchTerm) return;

        try {
            const response = await fetch(`/api/products/search?q=${encodeURIComponent(searchTerm)}`);
            const products = await response.json();
            
            this.displaySearchResults(products);
        } catch (error) {
            console.error('Search failed:', error);
        }
    }

    displaySearchResults(products) {
        const container = document.querySelector('.product-info-panel');
        const emptyState = container.querySelector('.empty-state');
        const detailsDiv = container.querySelector('.product-details');

        if (products.length === 0) {
            emptyState.style.display = 'block';
            detailsDiv.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        detailsDiv.style.display = 'block';
        
        detailsDiv.innerHTML = products.map(product => `
            <div class="product-item">
                <h4>${product.name}</h4>
                <p><strong>条码:</strong> ${product.barcode}</p>
                <p><strong>类别:</strong> ${product.category}</p>
                <p><strong>库存:</strong> ${product.stock_quantity}</p>
                <p><strong>价格:</strong> ¥${product.price}</p>
                <div class="product-actions">
                    <button class="btn btn-primary btn-sm" onclick="app.stockIn('${product.id}')">入库</button>
                    <button class="btn btn-secondary btn-sm" onclick="app.stockOut('${product.id}')">出库</button>
                </div>
            </div>
        `).join('');
    }

    switchPage(page) {
        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`).classList.add('active');

        // Handle page switching logic
        switch(page) {
            case 'search':
                // Already on search page
                break;
            case 'inventory':
                window.location.href = '/inventory';
                break;
            case 'reports':
                window.location.href = '/reports';
                break;
            case 'settings':
                window.location.href = '/settings';
                break;
        }
    }

    showStockInDialog() {
        // Implementation for stock in dialog
        const quantity = prompt('请输入入库数量:');
        if (quantity && !isNaN(quantity)) {
            // Call stock in API
            this.performStockOperation('in', parseInt(quantity));
        }
    }

    showStockOutDialog() {
        // Implementation for stock out dialog
        const quantity = prompt('请输入出库数量:');
        if (quantity && !isNaN(quantity)) {
            // Call stock out API
            this.performStockOperation('out', parseInt(quantity));
        }
    }

    async performStockOperation(type, quantity) {
        try {
            const response = await fetch('/api/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: type,
                    quantity: quantity,
                    // Add other required fields
                })
            });

            if (response.ok) {
                alert(`${type === 'in' ? '入库' : '出库'}操作成功！`);
                this.loadDashboardStats();
                this.loadRecentTransactions();
            } else {
                alert('操作失败，请重试');
            }
        } catch (error) {
            console.error('Stock operation failed:', error);
            alert('操作失败，请重试');
        }
    }

    generateBarcode() {
        // Implementation for barcode generation
        window.open('/barcode-generator', '_blank');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new InventoryApp();
});
