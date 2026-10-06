package com.shinian.pay.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.BitmapFactory
import android.graphics.Color
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.shinian.pay.R
import com.shinian.pay.manager.AppConstants
import com.shinian.pay.ui.MainActivity

/**
 * 通知栏常驻前台服务（Kotlin 版）。
 */
class ForeService : Service() {

    override fun onCreate() {
        Log.d(TAG, "onCreate() called")
        super.onCreate()
        // 注意：不在这里调用 setNotification()
        // Android 14 要求在 onStartCommand 中快速调用 startForeground()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand() called")
        // Android 14 关键修复：立即调用 startForeground()，必须在 5 秒内完成，越快越好
        setNotification()
        // START_STICKY：被系统杀死后由系统自动重建（配合 onDestroy 的重启形成双保险）
        return START_STICKY
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy() called")
        stopForeground(true)
        super.onDestroy()
        // 自愈：非用户主动退出时，被系统回收后立即重新拉起。
        // 旧实现只在 MainActivity.onCreate 启动一次，进程被回收后通知栏
        // 常驻通知消失且再无拉起入口（用户实测"久了会没"）。
        if (!AppConstants.IS_USER_EXIT) {
            try {
                val restart = Intent(applicationContext, ForeService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    applicationContext.startForegroundService(restart)
                } else {
                    applicationContext.startService(restart)
                }
                Log.d(TAG, "ForeService 已被系统回收，正在自动重启")
            } catch (e: Exception) {
                Log.e(TAG, "ForeService 自动重启失败：${e.message}", e)
            }
        }
    }

    /**
     * 用户从最近任务列表划掉 App 时触发。
     *
     * 这里返回后服务仍会被系统结束，但配合 `onDestroy` 的重启逻辑可尽快恢复常驻通知；
     * 若用户在设置中开启了「自启动」，系统亦会重新拉起。
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        Log.d(TAG, "onTaskRemoved() called")
        super.onTaskRemoved(rootIntent)
    }

    /**
     * 设置前台服务通知
     */
    fun setNotification() {
        Log.d(TAG, "设置前台通知")

        try {
            val notificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            if (notificationManager == null) {
                Log.e(TAG, "通知管理器不可用")
                return
            }

            // 创建通知渠道（Android O 及以上）
            createNotificationChannel(notificationManager)

            // 构建通知
            val notification = buildNotification()

            // 启动前台服务，指定前台服务类型
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Android 12+ 需要指定前台服务类型
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
                Log.d(TAG, "使用 Android 12+ 方式启动前台服务")
            } else {
                // Android 11 及以下
                startForeground(NOTIFICATION_ID, notification)
                Log.d(TAG, "使用 Android 11 及以下方式启动前台服务")
            }
        } catch (e: Exception) {
            Log.e(TAG, "启动前台服务失败：${e.message}", e)
            // 如果启动失败，尝试降级方案
            try {
                val notification = buildNotification()
                startForeground(NOTIFICATION_ID, notification)
                Log.d(TAG, "使用降级方案启动前台服务成功")
            } catch (e2: Exception) {
                Log.e(TAG, "降级方案也失败了：${e2.message}", e2)
            }
        }
    }

    /**
     * 创建通知渠道（Android O 及以上必需）
     * @param notificationManager 通知管理器
     */
    private fun createNotificationChannel(notificationManager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                NOTIFICATION_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                enableLights(true)
                lightColor = Color.GREEN
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * 构建前台服务通知
     * @return 通知对象
     */
    private fun buildNotification(): Notification {
        val content = "服务正在后台运行中！"
        val intent = Intent(this, MainActivity::class.java)

        // Android 14 兼容性修复：使用 FLAG_IMMUTABLE
        val pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, pendingIntentFlags)

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, NOTIFICATION_CHANNEL_ID).apply {
                setLargeIcon(BitmapFactory.decodeResource(resources, R.drawable.ic_launcher))
                setSmallIcon(R.drawable.ic_launcher)
                setContentTitle(getString(R.string.app_name))
                setContentText(content)
                setWhen(System.currentTimeMillis())
                setContentIntent(pendingIntent)
                setAutoCancel(false)
                setOngoing(true) // 设置为常驻通知
                // Android 10+ setTicker 已废弃，但为了兼容保留
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                    @Suppress("DEPRECATION")
                    setTicker(content)
                }
            }
        } else {
            Notification.Builder(this).apply {
                setLargeIcon(BitmapFactory.decodeResource(resources, R.drawable.ic_launcher))
                setSmallIcon(R.drawable.ic_launcher)
                setContentTitle(getString(R.string.app_name))
                setContentText(content)
                @Suppress("DEPRECATION")
                setTicker(content)
                setWhen(System.currentTimeMillis())
                setContentIntent(pendingIntent)
                setAutoCancel(false)
                setOngoing(true)
            }
        }
        val notification = builder.build()
        notification.flags = Notification.FLAG_ONGOING_EVENT
        return notification
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val TAG = "ForeService"
        private const val NOTIFICATION_CHANNEL_ID = "vmq_core_service"
        private const val NOTIFICATION_CHANNEL_NAME = "V免签监控端_Pro 核心服务"
        private const val NOTIFICATION_ID = 1
    }
}