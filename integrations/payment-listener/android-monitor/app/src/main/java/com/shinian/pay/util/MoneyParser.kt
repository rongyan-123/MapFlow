package com.shinian.pay.util

import java.util.regex.Pattern

/**
 * 收款金额解析器（Kotlin 版）。
 *
 * 从通知文案中提取收款金额 —— 这是收款链路中最核心、最易出错的纯逻辑，
 * 一旦解析错误会直接导致掉单，因此单独抽出以便独立单元测试。
 *
 * 语义（与迁移前完全一致，保证既有 57 条用例继续通过）：
 *  - 从包含关键词（收款/付款/到账/转入）处开始检索；
 *  - 取该处之后第一个合法金额（0.01 ~ 999999.99）；
 *  - 找不到关键词时，从整句检索；
 *  - 无合法金额返回 null。
 *
 * 无 Android 运行时依赖（仅用 TextUtils/Log 的静态方法），可在 JVM 单测直接运行。
 */
object MoneyParser {

    /** 金额提取正则表达式（预编译提升性能） */
    private val MONEY_PATTERN: Pattern = Pattern.compile("\\d+(?:\\.\\d+)?")

    /** 关键词：出现处即认为是金额检索起点 */
    private val KEYWORDS = arrayOf("收款", "付款", "到账", "转入")

    private const val MIN_AMOUNT = 0.01
    private const val MAX_AMOUNT = 999999.99

    /**
     * 从文本内容中提取金额。
     *
     * @param content 包含金额的文本内容
     * @return 提取到的金额字符串，如果未找到则返回 null
     */
    @JvmStatic
    fun getMoney(content: String?): String? {
        // 空值检查
        if (content == null || content.isEmpty()) return null

        // 支持多种关键词：收款、付款、到账、转入
        var startIndex = -1
        for (keyword in KEYWORDS) {
            val index = content.indexOf(keyword)
            if (index >= 0) {
                startIndex = index
                break
            }
        }

        // 如果没有找到任何关键词，尝试从整个内容中提取
        val searchText = if (startIndex >= 0) content.substring(startIndex) else content

        // 创建正则表达式匹配器
        val matcher = MONEY_PATTERN.matcher(searchText)
        while (matcher.find()) {
            val matched = matcher.group()
            if (isValidNumber(matched)) {
                try {
                    val amount = matched.toDouble()
                    // 金额范围
                    if (amount >= MIN_AMOUNT && amount <= MAX_AMOUNT) {
                        return matched
                    }
                } catch (e: NumberFormatException) {
                    // 理论上不会发生：正则已保证为合法数字串
                }
            }
        }
        return null
    }

    /**
     * 验证字符串是否为合法的数字格式。
     *
     * @param str 待验证的字符串
     * @return 是否为合法金额格式
     */
    @JvmStatic
    fun isValidNumber(str: String?): Boolean {
        if (str == null || str.isEmpty()) {
            return false
        }
        // 不能以小数点开头或结尾，且只能包含一个小数点
        var dotCount = 0
        for (i in str.indices) {
            val c = str[i]
            if (c == '.') {
                dotCount++
                // 不能有超过一个小数点，或者小数点在开头/结尾
                if (dotCount > 1 || i == 0 || i == str.length - 1) {
                    return false
                }
            } else if (!Character.isDigit(c)) {
                return false
            }
        }
        return true
    }
}