package com.shinian.pay.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.annotation.Nullable
import com.shinian.pay.R

/**
 * 移除前台 Service 通知栏标志，这个 Service 选择性使用（Kotlin 版）。
 */
class CancelNoticeService : Service() {

    @Nullable
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.JELLY_BEAN_MR2) {
            createNotificationChannel()
            val builder = createNotificationBuilder()
            // Android 14 起必须显式传入前台服务类型，否则抛 MissingForegroundServiceTypeException
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                startForeground(
                    DaemonService.NOTICE_ID, builder.build(),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else {
                startForeground(DaemonService.NOTICE_ID, builder.build())
            }
            // 开启一条线程，去移除 DaemonService 弹出的通知
            Thread {
                // 延迟 1s
                android.os.SystemClock.sleep(1000)
                // 取消 CancelNoticeService 的前台
                stopForeground(true)
                // 移除 DaemonService 弹出的通知
                val manager = getSystemService(NOTIFICATION_SERVICE) as? NotificationManager
                manager?.cancel(DaemonService.NOTICE_ID)
                // 任务完成，终止自己
                stopSelf()
            }.start()
        }
        return super.onStartCommand(intent, flags, startId)
    }

    /**
     * 创建通知渠道 (Android 8.0+)
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_MIN // 使用最低重要性，完全隐藏通知
            ).apply {
                description = "用于临时移除前台通知"
                enableLights(false)
                enableVibration(false)
                setShowBadge(false)
            }

            val manager = getSystemService(NOTIFICATION_SERVICE) as? NotificationManager
            manager?.createNotificationChannel(channel)
        }
    }

    /**
     * 创建通知构建器 (兼容不同版本)
     */
    private fun createNotificationBuilder(): Notification.Builder {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher)
                .setPriority(Notification.PRIORITY_MIN)
        } else {
            Notification.Builder(this)
                .setSmallIcon(R.drawable.ic_launcher)
        }
    }

    companion object {
        private const val CHANNEL_ID = "cancel_notice_channel"
        private const val CHANNEL_NAME = "取消通知服务"
    }
}