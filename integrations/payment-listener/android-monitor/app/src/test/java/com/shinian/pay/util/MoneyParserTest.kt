package com.shinian.pay.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * MoneyParser（Kotlin 抽取后的金额解析器）单元测试。
 *
 * 与 Java 版 PayNotificationParserTest 互补：那边覆盖业务文案，
 * 这边聚焦抽取后的解析器自身边界（格式校验 + 关键词起点语义）。
 */
class MoneyParserTest {

    @Test
    fun isValidNumberAcceptsPlainAndDecimal() {
        assertTrue(MoneyParser.isValidNumber("1"))
        assertTrue(MoneyParser.isValidNumber("12.50"))
        assertTrue(MoneyParser.isValidNumber("0.01"))
        assertTrue(MoneyParser.isValidNumber("999999.99"))
    }

    @Test
    fun isValidNumberRejectsMalformed() {
        assertFalse(MoneyParser.isValidNumber(null))
        assertFalse(MoneyParser.isValidNumber(""))
        assertFalse(MoneyParser.isValidNumber(".5"))
        assertFalse(MoneyParser.isValidNumber("5."))
        assertFalse(MoneyParser.isValidNumber("1.2.3"))
        assertFalse(MoneyParser.isValidNumber("12a"))
        assertFalse(MoneyParser.isValidNumber("-5"))
    }

    @Test
    fun getMoneyTakesFirstValidAmountAfterKeyword() {
        // 关键词前数字被忽略
        assertEquals("50", MoneyParser.getMoney("2024年收款 50 元"))
        // 关键词后第一个合法金额
        assertEquals("100.00", MoneyParser.getMoney("收款 100.00 元"))
    }

    @Test
    fun getMoneyFallsBackToWholeStringWhenNoKeyword() {
        assertEquals("3000", MoneyParser.getMoney("转账 3000 元"))
    }

    @Test
    fun getMoneyReturnsNullForEmptyOrZero() {
        assertNull(MoneyParser.getMoney(null))
        assertNull(MoneyParser.getMoney(""))
        assertNull(MoneyParser.getMoney("收款 0 元"))
        assertNull(MoneyParser.getMoney("收款 0.00 元"))
    }

    @Test
    fun getMoneySkipsAmountAboveUpperBound() {
        // 超过 999999.99 被过滤，返回后续合法金额
        assertEquals("80", MoneyParser.getMoney("收款 1000000 元 实付 80 元"))
    }
}