package com.shinian.pay.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import java.util.Arrays;
import java.util.Collection;

/**
 * 通知解析逻辑的 JVM 单元测试（微信 / 支付宝各类通知文案用例集）。
 *
 * 被测对象是 {@link PayNotificationListenerService#getMoney(String)} ——
 * 收款金额提取的核心纯函数（内部依赖 MONEY_PATTERN + isValidNumber，
 * 全部为 Java 纯逻辑、无 Android 依赖，可在本地 JVM 直接运行）。
 *
 * 该测试的目的是保证收款文案解析的稳健性：一旦解析出错就会直接掉单，
 * 因此把「常见收款文案 → 应提取到的金额」固化为用例，防止回归。
 *
 * 说明：
 * - getMoney 的语义是「从包含关键词(收款/付款/到账/转入)处开始，
 *   取第一个合法金额(0.01 ~ 999999.99)」。
 * - 测试不触发任何 Android / 网络 / Toast 逻辑，仅验证字符串解析。
 */
@RunWith(Parameterized.class)
public class PayNotificationParserTest {

    private final String input;
    private final String expected;

    public PayNotificationParserTest(String input, String expected) {
        this.input = input;
        this.expected = expected;
    }

    @Parameterized.Parameters(name = "{index}: {0} -> {1}")
    public static Collection<Object[]> data() {
        return Arrays.asList(new Object[][] {
            // ===== 微信典型文案 =====
            {"收到 12.50 元转账", "12.50"},
            {"微信收款 88.00 元已入账", "88.00"},
            {"对外收款到账 300 元", "300"},
            {"收到货款 1099.99 元", "1099.99"},
            {"你已收到 0.1 元", "0.1"},
            {"收款成功 ¥58.80", "58.80"},
            {"付款成功 20 元", "20"},

            // ===== 支付宝典型文案 =====
            {"成功收款 66.66 元", "66.66"},
            {"已转入余额 150 元", "150"},
            {"通过扫码向你付款 32.5 元", "32.5"},
            {"支付宝成功收款 999.99 元", "999.99"},
            {"店员通 收款 21.00 元", "21.00"},

            // ===== 边界 / 易错用例 =====
            // 关键词前的数字应被忽略（"2024年收款 50 元" 取 50 而非 2024）
            {"2024年收款 50 元", "50"},
            // 多个数字，取关键词后第一个合法金额（getMoney 取第一个，故为 "1"）
            {"收款 1 笔 金额 100.00 元 订单号 2", "1"},
            // 超过上限 999999.99 的金额应被过滤（返回后续合法金额）
            {"收款 1000000 元 实付 80 元", "80"},
            // 0 与 0.00 不在 [0.01, ...] 区间内，返回 null
            {"收款 0 元", null},
            {"收款 0.00 元", null},
            // 无关键词：直接从整句提取第一个合法金额
            {"转账 3000 元", "3000"},
            // 空字符串
            {"", null},
        });
    }

    @Test
    public void testGetMoney() {
        String actual = PayNotificationListenerService.getMoney(input);
        assertEquals("输入文案: " + input, expected, actual);
    }

    /** null 输入应返回 null（getMoney 内部已做空值判断）。 */
    @Test
    public void testGetMoneyNull() {
        assertNull(PayNotificationListenerService.getMoney(null));
    }

    /** 金额提取结果是可解析的合法 double（非空用例的健全性校验）。 */
    @Test
    public void testGetMoneyResultIsParseable() {
        if (expected == null) {
            return;
        }
        String actual = PayNotificationListenerService.getMoney(input);
        assertTrue("结果应为可解析金额: " + actual, actual != null);
        double parsed = Double.parseDouble(actual);
        assertTrue(parsed >= 0.01 && parsed <= 999999.99);
    }
}
