package com.shinian.pay

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.graphics.Color
import android.os.Build
import android.util.Log
import com.shinian.pay.manager.AppConstants

/**
 * 全局 Application 类（Kotlin 版）。
 * 负责初始化全局组件和配置。
 */
class VmqApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        sInstance = this
        Log.d(TAG, "Application 初始化")
        // 全局异常记录：记录后必须交给系统默认处理器终止进程。
        // 旧实现吞掉异常不退出 → 主线程崩溃后进程变"僵尸"（界面冻结、服务假死、无法再收通知）
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, ex ->
            Log.e(TAG, "未捕获的异常：${ex.message}", ex)
            // 交给系统默认处理（写崩溃记录、终止进程），由 START_STICKY 前台服务负责自动重启
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, ex)
            } else {
                android.os.Process.killProcess(android.os.Process.myPid())
            }
        }
        // 创建通知渠道（Android 8.0+）
        createNotificationChannels()
    }

    /**
     * 创建所有需要的通知渠道
     */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager

            if (notificationManager == null) {
                Log.e(TAG, "通知管理器不可用")
                return
            }

            // 1. 核心服务通知渠道
            val coreServiceChannel = NotificationChannel(
                "vmq_core_service",
                "V免签监控端_Pro 核心服务",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "用于显示核心服务运行状态"
                enableLights(true)
                lightColor = Color.GREEN
                setShowBadge(true)
            }

            // 2. 守护服务通知渠道
            val daemonChannel = NotificationChannel(
                "daemon_service_channel",
                "守护服务通知",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "用于保持应用后台运行"
                enableLights(false)
                enableVibration(false)
                setShowBadge(false)
            }

            // 3. 心跳通知渠道（如果需要）
            val heartbeatChannel = NotificationChannel(
                AppConstants.NOTIFICATION_CHANNEL_ID,
                "心跳通知",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "用于心跳保活"
                enableLights(false)
                enableVibration(false)
                setShowBadge(false)
            }

            // 注册所有渠道
            notificationManager.createNotificationChannel(coreServiceChannel)
            notificationManager.createNotificationChannel(daemonChannel)
            notificationManager.createNotificationChannel(heartbeatChannel)

            Log.d(TAG, "通知渠道创建完成")
        }
    }

    companion object {
        private const val TAG = "VmqApplication"

        @Volatile
        private var sInstance: VmqApplication? = null

        /**
         * 获取 Application 实例
         *
         * @return Application 实例
         */
        @JvmStatic
        fun getInstance(): VmqApplication? = sInstance
    }
}