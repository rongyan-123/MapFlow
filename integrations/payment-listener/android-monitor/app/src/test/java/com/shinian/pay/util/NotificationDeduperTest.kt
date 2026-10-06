package com.shinian.pay.util

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * [NotificationDeduper] 单元测试。
 *
 * 该逻辑直接决定「同一笔收款是否被重复回调服务端」——
 * 误判会导致重复入账，漏判会导致掉单，因此对边界做重点覆盖。
 */
class NotificationDeduperTest {

    private val key = "0|com.tencent.mm|1|null|10086"
    private val fp = "com.tencent.mm|微信支付|微信支付收款1.80元"

    @Test
    fun firstOccurrenceIsNotDuplicate() {
        val d = NotificationDeduper()
        assertFalse(d.isDuplicate(key, fp, 1_000L))
    }

    @Test
    fun sameNotificationWithinWindowIsDuplicate() {
        val d = NotificationDeduper()
        assertFalse(d.isDuplicate(key, fp, 1_000L))
        // 2 秒后同一通知再次回调 → 判为重复
        assertTrue(d.isDuplicate(key, fp, 3_000L))
    }

    @Test
    fun sameNotificationAfterWindowIsNotDuplicate() {
        val d = NotificationDeduper()
        assertFalse(d.isDuplicate(key, fp, 1_000L))
        // 超过 10 秒窗口 → 视为新的一笔
        assertFalse(d.isDuplicate(key, fp, 12_000L))
    }

    @Test
    fun differentContentIsNotDuplicate() {
        val d = NotificationDeduper()
        assertFalse(d.isDuplicate(key, fp, 1_000L))
        // 同一 key 但金额不同（真实的第二笔收款）→ 不应被误杀
        val fp2 = "com.tencent.mm|微信支付|微信支付收款2.00元"
        assertFalse(d.isDuplicate(key, fp2, 2_000L))
    }

    @Test
    fun differentKeySameContentIsNotDuplicate() {
        val d = NotificationDeduper()
        assertFalse(d.isDuplicate(key, fp, 1_000L))
        // 不同通知（不同 key）即使文案相同也不应误杀
        assertFalse(d.isDuplicate("another-key", fp, 2_000L))
    }

    @Test
    fun windowBoundaryIsExclusive() {
        val d = NotificationDeduper(windowMs = 5_000L)
        assertFalse(d.isDuplicate(key, fp, 1_000L))
        // 恰好等于窗口边界 → 不算重复（now - last < windowMs 为 false）
        assertFalse(d.isDuplicate(key, fp, 6_000L))
        // 窗口内 → 重复
        assertTrue(d.isDuplicate(key, fp, 6_500L))
    }

    @Test
    fun doesNotGrowUnbounded() {
        val d = NotificationDeduper(windowMs = 1_000L, maxEntries = 8)
        // 写入远超上限的条目，且时间不断推进（使旧记录过期）
        for (i in 0 until 200) {
            d.isDuplicate("k$i", "fp$i", i * 100L)
        }
        // 不应抛异常且后续仍能正常工作
        assertFalse(d.isDuplicate("fresh", "freshFp", 1_000_000L))
    }

    @Test
    fun clearResetsState() {
        val d = NotificationDeduper()
        assertFalse(d.isDuplicate(key, fp, 1_000L))
        d.clear()
        // 清空后同一通知应重新视为首次
        assertFalse(d.isDuplicate(key, fp, 2_000L))
    }
}