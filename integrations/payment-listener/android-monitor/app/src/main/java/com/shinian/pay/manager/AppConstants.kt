package com.shinian.pay.manager

import com.shinian.pay.BuildConfig

/**
 * 全局常量管理（Kotlin 版，Java 调用点 `AppConstants.XXX` 保持不变）。
 */
object AppConstants {

    // 基础配置（@JvmField → Java 侧可直接读 AppConstants.DEBUG）
    @JvmField
    val DEBUG: Boolean = BuildConfig.DEBUG

    /** 用户主动退出标志：退出时置 true，防止守护服务自我复活 */
    @JvmField
    var IS_USER_EXIT: Boolean = false

    const val PACKAGE_NAME: String = "com.shinian.pay"

    // 请求码
    const val REQ_QR_CODE: Int = 11002          // 打开扫描界面请求码
    const val REQ_PERM_CAMERA: Int = 11003      // 打开摄像头
    const val REQ_PERM_EXTERNAL_STORAGE: Int = 11004 // 读写文件

    // Intent 参数
    const val INTENT_EXTRA_KEY_QR_SCAN: String = "qr_scan_result"

    // SharedPreferences 名称
    const val SP_NAME_CONFIG: String = "shinian"
    const val SP_NAME_LOGS: String = "items"

    // SharedPreferences Key
    const val SP_KEY_HOST: String = "host"
    const val SP_KEY_KEY: String = "key"
    const val SP_KEY_LOGS_STR: String = "logsStr"

    // 支付类型
    const val PAY_TYPE_WECHAT: Int = 1
    const val PAY_TYPE_ALIPAY: Int = 2

    // 通知渠道 ID
    const val NOTIFICATION_CHANNEL_ID: String = "1"

    // 心跳间隔 (毫秒)
    const val HEARTBEAT_INTERVAL: Long = 30 * 1000

    // 回调补单延迟 (毫秒)
    const val CALLBACK_RETRY_DELAY: Long = 1000

    // 日志最大条数
    const val MAX_LOG_ENTRIES: Int = 20
}