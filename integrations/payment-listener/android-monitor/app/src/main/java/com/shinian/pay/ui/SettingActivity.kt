package com.shinian.pay.ui

import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.View
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.shinian.pay.R
import com.shinian.pay.manager.AppConstants
import com.shinian.pay.service.DaemonService
import com.shinian.pay.service.PlayerMusicService
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * 软件设置页（Kotlin 版）。
 * 布局 activity_setting.xml 的 android:onClick 仍按同名 public 方法反射绑定。
 */
class SettingActivity : AppCompatActivity() {

    private var version: TextView? = null
    private var state_switch: Switch? = null
    private var state_swich: String? = null
    /** 屏幕常亮开关的状态文案（原实现用 Switch.hint，实际不生效） */
    private var txtAlwaysOnState: TextView? = null

    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 隐藏标题栏
        supportActionBar?.hide()

        setContentView(R.layout.activity_setting)

        version = findViewById(R.id.version)
        state_switch = findViewById(R.id.state_switch)
        txtAlwaysOnState = findViewById(R.id.txt_always_on_state)
        version!!.text = "当前软件版本 V" + appVersionName

        // 设置返回按钮点击事件
        findViewById<View?>(R.id.btn_back)?.setOnClickListener { finish() }

        val state = getSharedPreferences("state_switch", MODE_PRIVATE)
        state_swich = state.getString("state_switch", "")

        // 设置 Switch 开关状态 + 状态文案（Switch.hint 不生效，故用独立 TextView 呈现）
        setSwitchState(state_swich)
        updateAlwaysOnStateText(state_swich == STATE_ON)
    }

    /**
     * 设置开关状态显示。
     *
     * 注意：`Switch.hint` 对 Switch 控件**不生效**（hint 仅用于 EditText），
     * 旧实现依赖它显示"开启/关闭"实际从未显示过。这里改为同时更新
     * 开关勾选态 + 旁边的状态文案（由调用方持有的 summary TextView 呈现）。
     */
    private fun setSwitchState(state: String?) {
        // 存储语义：常量 STATE_ON="no" 表示"屏幕常亮已开启"，STATE_OFF="off" 表示已关闭
        when (state) {
            STATE_ON -> state_switch!!.isChecked = true
            STATE_OFF -> state_switch!!.isChecked = false
            else -> state_switch!!.isChecked = false
        }
    }

    private fun stopPlayMusicService() {
        stopService(Intent(this, PlayerMusicService::class.java))
    }

    private fun startPlayMusicService() {
        startService(Intent(this, PlayerMusicService::class.java))
    }

    private fun startDaemonService() {
        startService(Intent(this, DaemonService::class.java))
    }

    // 停止 service
    private fun stopDaemonService() {
        stopService(Intent(this, DaemonService::class.java))
    }

    override fun onDestroy() {
        super.onDestroy()
        if (AppConstants.DEBUG) {
            Log.d(TAG, "--->onDestroy")
        }
    }

    private var loadingDialog: AlertDialog? = null

    /** 显示更新对话框 */
    private fun showUpdateDialog(uplog: String, upurl: String) {
        val dialog = AlertDialog.Builder(this)
            .setTitle("发现新版本！")
            .setMessage(uplog)
            .setIcon(R.drawable.app_gx)
            .setCancelable(false)
            .setPositiveButton("立即更新") { _, _ ->
                val intent_d = Intent(Intent.ACTION_VIEW)
                intent_d.data = Uri.parse(upurl)
                startActivity(intent_d)
            }
            .setNeutralButton("忽略更新", null)
            .create()
        dialog.show()
    }

    // 获取当前应用的版本名（展示给消费者的版本号）
    private val appVersionName: String
        get() {
            val packageManager = packageManager
            try {
                val packInfo = packageManager.getPackageInfo(packageName, 0)
                if (packInfo != null && packInfo.versionName != null) {
                    return packInfo.versionName
                }
            } catch (e: PackageManager.NameNotFoundException) {
                Log.e(TAG, "获取版本名失败", e)
            }
            return "未知版本"
        }

    /**
     * 检查应用版本更新
     * @return true 表示有新版本，false 表示已是最新版本或检查失败
     */
    fun App(): Boolean {
        try {
            // 从本仓库 GitHub Releases 检查更新（原第三方接口已废弃）
            val info = com.shinian.pay.util.UpdateChecker.check(appVersionName) ?: return false
            if (!info.hasUpdate) {
                return false
            }
            runOnUiThread { showUpdateDialog(info.changelog, info.downloadUrl) }
            return true
        } catch (e: Exception) {
            Log.e(TAG, "检查更新发生异常", e)
        }
        return false
    }

    // 检测更新
    fun ver_sion(v: View?) {
        Thread {
            runOnUiThread { showLoadingDialog() }

            try {
                val result = App()

                runOnUiThread {
                    dismissLoadingDialog()
                    if (!result) {
                        Toast.makeText(this, "已经是最新版本", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "检查更新失败", e)
                runOnUiThread {
                    dismissLoadingDialog()
                    Toast.makeText(this, "检查更新失败", Toast.LENGTH_SHORT).show()
                }
            }
        }.start()
    }

    private fun showLoadingDialog() {
        if (loadingDialog == null || !loadingDialog!!.isShowing) {
            loadingDialog = AlertDialog.Builder(this)
                .setMessage("正在检查更新...")
                .setCancelable(false)
                .create()
            loadingDialog!!.show()
        }
    }

    private fun dismissLoadingDialog() {
        if (loadingDialog != null && loadingDialog!!.isShowing) {
            loadingDialog!!.dismiss()
        }
    }

    /**
     * 获取网页 HTML 内容
     * @param path 网页地址
     * @return HTML 内容
     * @throws Exception 网络异常
     */
    @Throws(Exception::class)
    fun getHtml(path: String): String {
        val url = URL(path)
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = HTTP_TIMEOUT

        var inStream: InputStream? = null
        try {
            inStream = conn.inputStream
            val data = readInputStream(inStream)
            return String(data, Charsets.UTF_8)
        } finally {
            if (inStream != null) {
                try {
                    inStream.close()
                } catch (e: IOException) {
                    Log.w(TAG, "关闭输入流失败", e)
                }
            }
        }
    }

    // 读取输入流 获取 HTML 二进制数组
    @Throws(Exception::class)
    fun readInputStream(inStream: InputStream): ByteArray {
        val outStream = ByteArrayOutputStream()
        val buffer = ByteArray(1024)
        var len: Int
        try {
            while (inStream.read(buffer).also { len = it } != -1) {
                outStream.write(buffer, 0, len)
            }
        } finally {
            outStream.close()
        }
        return outStream.toByteArray()
    }

    // 问题反馈（跳转到 GitHub Issues）
    fun email_fk(view: View?) {
        try {
            val intent = Intent(Intent.ACTION_VIEW)
            intent.data = Uri.parse("https://github.com/Nanying666/Vmq-App-Optimized/issues")
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "无法打开浏览器，请检查浏览器设置", Toast.LENGTH_SHORT).show()
        }
    }

    // Docs
    fun help_api(v: View?) {
        startActivity(Intent(this, HelpActivity::class.java))
    }

    // 白名单权限检测
    fun dc_qx(v: View?) {
        if (!isIgnoringBatteryOptimizations()) {
            val i = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
            startActivity(i)
            Toast.makeText(application, "请勾选此应用\"不优化\"", Toast.LENGTH_LONG).show()
        } else {
            Toast.makeText(this, "已授权白名单权限!", Toast.LENGTH_SHORT).show()
        }
    }

    // 检测电池白名单权限
    private fun isIgnoringBatteryOptimizations(): Boolean {
        val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
        if (powerManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return powerManager.isIgnoringBatteryOptimizations(packageName)
        }
        return false
    }

    // 打开电池白名单设置
    fun requestIgnoreBatteryOptimizations() {
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
            intent.data = Uri.parse("package:$packageName")
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "打开电池优化设置失败", e)
        }
    }

    // 保活服务
    fun service_start(v: View?) {
        // 1. 启动前台 Service（唯一真实有效的保活手段）
        startDaemonService()
        // 2. 启动播放音乐 Service（低优先级进程提升，可开关）
        startPlayMusicService()
        // 说明：原 Native 守护、Account Sync、锁屏1像素 Activity、JobScheduler 等无效/有害保活手段已移除
        Toast.makeText(this, "服务启动成功!", Toast.LENGTH_SHORT).show()
    }

    // 屏幕永亮
    fun state_swit(v: View?) {
        if (state_switch!!.isChecked) {
            showEnableAlwaysOnDialog()
        } else {
            disableAlwaysOn()
        }
    }

    /** 显示开启屏幕常亮对话框 */
    private fun showEnableAlwaysOnDialog() {
        val message = "开启或关闭此功能将会在 2 秒后重启软件！\n" +
            "开启之后便会自动调低软件窗口亮度并进入全屏模式（退出即可恢复！）\n" +
            "重启后请不要关闭软件，保持 Log 日志面板即可否则无效！\n" +
            "此功能仅适用于真机独立挂 V 免签监控的"

        AlertDialog.Builder(this)
            .setMessage(message)
            .setCancelable(false)
            .setPositiveButton("我已知晓") { _, _ ->
                // 先保存设置
                getSharedPreferences("state_switch", MODE_PRIVATE).edit()
                    .putString("state_switch", STATE_ON)
                    .apply()
                updateAlwaysOnStateText(true)
                Toast.makeText(this, "屏幕永亮开启成功，2S 后重启...", Toast.LENGTH_SHORT).show()
                // 延迟重启
                restartApp(RESTART_DELAY_OPEN)
            }
            .setNegativeButton("暂不开启") { _, _ ->
                // 用户取消，恢复开关状态
                state_switch!!.isChecked = false
            }
            .create()
            .show()
    }

    /** 关闭屏幕常亮 */
    private fun disableAlwaysOn() {
        // 先保存设置
        getSharedPreferences("state_switch", MODE_PRIVATE).edit()
            .putString("state_switch", STATE_OFF)
            .apply()
        updateAlwaysOnStateText(false)
        Toast.makeText(this, "屏幕永亮已关闭，1.5S 后重启...", Toast.LENGTH_SHORT).show()
        // 延迟重启
        restartApp(RESTART_DELAY_CLOSE)
    }

    /** 刷新「屏幕常亮」状态文案（替代原先无效的 Switch.hint） */
    private fun updateAlwaysOnStateText(enabled: Boolean) {
        txtAlwaysOnState?.text = if (enabled) "已开启 · 永不息屏" else "已关闭"
        txtAlwaysOnState?.setTextColor(
            if (enabled) ContextCompat.getColor(this, R.color.vmq_success)
            else ContextCompat.getColor(this, R.color.vmq_on_surface_secondary)
        )
    }

    /**
     * 重启应用（使用 PendingIntent 方式重启，更加优雅）
     * @param delayMillis 延迟时间 (毫秒)
     */
    private fun restartApp(delayMillis: Int) {
        mainHandler.postDelayed({
            try {
                // 获取启动 Intent
                val intent = packageManager.getLaunchIntentForPackage(packageName)
                if (intent != null) {
                    // 添加标志位，确保重新启动
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    // 启动主 Activity
                    startActivity(intent)
                    // 结束当前 Activity
                    finish()
                    // 退出进程
                    android.os.Process.killProcess(android.os.Process.myPid())
                } else {
                    Log.e(TAG, "无法获取启动 Intent")
                    Toast.makeText(this, "重启失败，请手动重启应用", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "重启应用失败", e)
                Toast.makeText(this, "重启失败: " + e.message, Toast.LENGTH_LONG).show()
            }
        }, delayMillis.toLong())
    }

    fun vmq_Pro_gy(v: View?) {
        startActivity(Intent(this, AboutActivity::class.java))
    }

    companion object {
        private const val TAG = "SettingActivity"

        /** 屏幕常亮：已开启（历史遗留的取值，勿改，否则旧用户配置失效） */
        private const val STATE_ON = "no"

        /** 屏幕常亮：已关闭 */
        private const val STATE_OFF = "off"

        // 延迟时间常量
        private const val RESTART_DELAY_OPEN = 2000  // 开启时延迟2秒
        private const val RESTART_DELAY_CLOSE = 1500 // 关闭时延迟1.5秒
        private const val HTTP_TIMEOUT = 8000
    }
}