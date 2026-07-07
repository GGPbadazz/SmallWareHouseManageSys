const cron = require('node-cron');
const { generateMonthlySnapshot } = require('../scripts/generate-monthly-snapshot');

/**
 * 启动月度快照自动生成定时任务
 */
const scheduleMonthlySnapshot = () => {
    // 每月1日凌晨2点自动生成上月快照
    // Cron表达式: 秒 分 时 日 月 周
    // '0 2 1 * *' = 每月1日凌晨2点0分0秒
    const cronJob = cron.schedule('0 2 1 * *', async () => {
        try {
            const now = new Date();
            
            // 计算上个月的年份和月份
            const lastMonth = now.getMonth(); // getMonth()返回0-11，正好是上月
            const year = lastMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
            const month = lastMonth === 0 ? 12 : lastMonth;
            
            console.log(`\n🕐 定时任务触发: ${new Date().toLocaleString()}`);
            console.log(`📸 开始自动生成 ${year}年${month}月 的库存快照`);
            
            const result = await generateMonthlySnapshot(year, month);
            
            if (result.success) {
                console.log(`✅ 定时快照生成成功: ${result.message}`);
                
                // 这里可以发送成功通知（邮件、微信等）
                // await sendSuccessNotification(year, month, result.count);
            } else {
                console.error(`❌ 定时快照生成失败: ${result.message}`);
                
                // 这里可以发送失败通知给管理员
                // await sendFailureNotification(year, month, result.message);
            }
            
        } catch (error) {
            console.error('❌ 定时快照生成异常:', error);
            
            // 发送异常通知
            // await sendErrorNotification(error);
        }
    }, {
        scheduled: false, // 初始不启动，手动启动
        timezone: "Asia/Shanghai"
    });
    
    // 手动启动定时任务
    cronJob.start();
    console.log('📅 月度快照定时任务已启动');
    console.log('⏰ 执行时间: 每月1日凌晨2:00 (Asia/Shanghai)');
    console.log('🎯 任务内容: 自动生成上月库存快照');
    
    return cronJob;
};

/**
 * 停止定时任务
 */
const stopScheduledTask = (cronJob) => {
    if (cronJob) {
        cronJob.stop();
        console.log('⏹️ 月度快照定时任务已停止');
    }
};

/**
 * 手动生成快照（用于API调用）
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @returns {Promise<{success: boolean, message: string, count: number}>}
 */
const manualGenerateSnapshot = async (year, month) => {
    try {
        console.log(`🖱️ 手动触发: 生成 ${year}年${month}月 快照`);
        
        const result = await generateMonthlySnapshot(year, month);
        
        if (result.success) {
            console.log(`✅ 手动快照生成成功: ${result.message}`);
        } else {
            console.log(`❌ 手动快照生成失败: ${result.message}`);
        }
        
        return result;
        
    } catch (error) {
        console.error(`❌ 手动快照生成异常:`, error);
        return { 
            success: false, 
            message: `快照生成异常: ${error.message}`, 
            count: 0 
        };
    }
};

/**
 * 测试定时任务（立即执行一次，用于测试）
 */
const testScheduledTask = async () => {
    console.log('🧪 测试模式: 立即执行快照生成任务');
    
    const now = new Date();
    const lastMonth = now.getMonth();
    const year = lastMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = lastMonth === 0 ? 12 : lastMonth;
    
    console.log(`📸 生成 ${year}年${month}月 的快照（测试）`);
    
    const result = await manualGenerateSnapshot(year, month);
    return result;
};

/**
 * 获取定时任务状态
 */
const getScheduleStatus = (cronJob) => {
    if (!cronJob) {
        return { 
            scheduled: false, 
            status: '未启动',
            nextExecution: null 
        };
    }
    
    return {
        scheduled: cronJob.scheduled,
        status: cronJob.scheduled ? '运行中' : '已停止',
        nextExecution: cronJob.scheduled ? '每月1日凌晨2:00' : null,
        timezone: 'Asia/Shanghai'
    };
};

// 如果直接运行此脚本，进行测试
if (require.main === module) {
    console.log('🧪 定时任务系统测试模式');
    
    // 测试立即执行
    testScheduledTask().then(result => {
        console.log('测试结果:', result);
        
        // 测试启动定时任务（但立即停止，避免真的定时执行）
        console.log('\n测试定时任务启动...');
        const job = scheduleMonthlySnapshot();
        
        setTimeout(() => {
            console.log('\n测试定时任务状态...');
            console.log(getScheduleStatus(job));
            
            console.log('\n停止定时任务...');
            stopScheduledTask(job);
            
            process.exit(0);
        }, 2000);
        
    }).catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });
}

module.exports = {
    scheduleMonthlySnapshot,
    stopScheduledTask,
    manualGenerateSnapshot,
    testScheduledTask,
    getScheduleStatus
};
