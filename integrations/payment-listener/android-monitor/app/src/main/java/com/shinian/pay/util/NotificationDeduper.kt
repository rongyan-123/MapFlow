package com.shinian.pay.util

/**
 * 通知去重器。
 *
 * 背景：微信 / 支付宝在收款后会对**同一条通知**多次更新（弹出动画、内容补充等），
 * 每次更新系统都会回调 `NotificationListenerService.onNotificationPosted`，
 * 导致同一笔收款被重复回调服务端（实测日志中出现两条完全相同的"收款成功"记录，
 * 服务端会重复入账）。
 *
 * 去重策略（双重判定，避免误杀真实的多笔收款）：
 *  1. **内容指纹相同** —— 同一笔收款的文案不会变化；
 *  2. **落在时间窗内** —— 重复通知通常在数秒内到达。
 * 两个条件同时满足才判定为重复。
 *
 * 线程安全：内部使用 `synchronized`，可被多线程（系统回调线程）并发调用。
 *
 * 该逻辑与 Android 框架解耦，便于 JVM 单元测试。
 */
class NotificationDeduper(
    /** 去重时间窗（毫秒） */
    private val windowMs: Long = DEFAULT_WINDOW_MS,
    /** 记录上限，超过后触发惰性清理，防止无限增长 */
    private val maxEntries: Int = DEFAULT_MAX_ENTRIES
) {

    /** 指纹 -> 最近处理时间戳 */
    private val seen = HashMap<String, Long>()

    /**
     * 判断并登记一条通知。
     *
     * @param key 通知唯一标识（如 `StatusBarNotification.key`）
     * @param fingerprint 内容指纹（如 `包名|标题|正文`）
     * @param now 当前时间戳（毫秒），显式传入以便测试
     * @return true = 属于重复通知，调用方应忽略；false = 首次出现，调用方应处理
     */
    fun isDuplicate(key: String, fingerprint: String, now: Long = System.currentTimeMillis()): Boolean {
        synchronized(seen) {
            val dedupKey = "$key|$fingerprint"

            // 惰性清理：超过上限时移除已过期记录
            if (seen.size >= maxEntries) {
                val expireBefore = now - windowMs
                val it = seen.entries.iterator()
                while (it.hasNext()) {
                    if (it.next().value < expireBefore) it.remove()
                }
                // 清理后仍超限（极端情况），清空避免内存持续增长
                if (seen.size >= maxEntries) seen.clear()
            }

            val last = seen[dedupKey]
            if (last != null && now - last < windowMs) {
                return true
            }
            seen[dedupKey] = now
            return false
        }
    }

    /** 清空全部记录（服务销毁时调用） */
    fun clear() {
        synchronized(seen) {
            seen.clear()
        }
    }

    companion object {
        /**
         * 默认去重时间窗。
         *
         * 取 10 秒：同一笔收款的重复通知通常在数秒内到达；
         * 真实的多笔同金额收款间隔一般大于该值，避免误杀。
         */
        const val DEFAULT_WINDOW_MS = 10_000L

        /** 默认记录上限 */
        const val DEFAULT_MAX_ENTRIES = 64
    }
}