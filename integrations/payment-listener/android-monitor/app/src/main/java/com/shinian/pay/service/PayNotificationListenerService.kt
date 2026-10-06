package com.shinian.pay.service

import android.annotation.SuppressLint
import android.app.Notification
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.os.PowerManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.text.TextUtils
import android.util.Log
import android.widget.Toast
import androidx.core.app.NotificationCompat
import com.shinian.pay.ui.MainActivity
import com.shinian.pay.util.ChannelManager
import com.shinian.pay.util.Md5
import com.shinian.pay.util.MoneyParser
import com.shinian.pay.util.NetworkClient
import com.shinian.pay.util.PaymentPushRequest
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Response

/**
 * 收款通知监听服务（Kotlin 版）。
 *
 * 收款链路核心：监听微信 / 支付宝收款通知 → 解析金额 → 回调服务端。
 * 保持与 Java 版完全一致的外部行为（含静态 getMoney / md5 供既有调用点与单测使用）。
 */
class PayNotificationListenerService : NotificationListenerService() {

    private var host = ""
    private var key = ""
    private var newThread: Thread? = null
    private var mWakeLock: PowerManager.WakeLock? = null
    private var mainHandler: Handler? = null

    /**
     * 收款通知去重器（见 [com.shinian.pay.util.NotificationDeduper]）。
     *
     * 微信/支付宝收到款后会对**同一条通知**多次更新，每次都回调 `onNotificationPosted`，
     * 若不去重会重复回调服务端造成重复入账（用户实测日志中出现两条相同记录）。
     */
    private val deduper = com.shinian.pay.util.NotificationDeduper()

    /** 上次打印"监听服务开启成功"的时间戳（用于 onListenerConnected 重入去重） */
    @Volatile
    private var lastConnectedLogAt = 0L

    /** 获取主线程 Handler（懒初始化） */
    private fun mainHandler(): Handler {
        var h = mainHandler
        if (h == null) {
            h = Handler(Looper.getMainLooper())
            mainHandler = h
        }
        return h
    }

    // 释放设备电源锁
    fun releaseWakeLock() {
        mWakeLock?.release()
        mWakeLock = null
    }

    // 心跳进程
    fun initAppHeart() {
        Log.d(TAG, "开始启动心跳线程")

        // 防止重复启动
        if (newThread != null) {
            return
        }
        // 申请设备电源锁
        acquireWakeLock(this)

        newThread = Thread {
            Log.d(TAG, "心跳线程启动！")
            while (true) {
                try {
                    val read = getSharedPreferences("shinian", MODE_PRIVATE)
                    host = read.getString("host", "") ?: ""
                    key = read.getString("key", "") ?: ""

                    val t = System.currentTimeMillis().toString()
                    // 双通道：自动解析当前最可用 host+key（主/备故障自动切换，见 ChannelManager）
                    val ch = ChannelManager.resolve(this)
                    var activeHost = ch[0]
                    var activeKey = ch[1]
                    if (activeHost.isEmpty()) activeHost = host
                    if (activeKey.isEmpty()) activeKey = key
                    val sign = md5(t + activeKey)

                    // 使用统一网络客户端：https/http 交替重试 + 跟随308重定向 + DoH加密DNS
                    // 解决移动网络下连接被间歇重置导致心跳一直失败的问题
                    if (host.isNotEmpty()) {
                        val path = "/appHeart?t=$t&sign=$sign"
                        NetworkClient.getWithRetry(activeHost, path, object : Callback {
                            override fun onFailure(call: Call, e: java.io.IOException) {
                                val error = e.message ?: "未知错误"
                                // 失败记账：主通道连续失败达阈值且有备用 → 自动切备用
                                ChannelManager.recordMainFailure(this@PayNotificationListenerService)
                                mainHandler().post {
                                    if (MainActivity.LogsTextView != null &&
                                        !MainActivity.LogsTextView!!.text.toString().contains("心跳状态错误")
                                    ) {
                                        // 发送监听日志
                                        sendMonitorLogs(
                                            now() + "\r\r\r\r" +
                                                "心跳状态错误，请重新配置或切换网络环境!\n错误详情：$error"
                                        )
                                        Toast.makeText(
                                            applicationContext,
                                            "心跳状态错误，请重新配置或切换网络!",
                                            Toast.LENGTH_SHORT
                                        ).show()
                                    }
                                }
                            }

                            override fun onResponse(call: Call, response: Response) {
                                // 成功记账：主通道健康恢复阈值后自动回切
                                ChannelManager.recordMainSuccess(this@PayNotificationListenerService)
                                Log.d(TAG, "onResponse heard: " + response.body?.string())
                            }
                        })
                    }

                    Thread.sleep(50 * 1000)
                } catch (e: InterruptedException) {
                    // 线程被中断（服务销毁），正常退出心跳循环
                    Log.d(TAG, "心跳线程被中断，退出")
                    return@Thread
                } catch (e: Exception) {
                    // 关键保护：任何异常（SharedPreferences IO、网络初始化等）都不能杀死心跳循环
                    Log.e(TAG, "心跳循环异常(已忽略，继续下一轮): ${e.message}")
                }
            }
        }
        newThread!!.start()
    }

    /**
     * 当收到一条消息的时候回调，sbn 即收到的消息
     */
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        // 获取配置（只在需要时读取）
        val read = getSharedPreferences("shinian", MODE_PRIVATE)
        host = read.getString("host", "") ?: ""
        key = read.getString("key", "") ?: ""

        // 获取通知对象和包名（只获取一次）
        val notification = sbn.notification ?: return
        val pkg = sbn.packageName

        val extras = notification.extras ?: return

        val title = extras.getString(NotificationCompat.EXTRA_TITLE, "") ?: ""
        val content = extras.getString(NotificationCompat.EXTRA_TEXT, "") ?: ""
        Log.d(TAG, "包名: $pkg")

        // ===== 收款去重 =====
        // 仅对支付类应用去重（自身测试通知不需要）。
        // 微信/支付宝收到款后会对同一通知多次更新，每次都回调本方法，
        // 若不去重会重复回调服务端造成重复入账。
        if (pkg == PACKAGE_WECHAT || pkg == PACKAGE_WECHAT_WORK || pkg == PACKAGE_ALIPAY) {
            val fingerprint = "$pkg|$title|$content"
            if (deduper.isDuplicate(sbn.key ?: fingerprint, fingerprint)) {
                Log.d(TAG, "重复通知已忽略: $pkg")
                return
            }
        }

        // 根据包名分发处理逻辑
        when (pkg) {
            PACKAGE_WECHAT, PACKAGE_WECHAT_WORK -> handleWechatNotification(title, content)
            PACKAGE_ALIPAY -> handleAlipayNotification(title, content)
            PACKAGE_SELF -> handleSelfTestNotification(content)
        }
    }

    /**
     * 处理支付宝收款通知
     */
    private fun handleAlipayNotification(title: String, content: String) {
        if (TextUtils.isEmpty(title) && TextUtils.isEmpty(content)) {
            return
        }

        var money: String? = null
        var platform = ""
        val platformType = 2

        // 判断是普通收款还是店员通收款（添加括号明确优先级）
        val isNormalPay = (title.contains("成功收款") && content.contains("已转入余额")) ||
            content.contains("通过扫码向你付款")
        val isStaffPay = title.contains("店员通") || content.contains("支付宝成功收款")

        if (isNormalPay) {
            // 普通收款：优先从标题获取金额
            platform = "支付宝"
            money = getMoney(title)
            if (money.isNullOrEmpty()) {
                money = getMoney(content)
            }
        } else if (isStaffPay) {
            // 店员通收款：优先从内容获取金额
            platform = "支付宝店员"
            money = getMoney(content)
            if (money.isNullOrEmpty()) {
                money = getMoney(title)
            }
        } else {
            return // 不匹配的收款类型，直接返回
        }

        // 重试一次避免掉单
        if (money.isNullOrEmpty()) {
            money = if (isNormalPay) getMoney(content) else getMoney(title)
        }

        if (!money.isNullOrEmpty()) {
            try {
                val amount = money!!.toDouble()
                Toast.makeText(this, "匹配成功：${platform}到账${money}元", Toast.LENGTH_LONG).show()
                Log.d(TAG, "onAccessibilityEvent: 匹配成功：${platform}到账 ${money}元")
                appPush(platformType, amount)
            } catch (e: NumberFormatException) {
                Log.e(TAG, "解析${platform}金额失败：$money", e)
                showMoneyParseErrorToast(platform)
            }
        } else {
            showMoneyParseErrorToast(platform)
        }
    }

    /**
     * 处理自检测试通知
     */
    private fun handleSelfTestNotification(content: String) {
        if ("测试推送通知，如果程序正常，则会提示监听权限正常" == content) {
            sendMonitorLogs(now() + "\r\r\r\r" + "测试收款监听权限正常！")
        }
    }

    /**
     * 显示金额解析错误提示（避免频繁弹出 Toast）
     */
    private fun showMoneyParseErrorToast(platform: String) {
        // 记录到日志框
        sendMonitorLogs(now() + "\r\r\r\r" + "监听到${platform}收款消息但未匹配到金额！")

        mainHandler().post {
            Toast.makeText(
                applicationContext,
                "监听到${platform}收款消息但未匹配到金额！",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    // 当移除一条消息的时候回调，sbn 是被移除的消息
    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
    }

    // 申请设备电源锁（带 6 分钟超时：异常情况下锁自动释放，避免永久持锁导致设备无法休眠）
    @SuppressLint("InvalidWakeLockTag")
    fun acquireWakeLock(context: Context) {
        if (null == mWakeLock) {
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            val lock = pm?.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ON_AFTER_RELEASE, "WakeLock"
            )
            if (lock != null) {
                // 心跳周期 50 秒，6 分钟超时足够覆盖多轮心跳；超时自动释放，防止异常时永久持锁耗电
                lock.acquire(6 * 60 * 1000L)
                mWakeLock = lock
            }
        }
    }

    /**
     * 推送收款通知到服务器
     * @param type 支付类型：1-微信，2-支付宝
     * @param price 收款金额
     */
    fun appPush(type: Int, price: Double) {
        val read = getSharedPreferences("shinian", MODE_PRIVATE)
        host = read.getString("host", "") ?: ""
        key = read.getString("key", "") ?: ""

        // 格式化价格，避免精度问题（例如：0.1 变成 0.10000000000000000555）
        val priceStr = PaymentPushRequest.price(price)

        Log.d(TAG, "appPush: 开始 - 类型:$type, 金额:$priceStr")

        // 双通道：解析当前最可用 host+key（主/备故障自动切换；sign 必须用对应 key）
        val ch = ChannelManager.resolve(this)
        val activeHost = if (ch[0].isEmpty()) host else ch[0]
        val activeKey = ch[1]
        val usingBackup = activeHost != host

        // 构建请求 URL
        val t = System.currentTimeMillis().toString()
        Log.d(TAG, "appPush: channel=" + if (usingBackup) "备用" else "主")

        // 使用统一网络客户端（https/http 交替重试 + 跟随308重定向 + DoH加密DNS）
        // 确保收款回调在弱网/被重置环境下也能尽可能送达
        val pushPath = PaymentPushRequest.path(type, priceStr, t, activeKey)
        NetworkClient.getWithRetry(activeHost, pushPath, object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) {
                val error = e.message
                // 记账：驱动主/备切换（主连续失败达阈值且有备用→切备用）
                ChannelManager.recordMainFailure(this@PayNotificationListenerService)
                Log.e(TAG, "appPush: 请求失败 - $error")

                // 发送失败日志
                sendMonitorLogs(now() + "\r\r\r\r" + "通知回调失败：$error")

                // 请求失败后延迟 1 秒自动补回调
                scheduleRetryCallback(type, priceStr, t)
            }

            override fun onResponse(call: Call, response: Response) {
                try {
                    val str = response.body?.string() ?: ""
                    val result = org.json.JSONObject(str)
                    val msg = result.getString("msg")

                    // 根据支付类型记录日志
                    logPushResult(type, priceStr, msg, str, false)

                    // 通知回调成功后，清除对应的通知消息（防止通知栏堆积）
                    if ("成功" == msg) {
                        cancelNotification(type)
                    }
                } catch (e: org.json.JSONException) {
                    val error = e.message
                    Log.e(TAG, "appPush: JSON解析失败 - $error")

                    // 发送失败日志
                    sendMonitorLogs(now() + "\r\r\r\r" + "通知回调失败：$error")

                    // JSON解析失败后延迟 1 秒自动补回调
                    scheduleRetryCallback(type, priceStr, t)
                }
            }
        })
    }

    /**
     * 清除支付通知（防止通知栏堆积）
     * @param type 支付类型：1-微信，2-支付宝
     */
    private fun cancelNotification(type: Int) {
        try {
            // 获取所有活跃的通知
            val activeNotifications = activeNotifications
            if (activeNotifications == null || activeNotifications.isEmpty()) {
                return
            }

            // 根据支付类型确定要清除的通知包名
            val targetPackage = if (type == 1) PACKAGE_WECHAT else PACKAGE_ALIPAY

            // 遍历并清除指定包名的通知
            for (sbn in activeNotifications) {
                if (targetPackage == sbn.packageName) {
                    // 取消该通知
                    cancelNotification(sbn.key)
                    Log.d(
                        TAG, "cancelNotification: 已清除" + (if (type == 1) "微信" else "支付宝") +
                            "通知 - " + sbn.packageName
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "cancelNotification: 清除通知失败 - ${e.message}")
        }
    }

    /**
     * 记录推送结果日志（消除重复代码）
     */
    private fun logPushResult(type: Int, priceStr: String, msg: String, data: String, isRetry: Boolean) {
        val prefix = if (isRetry) "自动补回调：" else ""
        val payType = if (type == 1) "微信支付" else "支付宝"
        val logContent = now() + "\r\r\r\r" +
            prefix + "监听到" + payType + "收款" + priceStr + "元" +
            "\t" + "通知回调状态：" + msg +
            "\n" + "通知回调信息：" + data
        sendMonitorLogs(logContent)
    }

    /**
     * 延迟重试回调（消除重复代码）
     * 注意：网络请求必须在子线程执行（Android 主线程禁止网络IO，
     * 旧实现用主线程 Handler.postDelayed 执行同步请求，导致 NetworkOnMainThreadException，
     * 自动补单从未成功过）
     */
    private fun scheduleRetryCallback(type: Int, priceStr: String, eventTime: String) {
        Thread({
            try {
                // 延迟 1 秒后重试
                Thread.sleep(1000)

                // 双通道：补单也用当前最可用 host+key（主/备故障自动切换；sign 用对应 key）
                val ch2 = ChannelManager.resolve(this)
                val retryHost = if (ch2[0].isEmpty()) host else ch2[0]
                val retryKey = ch2[1]
                // 使用统一网络客户端同步重试（https/http 交替重试 + DoH加密DNS）
                val path = PaymentPushRequest.path(type, priceStr, eventTime, retryKey)
                val data = NetworkClient.getWithRetrySync(retryHost, path)
                ChannelManager.recordMainSuccess(this)

                // 解析响应
                val jsonObject = org.json.JSONObject(data)
                val code = jsonObject.getInt("code")
                val message = jsonObject.getString("msg")

                if (code == 1 && "成功" == message) {
                    // 记录补回调日志
                    logPushResult(type, priceStr, message, data, true)

                    mainHandler().post {
                        Toast.makeText(applicationContext, "补通知回调成功", Toast.LENGTH_LONG).show()
                    }
                } else {
                    Log.w(TAG, "appPush: 补回调失败 - code:$code, msg:$message")
                }
            } catch (e: Exception) {
                val error = e.message
                Log.e(TAG, "appPush: 补回调异常 - $error")

                mainHandler().post {
                    Toast.makeText(
                        application,
                        "自动补单回调失败！\n错误详情：$error",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }, "retry-callback").start()
    }

    /**
     * 处理微信收款通知
     */
    private fun handleWechatNotification(title: String, content: String) {
        // null
        if (TextUtils.isEmpty(title) && TextUtils.isEmpty(content)) return

        // 检查是否为支付相关标题
        var isPayTitle = false
        for (payTitle in WECHAT_PAY_TITLES) {
            if (payTitle == title) {
                isPayTitle = true
                break
            }
        }
        // title 不匹配
        if (!isPayTitle) return

        // 忽略支付消息
        if (!content.contains("收款") || content.contains("已支付")) return

        // 尝试获取金额（重试一次避免掉单）
        var money = getMoney(content)
        if (money.isNullOrEmpty()) {
            money = getMoney(content)
        }

        if (!money.isNullOrEmpty()) {
            try {
                val amount = money!!.toDouble()
                Toast.makeText(this, "匹配成功：微信到账${money}元", Toast.LENGTH_LONG).show()
                Log.d(TAG, "onAccessibilityEvent: 匹配成功：微信到账 ${money}元")
                appPush(1, amount)
            } catch (e: NumberFormatException) {
                Log.e(TAG, "解析微信金额失败：$money", e)
                showMoneyParseErrorToast("微信")
            }
        } else {
            showMoneyParseErrorToast("微信")
        }
    }

    // 监听服务连接成功时回调初始化心跳线程
    override fun onListenerConnected() {
        // 初始化主线程 Handler
        mainHandler()

        // 初始化心跳线程（内部已有 newThread != null 的防重入保护）
        initAppHeart()

        // 延迟发送监听日志。
        // 注意：系统在服务重连时会多次回调本方法，若不做去重会连续打印多条
        // "监听服务开启成功！"（用户实测日志中该条出现多次）。
        val nowMs = System.currentTimeMillis()
        if (nowMs - lastConnectedLogAt < CONNECT_LOG_WINDOW_MS) {
            Log.d(TAG, "onListenerConnected 重入，跳过重复日志")
            return
        }
        lastConnectedLogAt = nowMs
        mainHandler().postDelayed({
            sendMonitorLogs(now() + "\r\r\r\r" + "监听服务开启成功！")
        }, 1000)
    }

    // 服务销毁时清理资源：中断心跳线程、释放电源锁，防止线程与 WakeLock 泄漏
    override fun onDestroy() {
        Log.d(TAG, "监听服务销毁，清理资源")
        newThread?.interrupt()
        newThread = null
        releaseWakeLock()
        mainHandler?.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    // 监听日志
    private fun sendMonitorLogs(msgStr: String) {
        val read = getSharedPreferences("items", MODE_PRIVATE)
        var logsStr = read.getString("logsStr", "") ?: ""

        // 计算当前日志行数，只保留最近 20 条
        var lineCount = 0
        var lastIndex = -1
        for (i in logsStr.indices) {
            if (logsStr[i] == '\n') {
                lineCount++
                if (lineCount >= 20) {
                    lastIndex = i
                    break
                }
            }
        }

        // 如果超过 20 行，截取最后一部分
        if (lastIndex in 0 until logsStr.length - 1) {
            logsStr = logsStr.substring(lastIndex + 1)
        }

        // 追加新日志
        logsStr = "$msgStr\n$logsStr"

        // 异步写入（apply），避免在调用线程做磁盘IO阻塞
        getSharedPreferences("items", MODE_PRIVATE).edit()
            .putString("logsStr", logsStr)
            .apply()

        // 创建消息对象并发送
        val msg = Message()
        msg.what = 0
        val bundle = Bundle()
        bundle.putString("logsStr", logsStr)
        msg.data = bundle
        MainActivity.monitorLogHandler.sendMessage(msg)
    }

    // 获取 HTML（确保资源正确关闭）
    @Throws(Exception::class)
    fun getHtml(path: String): String {
        var conn: java.net.HttpURLConnection? = null
        var inStream: java.io.InputStream? = null
        try {
            val url = java.net.URL(path)
            conn = url.openConnection() as java.net.HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 8 * 1000

            // 通过输入流获取 html 数据
            inStream = conn.inputStream
            // 获取 html 的二进制数组
            val data = readInputStream(inStream)
            // 获取指定字符集解码指定的字节数组构造一个新的字符串
            return String(data, Charsets.UTF_8)
        } finally {
            // 关闭输入流
            if (inStream != null) {
                try {
                    inStream.close()
                } catch (e: java.io.IOException) {
                    Log.e(TAG, "关闭输入流失败", e)
                }
            }
            // 断开连接
            conn?.disconnect()
        }
    }

    // 读取输入流 获取 HTML 二进制数组（调用后需关闭输入流）
    @Throws(Exception::class)
    fun readInputStream(inStream: java.io.InputStream): ByteArray {
        val outStream = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(1024)
        var len: Int
        while (inStream.read(buffer).also { len = it } != -1) {
            outStream.write(buffer, 0, len)
        }
        return outStream.toByteArray()
    }

    companion object {
        private const val TAG = "PayNotService"

        // 支付平台包名常量
        private const val PACKAGE_WECHAT = "com.tencent.mm"
        private const val PACKAGE_WECHAT_WORK = "com.tencent.wework"
        private const val PACKAGE_ALIPAY = "com.eg.android.AlipayGphone"
        private const val PACKAGE_SELF = "com.shinian.pay"

        // 微信支付标题关键字
        private val WECHAT_PAY_TITLES = arrayOf(
            "微信支付", "微信收款助手", "微信收款商业版", "对外收款", "企业微信", "Weixin Cashier Assistant"
        )

        /**
         * "监听服务开启成功"日志的去重窗口（毫秒）：服务重连时避免刷屏
         */
        private const val CONNECT_LOG_WINDOW_MS = 5_000L

        /** 当前时间字符串（yyyy-MM-dd HH:mm:ss），统一日志时间格式 */
        private fun now(): String =
            java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.getDefault())
                .format(java.util.Date())

        /**
         * 从文本内容中提取金额（委托给 MoneyParser，保持静态方法签名以兼容既有调用点与单元测试）。
         */
        @JvmStatic
        fun getMoney(content: String?): String? = MoneyParser.getMoney(content)

        // MD5 加密（委托统一实现 Md5.hex，保持静态方法签名以兼容既有调用点）
        @JvmStatic
        fun md5(string: String?): String = Md5.hex(string)
    }
}
