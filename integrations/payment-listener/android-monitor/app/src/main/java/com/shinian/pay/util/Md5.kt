package com.shinian.pay.util

import java.security.MessageDigest
import java.security.NoSuchAlgorithmException

/**
 * MD5 工具类。
 *
 * 说明：原实现在 `PayNotificationListenerService` 与 `MainActivity` 中**各有一份逐字符相同**的
 * 私有实现，签名（`md5(t + key)` 等）逻辑存在分叉风险，这里统一为单一来源。
 *
 * ⚠️ MD5 在此仅用于与服务端约定的**请求签名**（防篡改/防重放），
 * 不属于密码存储场景，因此沿用 MD5 算法以保持与服务端的兼容性。
 */
object Md5 {

    /**
     * 计算字符串的 MD5 十六进制摘要（小写，定长 32 位）。
     *
     * @param input 待摘要字符串；null 或空串返回空串（与原实现行为一致）
     * @return 32 位小写十六进制字符串；算法不可用时返回空串
     */
    @JvmStatic
    fun hex(input: String?): String {
        if (input.isNullOrEmpty()) {
            return ""
        }
        return try {
            val digest = MessageDigest.getInstance("MD5")
            val bytes = digest.digest(input!!.toByteArray())
            val sb = StringBuilder(bytes.size * 2)
            for (b in bytes) {
                val v = b.toInt() and 0xff
                if (v < 0x10) sb.append('0')
                sb.append(Integer.toHexString(v))
            }
            sb.toString()
        } catch (e: NoSuchAlgorithmException) {
            e.printStackTrace()
            ""
        }
    }
}
