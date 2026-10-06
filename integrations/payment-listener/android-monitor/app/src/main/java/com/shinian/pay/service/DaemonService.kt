package com.shinian.pay.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.annotation.Nullable
import com.shinian.pay.R
import com.shinian.pay.manager.AppConstants

/**
 * 前台 Service，使用 startForeground（Kotlin 版）。
 * 这个 Service 尽量要轻，不要占用过多的系统资源，否则系统在资源紧张时照样会将其杀死。
 */
class DaemonService : Service() {

    @Nullable
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        if (AppConstants.DEBUG) Log.d(TAG, "DaemonService---->onCreate 被调用，启动前台 service")
        // 如果 API 大于 18，需要弹出一个可见通知
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
            createNotificationChannel()
            val builder = createNotificationBuilder()
            startForegroundCompat(builder.build())
            // 如果觉得常驻通知栏体验不好，可以通过启动 CancelNoticeService 将通知移除，oom_adj 值不变
            startService(Intent(this, CancelNoticeService::class.java))
        } else {
            @Suppress("DEPRECATION")
            startForeground(NOTICE_ID, Notification())
        }
    }

    /**
     * 启动前台服务（区分版本，Android 14 必须显式声明前台服务类型）。
     *
     * Android 14（API 34）起，若 Manifest 声明了 `foregroundServiceType`，
     * `startForeground(id, notification)` 会抛 `MissingForegroundServiceTypeException`；
     * 必须改用三参重载并传入匹配的类型，否则服务直接崩溃、保活失效。
     */
    private fun startForegroundCompat(notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            startForeground(NOTICE_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTICE_ID, notification)
        }
    }

    /**
     * 创建通知渠道 (Android 8.0+)
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW // 使用低重要性，减少打扰
            ).apply {
                description = "用于保持应用后台运行"
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
                .setContentTitle("KeepAppAlive")
                .setContentText("DaemonService is runing...")
                .setPriority(Notification.PRIORITY_LOW)
        } else {
            Notification.Builder(this)
                .setSmallIcon(R.drawable.ic_launcher)
                .setContentTitle("KeepAppAlive")
                .setContentText("DaemonService is runing...")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // 如果 Service 被终止，当资源允许情况下重启 service
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        // 如果 Service 被杀死，干掉通知
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
            val mManager = getSystemService(NOTIFICATION_SERVICE) as? NotificationManager
            mManager?.cancel(NOTICE_ID)
        }
        if (AppConstants.DEBUG) Log.d(TAG, "DaemonService---->onDestroy，前台 service 被杀死")
        // 修复：通过静态退出标志判断是否为用户主动退出。
        // 旧实现无条件自我重启 → 用户点"退出APP"后 stopService 反而触发重启，退出不干净
        if (!AppConstants.IS_USER_EXIT) {
            startService(Intent(applicationContext, DaemonService::class.java))
        }
    }

    companion object {
        private const val TAG = "DaemonService"
        const val NOTICE_ID = 100
        private const val CHANNEL_ID = "daemon_service_channel"
        private const val CHANNEL_NAME = "守护服务通知"
    }
}