package com.shinian.pay.util

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.text.TextUtils
import android.util.Log
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * 权限引导工具类（Kotlin 版，Java 调用点 API 保持不变）。
 *
 * 功能：首次启动自动检测 APP 运行必需的权限，缺失时弹出清单对话框，
 * 用户点击"去开启"后直接跳转到对应的系统设置页（而不是让用户自己找）。
 *
 * 覆盖的权限：
 * 1. 通知使用权（NotificationListenerService，监听微信/支付宝收款通知）——核心
 * 2. 电池优化白名单（防止系统杀后台导致掉单）
 * 3. 通知栏显示权限（Android 13+，保活前台通知）
 * 4. 文件读写权限（Android 12 及以下，保存打赏码等）
 * 5. 自启动管理（国产 ROM 私有页面，跳转失败自动回退应用详情页）
 */
object PermissionGuideHelper {

    private const val TAG = "PermissionGuide"

    /** 权限项请求码（与扫码/相机/存储的请求码错开） */
    const val REQ_POST_NOTIFICATIONS = 11010
    const val REQ_LEGACY_STORAGE = 11011

    /** 权限项定义 */
    class PermissionItem(
        @JvmField val id: Int,
        @JvmField val name: String,
        @JvmField val desc: String,
        @JvmField var granted: Boolean
    )

    // ===== 权限项 ID =====
    const val PERM_NOTIFICATION_LISTENER = 1 // 通知使用权
    const val PERM_BATTERY_WHITELIST = 2     // 电池优化白名单
    const val PERM_POST_NOTIFICATIONS = 3    // 通知栏显示(Android 13+)
    const val PERM_LEGACY_STORAGE = 4        // 文件读写(Android 12-)
    const val PERM_AUTO_START = 5            // 自启动(国产ROM)

    /** 待引导队列：点击「去开启」后挂起，从设置页返回时据此继续引导 */
    private var sPendingGuide: MutableList<PermissionItem>? = null

    private var sLastAutoShowAt = 0L

    /** 自启动"已确认"标记（该权限无检测API，用户去过设置页即视为已确认） */
    private const val PREF_NAME = "perm_guide"
    private const val KEY_AUTO_START_ACK = "auto_start_acked"

    /** 检测所有必需权限的授权状态，返回缺失项 */
    @JvmStatic
    fun checkMissingPermissions(activity: Activity): MutableList<PermissionItem> {
        val all = ArrayList<PermissionItem>()

        // 1. 通知使用权（监听收款通知的核心权限）
        val nlEnabled = isNotificationListenerEnabled(activity)
        all.add(PermissionItem(PERM_NOTIFICATION_LISTENER, "通知使用权", "监听微信/支付宝收款通知（必需）", nlEnabled))

        // 2. 电池优化白名单
        val batteryOk: Boolean = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = activity.getSystemService(Context.POWER_SERVICE) as? PowerManager
            pm != null && pm.isIgnoringBatteryOptimizations(activity.packageName)
        } else {
            true
        }
        all.add(PermissionItem(PERM_BATTERY_WHITELIST, "电池优化白名单", "防止后台被杀导致收款掉单（强烈建议）", batteryOk))

        // 3. 通知栏显示权限（Android 13+ 动态申请）
        if (Build.VERSION.SDK_INT >= 33) {
            val notifOk = ContextCompat.checkSelfPermission(
                activity, Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            all.add(PermissionItem(PERM_POST_NOTIFICATIONS, "通知栏显示", "显示保活通知与到账提醒（必需）", notifOk))
        }

        // 4. 文件读写（Android 12L 及以下；Android 13+ 该权限已废弃，系统相册选择器自带授权）
        if (Build.VERSION.SDK_INT <= 32) {
            val storageOk = ContextCompat.checkSelfPermission(
                activity, Manifest.permission.READ_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED && ContextCompat.checkSelfPermission(
                activity, Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
            all.add(PermissionItem(PERM_LEGACY_STORAGE, "文件读写", "保存收款码图片等功能（建议）", storageOk))
        }

        // 5. 自启动权限（国产 ROM 无公开 API 检测开关状态，采用"引导确认"机制）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val autoStartIntent = getAutoStartIntent(activity)
            if (autoStartIntent != null && !isAutoStartAcked(activity)) {
                all.add(
                    PermissionItem(
                        PERM_AUTO_START, "自启动/后台运行",
                        "允许开机自启与后台保活（小米/华为/OPPO/vivo 等，APP无法检测开关状态，请确认已开启）", false
                    )
                )
            }
        }

        // 过滤出未授权项
        val missing = ArrayList<PermissionItem>()
        for (item in all) {
            if (!item.granted) {
                missing.add(item)
            }
        }
        return missing
    }

    /**
     * 弹出权限引导对话框。
     *
     * @param fromMenu true=用户从菜单手动触发（始终弹出，权限齐时提示已就绪）
     *                 false=首次启动自动触发（仅在有缺失权限时弹出）
     */
    @JvmStatic
    fun showPermissionGuideDialog(activity: Activity, missing: List<PermissionItem>?, fromMenu: Boolean) {
        if (!fromMenu && missing.isNullOrEmpty()) {
            return // 自动模式下无缺失权限，不打扰
        }

        if (missing.isNullOrEmpty()) {
            Toast.makeText(activity, "所有必要权限已开启 ✓", Toast.LENGTH_SHORT).show()
            return
        }

        val sb = StringBuilder("以下权限未开启，可能导致收不到收款通知或被系统杀后台：\n\n")
        val needGuide = ArrayList<PermissionItem>()
        for (item in missing) {
            sb.append("• ").append(item.name).append("：").append(item.desc).append("\n")
            needGuide.add(item)
        }
        sb.append("\n点击「去开启」逐项授权（将打开对应系统设置页）")

        val act = activity
        AlertDialog.Builder(activity)
            .setTitle("权限设置引导")
            .setMessage(sb.toString())
            .setCancelable(!fromMenu)
            .setPositiveButton("去开启") { _, _ ->
                // 挂起待引导队列：从系统设置返回后 onResume 会自动复查并继续下一项
                sPendingGuide = ArrayList(needGuide)
                openPermissionSettings(act, needGuide[0].id, sPendingGuide)
            }
            .setNegativeButton(if (fromMenu) "关闭" else "暂不授权") { _, _ ->
                // 用户明确拒绝，本次不再自动弹窗
                sPendingGuide = null
            }
            .show()
    }

    /** 启动时自动检查并弹窗（带节流：10 分钟内不重复弹） */
    @JvmStatic
    fun checkAndShowOnLaunch(activity: Activity) {
        val now = System.currentTimeMillis()
        if (now - sLastAutoShowAt < 10 * 60 * 1000L) {
            return
        }
        val missing = checkMissingPermissions(activity)
        if (missing.isNotEmpty()) {
            sLastAutoShowAt = now
            showPermissionGuideDialog(activity, missing, false)
        }
    }

    /**
     * onResume 复查：仅当存在待引导队列时才介入。
     * 用户从系统设置授权返回后调用——全部授权则提示就绪，仍有缺失则继续弹出引导。
     */
    @JvmStatic
    fun onResumeCheck(activity: Activity) {
        if (sPendingGuide == null) {
            return // 没有进行中的引导，不打扰
        }
        val missing = checkMissingPermissions(activity)
        if (missing.isEmpty()) {
            sPendingGuide = null
            Toast.makeText(activity, "所有必要权限已开启 ✓", Toast.LENGTH_SHORT).show()
        } else {
            // 剔除已授权的项后继续引导剩余项
            showPermissionGuideDialog(activity, missing, false)
        }
    }

    /**
     * 按权限项跳转对应系统设置页。
     * 跳转成功后，从待引导列表中移除该项；用户返回 APP 时若仍有缺失，onResume 会再次弹出。
     */
    @JvmStatic
    fun openPermissionSettings(activity: Activity, permId: Int, remaining: MutableList<PermissionItem>?) {
        if (remaining != null) {
            val it = remaining.iterator()
            while (it.hasNext()) {
                if (it.next().id == permId) {
                    it.remove()
                    break
                }
            }
        }
        try {
            when (permId) {
                PERM_NOTIFICATION_LISTENER ->
                    // 通知使用权设置页
                    try {
                        activity.startActivity(
                            Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        )
                    } catch (e: Exception) {
                        openAppDetailsSettings(activity)
                    }

                PERM_BATTERY_WHITELIST ->
                    // 直接弹系统的"忽略电池优化"确认对话框
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        try {
                            activity.startActivity(
                                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                                    .setData(Uri.parse("package:" + activity.packageName))
                                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            )
                        } catch (e: Exception) {
                            try {
                                activity.startActivity(
                                    Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                )
                            } catch (e2: Exception) {
                                openAppDetailsSettings(activity)
                            }
                        }
                    }

                PERM_POST_NOTIFICATIONS ->
                    // Android 13+ 运行时权限弹窗
                    if (Build.VERSION.SDK_INT >= 33) {
                        ActivityCompat.requestPermissions(
                            activity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_POST_NOTIFICATIONS
                        )
                    }

                PERM_LEGACY_STORAGE ->
                    // 旧系统存储权限运行时弹窗
                    ActivityCompat.requestPermissions(
                        activity,
                        arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE),
                        REQ_LEGACY_STORAGE
                    )

                PERM_AUTO_START -> {
                    // 国产 ROM 自启动管理页，逐个候选尝试，全部失败回退应用详情
                    val autoStart = getAutoStartIntent(activity)
                    markAutoStartAcked(activity) // 去过即视为已确认，不再报缺失
                    if (autoStart != null) {
                        activity.startActivity(autoStart.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    } else {
                        openAppDetailsSettings(activity)
                    }
                }

                else -> openAppDetailsSettings(activity)
            }
        } catch (e: Exception) {
            Log.w(TAG, "跳转权限设置页失败: " + e.message)
            Toast.makeText(activity, "未能打开设置页，已跳转到应用详情", Toast.LENGTH_SHORT).show()
            openAppDetailsSettings(activity)
        }
    }

    private fun isAutoStartAcked(context: Context): Boolean {
        return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_AUTO_START_ACK, false)
    }

    private fun markAutoStartAcked(context: Context) {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_AUTO_START_ACK, true).apply()
    }

    /** 回退方案：打开本 APP 的系统应用详情页（里面有全部权限开关） */
    @JvmStatic
    fun openAppDetailsSettings(activity: Activity) {
        try {
            activity.startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(Uri.parse("package:" + activity.packageName))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (e: Exception) {
            Toast.makeText(activity, "请到系统设置中手动开启权限", Toast.LENGTH_LONG).show()
        }
    }

    /** 获取厂商自启动管理页 Intent（仅国产 ROM 有，其余返回 null） */
    private fun getAutoStartIntent(context: Context): Intent? {
        val pm = context.packageManager

        val candidates = arrayOf(
            // 小米 MIUI
            arrayOf("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
            arrayOf("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartupManagementActivity"),
            // 华为/荣耀 EMUI / Magic
            arrayOf("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
            arrayOf("com.huawei.systemmanager", "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity"),
            // OPPO ColorOS
            arrayOf("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
            arrayOf("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
            // vivo OriginOS / FuntouchOS
            arrayOf("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
            arrayOf("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"),
            arrayOf("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
            // 三星
            arrayOf("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity"),
            arrayOf("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity")
        )

        for (c in candidates) {
            try {
                val intent = Intent().setComponent(ComponentName(c[0], c[1]))
                if (pm.resolveActivity(intent, 0) != null) {
                    return intent
                }
            } catch (ignored: Exception) {
            }
        }
        return null
    }

    /** 通知使用权是否已开启 */
    @JvmStatic
    fun isNotificationListenerEnabled(context: Context): Boolean {
        val pkgName = context.packageName
        val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
        if (!TextUtils.isEmpty(flat)) {
            val names = flat!!.split(":")
            for (name in names) {
                val cn = ComponentName.unflattenFromString(name)
                if (cn != null && TextUtils.equals(pkgName, cn.packageName)) {
                    return true
                }
            }
        }
        return false
    }
}