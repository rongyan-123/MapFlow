package com.shinian.pay.ui

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.*
import android.graphics.*
import android.net.Uri
import android.os.*
import android.provider.Settings
import android.text.TextUtils
import android.util.Log
import android.view.*
import android.view.View.OnLongClickListener
import android.widget.*
import androidx.annotation.NonNull
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.google.zxing.activity.CaptureActivity
import com.shinian.pay.R
import com.shinian.pay.manager.AppConstants
import com.shinian.pay.service.DaemonService
import com.shinian.pay.service.ForeService
import com.shinian.pay.service.PayNotificationListenerService
import com.shinian.pay.service.PlayerMusicService
import com.shinian.pay.util.ChannelManager
import com.shinian.pay.util.Md5
import com.shinian.pay.util.NetworkClient
import com.shinian.pay.util.PermissionGuideHelper
import com.shinian.pay.util.SaveImageUtils
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Response
import org.json.JSONException
import org.json.JSONObject
import java.io.*
import java.lang.reflect.Method
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.security.NoSuchAlgorithmException
import java.util.Date
import java.util.regex.Pattern

/*
 email：shiniana@qq.com
 qq：1614790395
 GitHub：https://github.com/Nanying666/Vmq-App-Optimized
 @©️版权所有
 */

/**
 * 主界面（Kotlin 版）。
 *
 * 保持与 Java 版一致的对外契约：
 *  - 布局 activity_main.xml / menu 的 android:onClick 仍按同名 public 方法反射绑定；
 *  - LogsTextView / monitorLogHandler 保持静态可访问（供监听服务使用）。
 */
class MainActivity : AppCompatActivity(), OnLongClickListener {

    private var txthost: TextView? = null
    private var txtkey: TextView? = null
    private var txtBackupState: TextView? = null
    private var isOk = false
    private var logs_linear_layout: LinearLayout? = null
    private var id = 0

    // 定义 Bitmap 变量
    private var bitmap_image: Bitmap? = null
    private var state_swich: String? = null
    private var sj_dl: TextView? = null // 当前电量 Text
    private var capacity = 0
    private val ld = 5 // 亮度值 0~255

    private var dlThread: Thread? = null

    override fun onCreate(icicle: Bundle?) {
        super.onCreate(icicle)

        // 输出关键日志，方便调试
        Log.d(TAG, "========== MainActivity onCreate 开始 ==========")
        Log.d(TAG, "设备信息：${Build.MANUFACTURER} ${Build.MODEL}")
        Log.d(TAG, "Android 版本：${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
        Log.d(TAG, "MIUI 版本：${getMiuiVersion()}")

        // 自动适配屏幕
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        setContentView(R.layout.activity_main)

        // 主题为 NoActionBar，这里把布局内 Toolbar 接入为 support action bar，
        // 使 onCreateOptionsMenu 注入的菜单（溢出菜单按钮）正常显示。
        setSupportActionBar(findViewById<Toolbar?>(R.id.toolbar))
        // setSupportActionBar 会把 Activity 的 android:label 作为 ActionBar 标题，
        // 而布局内 Toolbar 已自带标题 TextView，若不隐藏会**重复显示两遍标题**。
        supportActionBar?.setDisplayShowTitleEnabled(false)

        Log.d(TAG, "布局加载完成")

        // 查找组件
        txthost = findViewById(R.id.txt_host)
        txtkey = findViewById(R.id.txt_key)
        txtBackupState = findViewById(R.id.txt_backup_state)
        LogsTextView = findViewById(R.id.state_logs)
        logs_linear_layout = findViewById(R.id.logs_linear_layout)
        LogsTextView!!.setOnLongClickListener(this) // 长按
        sj_dl = findViewById(R.id.sj_dl)

        // 设置底部版权信息文本的下划线
        val bqTextView = findViewById<TextView?>(R.id.bq)
        bqTextView?.paintFlags = bqTextView.paintFlags or Paint.UNDERLINE_TEXT_FLAG

        // 延迟启动前台服务，避免在 onCreate 时阻塞 UI 线程
        // Android 14 需要在 5 秒内调用 startForeground()
        Handler(Looper.getMainLooper()).postDelayed({
            try {
                val serviceIntent = Intent(this, ForeService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(serviceIntent)
                    Log.d(TAG, "已调用 startForegroundService")
                } else {
                    startService(serviceIntent)
                    Log.d(TAG, "已调用 startService")
                }
            } catch (e: Exception) {
                Log.e(TAG, "启动前台服务失败：${e.message}", e)
                Handler(Looper.getMainLooper()).post {
                    Toast.makeText(this@MainActivity, "服务启动失败，请检查权限", Toast.LENGTH_SHORT).show()
                }
            }
        }, 1000) // 延迟 1 秒启动，确保 Activity 完全初始化

        // 调用 App 方法检查更新（在后台静默检查，不显示结果）
        App()

        // 接收并设置日志信息
        val read1 = getSharedPreferences("items", MODE_PRIVATE)
        val logsStr = read1.getString("logsStr", "") ?: ""
        LogsTextView!!.text = if (logsStr == "") "日志：null" else logsStr

        if (!checkQQInstalled(this, "com.tencent.mm")) {
            Toast.makeText(application, "提示：无法检测到微信包名！\n可能无法正常监听", Toast.LENGTH_LONG).show()
        }
        if (!checkQQInstalled(this, "com.eg.android.AlipayGphone")) {
            Toast.makeText(application, "提示：无法检测到支付宝包名！\n可能无法正常监听", Toast.LENGTH_LONG).show()
        }

        // 获取状态
        val state = getSharedPreferences("state_switch", MODE_PRIVATE)
        state_swich = state.getString("state_switch", "") ?: ""
        // 屏幕是否常亮
        if (state_swich == "no") {
            Toast.makeText(application, "当前处于屏幕常亮模式\n当前界面亮度值：$ld", Toast.LENGTH_LONG).show()
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            initAppHeart() // 电量线程
            Handler(Looper.getMainLooper()).postDelayed({
                val lp = window.attributes
                lp.screenBrightness = ld.toFloat() * (1f / 255f) // 亮度值 0~255
                window.attributes = lp
            }, 3000)
        }

        // 重启监听服务（通知使用权已授权时）
        if (isNotificationListenersEnabled() && isNLServiceEnabled()) {
            toggleNotificationListenerService(this)
        }

        // 启动时自动检测全部必需权限，缺失时弹出清单对话框
        PermissionGuideHelper.checkAndShowOnLaunch(this)

        // 读入保存的配置数据并显示
        val read = getSharedPreferences("shinian", MODE_PRIVATE)
        host = read.getString("host", "") ?: ""
        key = read.getString("key", "") ?: ""

        if (!TextUtils.isEmpty(host) && !TextUtils.isEmpty(key)) {
            txthost!!.text = " 通知地址：$host"
            txtkey!!.text = " 通讯密钥：$key"
            isOk = true
        }

        Log.d(TAG, "========== MainActivity onCreate 完成 ==========")
    }

    override fun onResume() {
        super.onResume()
        // 用户从系统设置页授权返回后自动复查
        PermissionGuideHelper.onResumeCheck(this)
        // 兜底：每次回到前台都确保前台服务在运行。
        // 若进程曾被系统回收，服务会在此被重新拉起，避免通知栏常驻通知消失。
        ensureForegroundService()
    }

    /** 确保前台服务处于运行状态（幂等：已运行则 startService 无副作用） */
    private fun ensureForegroundService() {
        try {
            val serviceIntent = Intent(this, ForeService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "确保前台服务运行失败：${e.message}", e)
        }
    }

    /** 获取 MIUI 版本号（非 MIUI 返回提示） */
    private fun getMiuiVersion(): String {
        return try {
            val clazz = Class.forName("miui.os.Build")
            val field = clazz.getDeclaredField("VERSION_INCREMENT")
            val value = field.get(null)
            value?.toString() ?: "未知"
        } catch (e: Exception) {
            "非 MIUI 设备"
        }
    }

    /** 请求忽略电池优化（小米手机重要） */
    private fun requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
            if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    val intent = Intent()
                    intent.action = Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                    intent.data = Uri.parse("package:$packageName")
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(intent)
                    Log.d(TAG, "已请求电池优化白名单")
                } catch (e: Exception) {
                    Log.e(TAG, "请求电池优化白名单失败", e)
                }
            }
        }
    }

    /** 退出应用，停止所有服务和清理资源 */
    private fun exitApp() {
        try {
            // 标记用户主动退出：防止 DaemonService 在 onDestroy 中自我复活
            AppConstants.IS_USER_EXIT = true

            dlThread?.let {
                it.interrupt()
                dlThread = null
                Log.d(TAG, "已停止电量线程")
            }

            try {
                stopService(Intent(this, ForeService::class.java))
                Log.d(TAG, "已停止前台监听服务")
            } catch (e: Exception) {
                Log.e(TAG, "停止前台服务失败", e)
            }

            // 停止守护服务与保活音频服务（此前遗漏，导致退出后仍残留通知/音频）
            try {
                stopService(Intent(this, DaemonService::class.java))
                stopService(Intent(this, PlayerMusicService::class.java))
                Log.d(TAG, "已停止守护/保活服务")
            } catch (e: Exception) {
                Log.e(TAG, "停止守护服务失败", e)
            }

            try {
                stopService(Intent(this, PayNotificationListenerService::class.java))
                Log.d(TAG, "已请求停止监听服务并释放资源")
            } catch (e: Exception) {
                Log.e(TAG, "停止监听服务失败", e)
            }

            try {
                val nm = getSystemService(NOTIFICATION_SERVICE) as? NotificationManager
                nm?.cancelAll()
                Log.d(TAG, "已清除所有通知")
            } catch (e: Exception) {
                Log.e(TAG, "清除通知失败", e)
            }

            Toast.makeText(this, "正在退出监控服务...", Toast.LENGTH_SHORT).show()

            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    android.os.Process.killProcess(android.os.Process.myPid())
                    System.exit(0)
                } catch (e: Exception) {
                    Log.e(TAG, "终止进程失败", e)
                    Runtime.getRuntime().exit(0)
                }
            }, 800)
        } catch (e: Exception) {
            Log.e(TAG, "退出应用时发生错误", e)
            try {
                android.os.Process.killProcess(android.os.Process.myPid())
            } catch (ex: Exception) {
                Runtime.getRuntime().exit(0)
            }
        }
    }

    /** 获取当前电量百分比 */
    fun getBatteryCurrent(context: Context): Int {
        var capacity = 0
        try {
            val manager = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
            capacity = manager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 0
        } catch (e: Exception) {
        }
        return capacity
    }

    /** 电池电量线程 */
    fun initAppHeart() {
        dlThread = Thread {
            while (true) {
                Handler(Looper.getMainLooper()).postDelayed({
                    sj_dl?.text = "当前电量：" + getBatteryCurrent(this@MainActivity) + "%"
                }, 1000)
                try {
                    Thread.sleep(60 * 1000) // 一分钟休眠
                } catch (e: InterruptedException) {
                    e.printStackTrace()
                }
            }
        }
        dlThread!!.start() // 启动线程
    }

    /**
     * unicode 解码：将 Unicode 编码转换为中文
     * @param string 待解码内容
     * @return 转换之后的内容
     */
    fun unicodeDecode(string: String): String {
        var s = string
        val pattern = Pattern.compile("(\\\\u(\\p{XDigit}{4}))")
        val matcher = pattern.matcher(s)
        while (matcher.find()) {
            val ch = Integer.parseInt(matcher.group(2), 16).toChar()
            s = s.replace(matcher.group(1), ch.toString())
        }
        return s
    }

    /**
     * 检查应用版本更新（在子线程中执行网络请求，避免 NetworkOnMainThreadException）
     */
    fun App() {
        Thread {
            try {
                // 从本仓库 GitHub Releases 检查更新（原第三方接口已废弃）
                val info = com.shinian.pay.util.UpdateChecker.check(getAppVersionName()) ?: return@Thread
                if (!info.hasUpdate) {
                    Log.d(TAG, "当前已是最新版本：${info.latestVersion}")
                    return@Thread
                }
                runOnUiThread {
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("发现新版本 ${info.latestVersion}！")
                        .setMessage(info.changelog.ifEmpty { "有新版本可用" })
                        .setIcon(R.drawable.app_gx)
                        .setCancelable(false)
                        .setPositiveButton("立即更新") { _, _ ->
                            val intent_d = Intent()
                            intent_d.action = "android.intent.action.VIEW"
                            intent_d.data = Uri.parse(info.downloadUrl)
                            startActivity(intent_d)
                        }
                        .setNeutralButton("忽略更新", null)
                        .create()
                        .show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "检查更新发生异常", e)
            }
        }.start()
    }

    fun getHtml(path: String): String {
        val url = URL(path)
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.connectTimeout = 8 * 1000
        // 通过输入流获取 html 数据
        val inStream = conn.inputStream
        // 获取 html 的二进制数组
        val data = readInputStream(inStream)
        // 获取指定字符集解码指定的字节数组构造一个新的字符串
        return String(data, Charsets.UTF_8)
    }

    // 读取输入流 获取 HTML 二进制数组
    fun readInputStream(inStream: InputStream): ByteArray {
        val outStream = ByteArrayOutputStream()
        val buffer = ByteArray(1024)
        var len: Int
        while (inStream.read(buffer).also { len = it } != -1) {
            outStream.write(buffer, 0, len)
        }
        inStream.close()
        return outStream.toByteArray()
    }

    // QQ群 key：qun.qq.com
    fun joinQQGroup(key: String): Boolean {
        val intent = Intent()
        intent.data = Uri.parse(
            "mqqopensdkapi://bizAgent/qm/qr?url=http%3A%2F%2Fqm.qq.com%2Fcgi-bin%2Fqm%2Fqr%3Ffrom%3Dapp%26p%3Dandroid%26jump_from%3Dwebapi%26k%3D" + key
        )
        return try {
            startActivity(intent)
            true
        } catch (e: Exception) {
            Toast.makeText(this, "未安装或版本不支持", Toast.LENGTH_SHORT).show()
            false
        }
    }

    fun isIgnoringBatteryOptimizations(context: Context?): Boolean {
        if (context == null) {
            return false
        }
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        if (powerManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return powerManager.isIgnoringBatteryOptimizations(context.packageName)
        }
        return false
    }

    /** 忽略电池优化 */
    fun ignoreBatteryOptimization(activity: Activity) {
        val powerManager = getSystemService(POWER_SERVICE) as? PowerManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && powerManager != null) {
            val hasIgnored = powerManager.isIgnoringBatteryOptimizations(activity.packageName)
            if (!hasIgnored) {
                try { // 先调用系统显示 电池优化权限
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                    intent.data = Uri.parse("package:" + activity.packageName)
                    startActivity(intent)
                } catch (e: Exception) { // 如果失败了则引导用户到电池优化界面
                    try {
                        val intent = Intent(Intent.ACTION_MAIN)
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        intent.addCategory(Intent.CATEGORY_LAUNCHER)
                        val cn = ComponentName.unflattenFromString("com.android.settings/.Settings\$HighPowerApplicationsActivity")
                        intent.component = cn
                        startActivity(intent)
                    } catch (ex: Exception) {
                        // 全部失败则说明没有电池优化功能
                    }
                }
            }
        }
    }

    /** 检测电池白名单权限 */
    private fun isIgnoringBatteryOptimizations(): Boolean {
        val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
        if (powerManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return powerManager.isIgnoringBatteryOptimizations(packageName)
        }
        return false
    }

    /** 打开电池白名单设置 */
    fun requestIgnoreBatteryOptimizations() {
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
            intent.data = Uri.parse("package:$packageName")
            startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (!isExit) {
                AlertDialog.Builder(this)
                    .setTitle("温馨提示：")
                    .setIcon(R.drawable.menu_exit)
                    .setMessage("确定退出程序吗？退出将无法正常监听!")
                    .setCancelable(false)
                    .setPositiveButton("确定") { _, _ -> exitApp() }
                    .setNegativeButton("取消", null)
                    .create()
                    .show()
            }
            return false
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        val inflater = menuInflater
        inflater.inflate(R.menu.main_menu, menu)
        // 尝试显示菜单图标（兼容华为 EMUI/Magic UI）
        enableMenuIcons(menu)
        return true
    }

    override fun onMenuOpened(featureId: Int, menu: Menu): Boolean {
        enableMenuIcons(menu)
        return super.onMenuOpened(featureId, menu)
    }

    /**
     * 通过反射启用菜单图标显示（Android 默认隐藏菜单图标）
     */
    private fun enableMenuIcons(menu: Menu?) {
        if (menu == null) return

        try {
            val className = menu.javaClass.simpleName
            if ("MenuBuilder" == className) {
                val method = menu.javaClass.getDeclaredMethod("setOptionalIconsVisible", Boolean::class.javaPrimitiveType)
                method.isAccessible = true
                method.invoke(menu, true)
                Log.d(TAG, "enableMenuIcons: 方法 1 成功 - MenuBuilder")
                return
            }
        } catch (e: Exception) {
            Log.w(TAG, "enableMenuIcons: 方法 1 失败", e)
        }

        try {
            for (i in 0 until menu.size()) {
                menu.getItem(i).setShowAsAction(MenuItem.SHOW_AS_ACTION_IF_ROOM)
            }
            Log.d(TAG, "enableMenuIcons: 方法 2 成功 - setShowAsAction")
        } catch (e: Exception) {
            Log.w(TAG, "enableMenuIcons: 方法 2 失败", e)
        }

        try {
            val method = menu.javaClass.getMethod("setGroupCheckable", Int::class.javaPrimitiveType, Boolean::class.javaPrimitiveType, Boolean::class.javaPrimitiveType)
            method.invoke(menu, 0, true, false)
            Log.d(TAG, "enableMenuIcons: 方法 3 成功 - setGroupCheckable")
        } catch (e: Exception) {
            Log.w(TAG, "enableMenuIcons: 方法 3 失败", e)
        }
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        val itemId = item.itemId

        // 群聊
        if (itemId == R.id.qun) {
            if (joinQQGroup("yy-t5uc2_M6gq66cqFFRDHR4LqQLPCAi")) {
                Toast.makeText(this, "正在跳转至反馈群...", Toast.LENGTH_SHORT).show()
            }
            return true
        }
        // 分享软件
        else if (itemId == R.id.share) {
            try {
                // 尝试获取当前应用的 APK 文件路径（兼容不同厂商）
                var apkPath = applicationInfo.sourceDir
                if (apkPath.isNullOrEmpty()) {
                    apkPath = applicationContext.packageCodePath
                }

                var canShareApk = true
                if (apkPath.isNullOrEmpty() || apkPath.contains("null")) {
                    Log.w(TAG, "APK 路径无效，将使用链接分享：$apkPath")
                    canShareApk = false
                } else {
                    val apkFile = File(apkPath)
                    if (!apkFile.exists() || !apkFile.canRead()) {
                        Log.w(TAG, "APK 文件不可访问，将使用链接分享：$apkPath")
                        canShareApk = false
                    } else {
                        try {
                            val shareIntent = Intent(Intent.ACTION_SEND)
                            shareIntent.type = "application/vnd.android.package-archive"
                            val apkUri = FileProvider.getUriForFile(
                                this, packageName + ".fileprovider", apkFile
                            )
                            shareIntent.putExtra(Intent.EXTRA_STREAM, apkUri)
                            shareIntent.putExtra(
                                Intent.EXTRA_TEXT,
                                getString(R.string.share_content, "https://github.com/Nanying666/Vmq-App-Optimized")
                            )
                            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            val chooser = Intent.createChooser(shareIntent, getString(R.string.share_content))
                            if (chooser != null) {
                                startActivity(chooser)
                                Toast.makeText(this, "请选择分享方式", Toast.LENGTH_SHORT).show()
                                return true
                            }
                        } catch (apkException: Exception) {
                            Log.e(TAG, "分享 APK 失败，将使用链接分享", apkException)
                            canShareApk = false
                        }
                    }
                }

                if (!canShareApk) {
                    shareDownloadLink()
                }
            } catch (e: Exception) {
                Log.e(TAG, "分享功能异常", e)
                Toast.makeText(this, "分享失败，请检查是否安装了社交应用", Toast.LENGTH_SHORT).show()
            }
            return true
        }
        // 打赏作者
        else if (itemId == R.id.support) {
            val fruits = arrayOf("微信打赏", "支付宝打赏")
            AlertDialog.Builder(this)
                .setIcon(R.drawable.pay)
                .setTitle("请选择打赏方式：")
                .setCancelable(true)
                .setItems(fruits) { _, which ->
                    val fs = fruits[which]
                    if (fs == "微信打赏") {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            // Android 10+ 使用 MediaStore 保存图片，无需存储权限
                            bitmap_image = BitmapFactory.decodeResource(resources, R.drawable.wxpay)
                            SaveImageUtils.fileSaveToPublic(this, "微信赞赏码", bitmap_image!!)
                            openWeixinToQE_Code(this)
                            Toast.makeText(this, "收款码已保存至相册,请选择相册收款码打赏~", Toast.LENGTH_LONG).show()
                        } else if (pdPermissions()) {
                            bitmap_image = BitmapFactory.decodeResource(resources, R.drawable.wxpay)
                            SaveImageUtils.fileSaveToPublic(this, "微信赞赏码", bitmap_image!!)
                            openWeixinToQE_Code(this)
                            Toast.makeText(this, "收款码已保存至相册,请选择相册收款码打赏~", Toast.LENGTH_LONG).show()
                        } else {
                            requestMyPermissions()
                        }
                    } else if (fs == "支付宝打赏") {
                        openAliPayPay(ALIPAY_PERSON)
                    }
                }
                .create()
                .show()
            return true
        }
        // 关于
        else if (itemId == R.id.about) {
            AlertDialog.Builder(this)
                .setIcon(R.drawable.menu_gy)
                .setTitle("关于本软件：")
                .setCancelable(false)
                .setMessage(
                    "简介：\n这是一款基于V免签开发的免签支付接口App监控端\n" +
                        "修复了原版监控支付宝不回调等BUG长期维护并提供个人免费使用\n" +
                        "在您使用本软件前请注意：\n该软件版权归作者所有请勿破解倒卖本软件\n" +
                        "部分申请的权限是必要的拒绝将导致监控功能失效\n" +
                        "喜欢本项目就赞助一下开发者吧~\n" +
                        "PS：使用本软件建议开启软件自启动权限！各大厂商手机自行百度寻找答案\n\n" +
                        "App使用协议：\n\n说明：\n" +
                        "该软件由作者十年开发并提供技术服务支持并发布免费使用\n" +
                        "1、所有用户在下载并浏览V免签监控端_Pro时均被视为已经仔细阅读本条款并完全同意。\n" +
                        "2、软件完全免费可自由使用学习并分享，您可以将它分享给您的朋友们使用。\n" +
                        "3、使用该软件应当遵守法律法规若侵犯了第三方知识产权或其他权益需本人承担全部责任。\n作者对此不承担任何责任。\n" +
                        "4、V免签监控端_Pro需要获取一定的应用权限例如内存读写，通知监听等请务必开启权限否则软件无法正常运行。\n" +
                        "5、如果您使用的是盗版软件，出现的一切风险作者对此不承担任何责任。\n" +
                        "6、用户明确并同意因其使用本App而产生的一切后果由其本人承担，作者对此不承担任何责任。\n" +
                        "7、我们深知个人信息对您的重要性，并会尽全力保护您的个人信息安全可靠。\n\n" +
                        "\"确保您已同意以上协议否则请卸载本软件！\"\n\n联系作者反馈请到设置项~"
                )
                .setNegativeButton("不同意协议") { _, _ -> System.exit(0) }
                .setPositiveButton("已阅读并同意", null)
                .setNeutralButton("配置文档") { _, _ ->
                    startActivity(Intent(this, HelpActivity::class.java))
                }
                .create()
                .show()
            return true
        }
        // 权限检查
        if (itemId == R.id.perm_check) {
            val missing = PermissionGuideHelper.checkMissingPermissions(this)
            PermissionGuideHelper.showPermissionGuideDialog(this, missing, true)
            return true
        }
        // 设置
        else if (itemId == R.id.setting) {
            startActivity(Intent(this, SettingActivity::class.java))
            return true
        }
        // 退出程序
        else if (itemId == R.id.exit) {
            exitApp()
            return true
        }

        return super.onOptionsItemSelected(item)
    }

    /** 分享下载链接（降级方案） */
    private fun shareDownloadLink() {
        try {
            val shareIntent = Intent(Intent.ACTION_SEND)
            shareIntent.type = "text/plain"
            val shareText = getString(R.string.share_content, "https://github.com/Nanying666/Vmq-App-Optimized")
            shareIntent.putExtra(Intent.EXTRA_TEXT, shareText)
            val chooser = Intent.createChooser(shareIntent, getString(R.string.share_content))
            if (chooser != null) {
                startActivity(chooser)
                Toast.makeText(this, "将分享下载链接", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            Log.e(TAG, "分享链接失败", e)
            Toast.makeText(this, "分享失败", Toast.LENGTH_SHORT).show()
        }
    }

    /** 支付宝支付 打赏功能 */
    private fun openAliPayPay(qrCode: String) {
        if (openAlipayPayPage(this, qrCode)) {
            Toast.makeText(this, "正在打开...", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "支付宝打开失败，请检查是否安装支付宝！", Toast.LENGTH_SHORT).show()
        }
    }

    // 发送一个 intent
    private fun openUri(context: Context, s: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(s))
        context.startActivity(intent)
    }

    // 打赏功能：fileName 为文件路径名称 返回 true 为存在
    fun fileIsExists(fileName: String): Boolean {
        return try {
            val f = File(fileName)
            if (f.exists()) {
                Log.i("测试", "有这个文件")
                true
            } else {
                Log.i("测试", "没有这个文件")
                false
            }
        } catch (e: Exception) {
            Log.i("测试", "崩溃")
            false
        }
    }

    /**
     * 保存图片到本地（仅支持 Android 10 以下）
     * @param name 图片的名字，比如传入“123”，最终保存的图片为“123.jpg”
     * @param bitmap 本地图片或者网络图片转成的 Bitmap 格式的文件
     */
    fun saveImage(name: String, bitmap: Bitmap) {
        val pathFile = File(
            Environment.getExternalStorageDirectory().toString() + File.separator +
                Environment.DIRECTORY_PICTURES + File.separator
        )
        if (!pathFile.exists()) {
            pathFile.mkdir()
        }
        val file = File(pathFile, "$name.jpg")
        try {
            val fos = FileOutputStream(file)
            bitmap.compress(Bitmap.CompressFormat.JPEG, 100, fos)
            fos.flush()
            fos.close()
            val localUri = Uri.fromFile(file)
            sendBroadcast(Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, localUri))
        } catch (e: IOException) {
            e.printStackTrace()
        }
    }

    // 打开支付宝扫一扫
    fun AliPay(context: Context) {
        try {
            val uri = Uri.parse("alipayqr://platformapi/startapp?saId=10000007")
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (e: Exception) {
            Toast.makeText(context, "无法跳转到支付宝，请检查是否安装了支付宝", Toast.LENGTH_LONG).show()
        }
    }

    /** 打开微信并跳入到二维码扫描页面（方法一） */
    fun openWeixinToQE_Code(context: Context) {
        try {
            val intent = context.packageManager.getLaunchIntentForPackage("com.tencent.mm")!!
            intent.putExtra("LauncherUI.From.Scaner.Shortcut", true)
            intent.action = "android.intent.action.VIEW"
            intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "无法跳转到微信，请检查是否安装了微信", Toast.LENGTH_LONG).show()
        }
    }

    // 打开微信扫一扫方法二
    fun toWeChatScanDirect(context: Context) {
        try {
            val intent = Intent()
            intent.component = ComponentName("com.tencent.mm", "com.tencent.mm.ui.LauncherUI")
            intent.putExtra("LauncherUI.From.Scaner.Shortcut", true)
            intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            intent.action = "android.intent.action.VIEW"
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "无法跳转到微信，请检查是否安装了微信", Toast.LENGTH_LONG).show()
        }
    }

    /** 判断用户是否安装 QQ 客户端 */
    fun isQQClientAvailable(context: Context): Boolean {
        val packageManager = context.packageManager
        val pinfo = packageManager.getInstalledPackages(0)
        if (pinfo != null) {
            for (i in pinfo.indices) {
                val pn = pinfo[i].packageName
                if (pn.equals("com.tencent.qqlite", ignoreCase = true) ||
                    pn.equals("com.tencent.mobileqq", ignoreCase = true)
                ) {
                    return true
                }
            }
        }
        return false
    }

    /** 判断 Uri 是否有效 */
    fun isValidIntent(context: Context, intent: Intent): Boolean {
        val packageManager = context.packageManager
        val activities = packageManager.queryIntentActivities(intent, 0)
        return activities.isNotEmpty()
    }

    /** 复制内容到剪切板 */
    private fun copyStr(copyStr: String): Boolean {
        return try {
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val mClipData = ClipData.newPlainText("Label", copyStr)
            cm.setPrimaryClip(mClipData)
            true
        } catch (e: Exception) {
            false
        }
    }

    /**************************************************************************/
    // 后台管理
    fun admin_url(v: View?) {
        val url = txthost!!.text.toString()
        if (url == "通知地址：请手动配置") {
            Toast.makeText(this, "请先配置数据！", Toast.LENGTH_LONG).show()
        } else {
            val Url = url.substring(6)
            val intent_d = Intent()
            intent_d.action = "android.intent.action.VIEW"
            intent_d.data = Uri.parse("http://$Url")
            startActivity(intent_d)
        }
    }

    // 扫码配置
    fun startQrCode(v: View?) {
        // 申请相机权限
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), AppConstants.REQ_PERM_CAMERA)
            return
        }
        // 文件读写权限：仅 Android 12L 及以下需要申请（Android 13+ 已废弃）
        if (Build.VERSION.SDK_INT <= 32) {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE), AppConstants.REQ_PERM_EXTERNAL_STORAGE)
                return
            }
        }
        // 二维码扫码
        startActivityForResult(Intent(this, CaptureActivity::class.java), AppConstants.REQ_QR_CODE)
    }

    /** 扫码结果处理 */
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == AppConstants.REQ_QR_CODE && resultCode == RESULT_OK) {
            val bundle = data!!.extras
            val scanResult = bundle?.getString(AppConstants.INTENT_EXTRA_KEY_QR_SCAN) ?: ""

            val tmp = scanResult.split("/")
            if (tmp.size != 2) {
                Toast.makeText(this, "二维码错误，请您扫描网站上显示的二维码!", Toast.LENGTH_SHORT).show()
                return
            }

            val t = Date().time.toString()
            val sign = md5(t + tmp[1])

            NetworkClient.getWithRetry(tmp[0], "/appHeart?t=$t&sign=$sign", object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    Log.d(TAG, "配置验证请求失败: " + (e.message ?: ""))
                }

                override fun onResponse(call: Call, response: Response) {
                    Log.d(TAG, "onResponse: " + response.body?.string())
                    isOk = true
                }
            })

            ignoreBatteryOptimization(this)
            txthost!!.text = " 通知地址：" + tmp[0]
            txtkey!!.text = " 通讯密钥：" + tmp[1]
            host = tmp[0]
            key = tmp[1]

            getSharedPreferences("shinian", MODE_PRIVATE).edit()
                .putString("host", host)
                .putString("key", key)
                .commit()
            ChannelManager.reset(this) // 主通道配置变更→重置双通道切换状态，从主通道重新探活
        }
    }

    // 手动配置
    fun doInput(v: View?) {
        val inputServer = EditText(this)
        AlertDialog.Builder(this)
            .setTitle("请输入配置数据")
            .setView(inputServer)
            .setIcon(R.drawable.icon_pzsj)
            .setCancelable(false)
            .setNeutralButton("如何配置?") { _, _ ->
                startActivity(Intent(this, HelpActivity::class.java))
            }
            .setNegativeButton("取消", null)
            .setPositiveButton("确认") { _, _ ->
                val scanResult = inputServer.text.toString()
                val tmp = scanResult.split("/")
                if (tmp.size != 2) {
                    Toast.makeText(this, "数据不能为空或数据错误!", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }

                val t = Date().time.toString()
                val sign = md5(t + tmp[1])

                NetworkClient.getWithRetry(tmp[0], "/appHeart?t=$t&sign=$sign", object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        Log.d(TAG, "配置验证请求失败: " + (e.message ?: ""))
                    }

                    override fun onResponse(call: Call, response: Response) {
                        Log.d(TAG, "onResponse: " + response.body?.string())
                        isOk = true
                    }
                })

                if (tmp[0].contains("localhost")) {
                    Toast.makeText(
                        this,
                        "配置信息错误，本机调试请访问 本机局域网IP:8080(如192.168.1.101:8080) 获取配置信息进行配置!",
                        Toast.LENGTH_LONG
                    ).show()
                    return@setPositiveButton
                }
                ignoreBatteryOptimization(this)
                txthost!!.text = " 通知地址：" + tmp[0]
                txtkey!!.text = " 通讯密钥：" + tmp[1]
                host = tmp[0]
                key = tmp[1]

                getSharedPreferences("shinian", MODE_PRIVATE).edit()
                    .putString("host", host)
                    .putString("key", key)
                    .commit()
                ChannelManager.reset(this)
            }
            .show()
    }

    // 检测心跳
    fun doStart(view: View?) {
        if (!isOk) {
            Toast.makeText(this, "请您先配置!", Toast.LENGTH_SHORT).show()
            return
        }

        val t = Date().time.toString()

        // 双通道：手动心跳检测也用当前最可用 host+key（sign 必须用对应 key）
        val ch = ChannelManager.resolve(this)
        val activeHost = if (ch[0].isEmpty()) host else ch[0]
        val activeKey = ch[1]
        val sign = md5(t + activeKey)

        val path = "/appHeart?t=$t&sign=$sign"
        NetworkClient.getWithRetry(activeHost, path, object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                // 记账：驱动主/备切换
                ChannelManager.recordMainFailure(this@MainActivity)
                val error = e.message ?: "未知错误"
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "心跳状态错误，请检查配置是否正确!\n$error", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                ChannelManager.recordMainSuccess(this@MainActivity)
                try {
                    val str = response.body?.string() ?: ""
                    val result = JSONObject(str)
                    val code = result.getInt("code")
                    val msg = result.getString("msg")
                    if (code == 1 && msg == "成功") {
                        sendMonitorLogs(now() + "\r\r\r\r" + "心跳返回：" + msg)
                    } else {
                        sendMonitorLogs(now() + "\r\r\r\r" + "心跳返回错误：" + msg)
                    }
                } catch (e: JSONException) {
                    sendMonitorLogs(now() + "\r\r\r\r" + "心跳错误：" + e.message)
                }
            }
        })
    }

    /** 双通道故障切换：配置可选备用通道（host2/key2） */
    fun doBackup(v: View?) {
        val inputBackup = EditText(this)
        inputBackup.hint = "备用地址/备用密钥（格式同主通道：host/key）"
        inputBackup.setText(ChannelManager.resolveBackupDefault(this))
        AlertDialog.Builder(this)
            .setTitle("备用通道配置（可选）")
            .setMessage("填入备用服务器地址/密钥后，主通道连续失败达阈值时自动切换；主通道恢复后自动回切。留空则退化为单通道，行为与旧版完全一致。")
            .setView(inputBackup)
            .setIcon(R.drawable.icon_pzsj)
            .setNegativeButton("取消", null)
            .setPositiveButton("保存") { _, _ ->
                val value = inputBackup.text.toString().trim()
                var h2 = ""
                var k2 = ""
                if (value.isNotEmpty()) {
                    val parts = value.split("/")
                    if (parts.size != 2) {
                        Toast.makeText(this, "备用通道数据错误，格式应为 host/key!", Toast.LENGTH_SHORT).show()
                        return@setPositiveButton
                    }
                    h2 = parts[0].trim()
                    k2 = parts[1].trim()
                }
                ChannelManager.saveBackup(this, h2, k2)
                ChannelManager.reset(this)
                updateBackupStateView()
                Toast.makeText(
                    this,
                    if (h2.isEmpty()) "已清除备用通道（退化为单通道）" else "备用通道已保存",
                    Toast.LENGTH_SHORT
                ).show()
            }
            .show()
    }

    // 刷新备用通道状态显示
    private fun updateBackupStateView() {
        runOnUiThread {
            if (txtBackupState == null) return@runOnUiThread
            txtBackupState!!.text = if (ChannelManager.hasBackup(this)) {
                "通道状态：" + ChannelManager.activeName(this) + "（已配置备用）"
            } else {
                "通道状态：主通道（未配置备用）"
            }
        }
    }

    fun checkPush(v: View?) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        if (notificationManager == null) {
            Toast.makeText(this, "通知服务不可用", Toast.LENGTH_SHORT).show()
            return
        }
        createNotificationChannel(notificationManager)
        val notification = buildTestNotification()
        val notificationId = id++
        if (notificationId > MAX_NOTIFICATION_ID) {
            id = 0
        }
        notificationManager.notify(notificationId, notification)
        // 不要在这里直接发送日志，等待 NotificationListenerService 回调处理，避免日志重复显示
    }

    /** 创建通知渠道（Android O 及以上必需） */
    private fun createNotificationChannel(notificationManager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                NOTIFICATION_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT
            )
            channel.enableLights(true)
            channel.lightColor = Color.GREEN
            channel.setShowBadge(true)
            notificationManager.createNotificationChannel(channel)
        }
    }

    /** 构建测试通知 */
    private fun buildTestNotification(): Notification {
        val title = "V免签测试推送"
        val content = "测试推送通知，如果程序正常，则会提示监听权限正常"

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, NOTIFICATION_CHANNEL_ID).apply {
                setSmallIcon(R.drawable.ic_launcher)
                setContentTitle(title)
                setContentText(content)
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                    @Suppress("DEPRECATION")
                    setTicker("测试推送信息，如果程序正常，则会提示监听权限正常")
                }
            }.build()
        } else {
            Notification.Builder(this).apply {
                setSmallIcon(R.drawable.ic_launcher)
                setContentTitle(title)
                setContentText(content)
                @Suppress("DEPRECATION")
                setTicker("测试推送信息，如果程序正常，则会提示监听权限正常")
            }.build()
        }
    }

    // 清除所有日志
    fun Logs(v: View?) {
        runOnUiThread {
            getSharedPreferences("items", MODE_PRIVATE).edit()
                .putString("logsStr", "")
                .commit()
            LogsTextView!!.text = "日志：null"
        }
    }

    // 获取电量 onClick
    fun dl(v: View?) {
        val manager = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        capacity = manager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 0
        sj_dl!!.text = "当前电量：$capacity%"
    }

    // 联系作者
    fun author(v: View?) {
        if (isQQClientAvailable(this)) {
            val url = "mqqwpa://im/chat?chat_type=wpa&uin=1614790395"
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            if (isValidIntent(this, intent)) {
                startActivity(intent)
            }
        }
    }

    // 打开作者网站
    fun openAuthorWebsite(v: View?) {
        try {
            val intent = Intent(Intent.ACTION_VIEW)
            intent.data = Uri.parse("https://github.com/Nanying666/Vmq-App-Optimized")
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "无法打开网页，请检查浏览器设置", Toast.LENGTH_SHORT).show()
        }
    }

    // 监听日志
    private fun sendMonitorLogs(msgStr: String) {
        val read = getSharedPreferences("items", MODE_PRIVATE)
        var logsStr = read.getString("logsStr", "") ?: ""
        val logsStrs = logsStr.split("\n")
        if (logsStrs.size > 20) {
            logsStr = logsStr.substring(0, logsStr.lastIndexOf("\n"))
            logsStr = logsStr.substring(0, logsStr.lastIndexOf("\n"))
        }
        logsStr = "$msgStr\n$logsStr"
        getSharedPreferences("items", MODE_PRIVATE).edit()
            .putString("logsStr", logsStr)
            .apply()

        val msg = Message()
        msg.what = 0
        val bundle = Bundle()
        bundle.putString("logsStr", logsStr)
        msg.data = bundle
        monitorLogHandler.sendMessage(msg)
    }

    // 复制监听日志内容到剪贴板
    override fun onLongClick(v: View): Boolean {
        if (v.id == R.id.state_logs) {
            copyStr(LogsTextView!!.text.toString())
            Toast.makeText(application, "Log日志已复制到剪贴板！", Toast.LENGTH_LONG).show()
        }
        return true
    }

    // MD5 取值（委托统一实现 Md5.hex，保持方法签名以兼容既有调用点）
    fun md5(string: String?): String = Md5.hex(string)

    // 判断读写权限
    private fun pdPermissions(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
    }

    // 动态申请读写权限
    private fun requestMyPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), 100)
        } else {
            Log.d(TAG, "requestMyPermissions: 有写SD权限")
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), 100)
        } else {
            Log.d(TAG, "requestMyPermissions: 有写SD权限")
        }
    }

    // 重启监听服务
    private fun toggleNotificationListenerService(context: Context) {
        val pm = context.packageManager
        pm.setComponentEnabledSetting(
            ComponentName(context, PayNotificationListenerService::class.java),
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP
        )
        pm.setComponentEnabledSetting(
            ComponentName(context, PayNotificationListenerService::class.java),
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP
        )
    }

    // 是否获取通知监听权限
    fun isNotificationListenersEnabled(): Boolean {
        val pkgName = packageName
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        if (!TextUtils.isEmpty(flat)) {
            val names = flat!!.split(":")
            for (name in names) {
                val cn = ComponentName.unflattenFromString(name)
                if (cn != null) {
                    if (TextUtils.equals(pkgName, cn.packageName)) {
                        return true
                    }
                }
            }
        }
        return false
    }

    /** 是否启用通知监听服务 */
    fun isNLServiceEnabled(): Boolean {
        val packageNames = NotificationManagerCompat.getEnabledListenerPackages(this)
        return packageNames.contains(packageName)
    }

    // 跳转到通知监听设置页面
    protected fun gotoNotificationAccessSetting(): Boolean {
        try {
            val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
            return true
        } catch (e: ActivityNotFoundException) {
            // 普通情况下找不到的时候需要再特殊处理找一次
            try {
                val intent = Intent()
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                val cn = ComponentName(
                    "com.android.settings",
                    "com.android.settings.Settings\$NotificationAccessSettingsActivity"
                )
                intent.component = cn
                intent.putExtra(":settings:show_fragment", "NotificationAccessSettings")
                startActivity(intent)
                return true
            } catch (e1: Exception) {
                e1.printStackTrace()
            }
            Toast.makeText(this, "对不起，您的手机暂不支持", Toast.LENGTH_SHORT).show()
            e.printStackTrace()
            return false
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, @NonNull permissions: Array<String>, @NonNull grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            AppConstants.REQ_PERM_CAMERA ->
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    startQrCode(null)
                } else {
                    showPermissionDeniedDialog("相机权限", "扫码配置需要使用摄像头")
                }
            AppConstants.REQ_PERM_EXTERNAL_STORAGE ->
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    startQrCode(null)
                } else {
                    showPermissionDeniedDialog("文件读写权限", "相册选图与保存收款码需要读取文件")
                }
        }
    }

    /** 权限被拒后的引导弹窗：点击「去开启」直达本应用的应用详情权限页 */
    private fun showPermissionDeniedDialog(permName: String, reason: String) {
        AlertDialog.Builder(this)
            .setTitle("需要$permName")
            .setMessage("$reason。\n\n点击「去开启」打开系统权限设置页，开启后返回即可继续。")
            .setCancelable(true)
            .setPositiveButton("去开启") { _, _ ->
                PermissionGuideHelper.openAppDetailsSettings(this)
            }
            .setNegativeButton("取消", null)
            .show()
    }

    // 获取当前应用的版本名（展示给消费者的版本号）
    private fun getAppVersionName(): String {
        val packageManager = packageManager
        var packInfo: PackageInfo? = null
        try {
            packInfo = packageManager.getPackageInfo(packageName, 0)
        } catch (e: PackageManager.NameNotFoundException) {
            e.printStackTrace()
        }
        return packInfo!!.versionName
    }

    private fun checkQQInstalled(context: Context, pkgName: String): Boolean {
        if (TextUtils.isEmpty(pkgName)) {
            return false
        }
        return try {
            context.packageManager.getPackageInfo(pkgName, 0)
            true
        } catch (x: Exception) {
            false
        }
    }

    // 主题
    private fun setGraySheme(gray: Int) {
        val decorView = window.decorView
        val paint = Paint()
        val cm = ColorMatrix()
        cm.setSaturation(gray.toFloat()) // 灰度效果 取值 gray（0 - 1）0 是灰色，1 取消灰色
        paint.colorFilter = ColorMatrixColorFilter(cm)
        decorView.setLayerType(View.LAYER_TYPE_HARDWARE, paint)
    }

    companion object {
        private const val TAG = "MainActivity"

        private var host: String = ""
        private var key: String = ""

        @JvmField
        var LogsTextView: TextView? = null

        /** 监听日志接收参数（供 PayNotificationListenerService 发送日志） */
        @JvmField
        val monitorLogHandler: Handler = object : Handler(Looper.getMainLooper()) {
            override fun handleMessage(msg: Message) {
                if (LogsTextView != null) {
                    LogsTextView!!.text = msg.data.getString("logsStr")
                }
            }
        }

        private const val ALIPAY_PERSON = "https://qr.alipay.com/fkx12542rpb5fljmhxlal35"

        // 通知渠道常量
        private const val NOTIFICATION_CHANNEL_ID = "vmq_test_channel"
        private const val NOTIFICATION_CHANNEL_NAME = "V免签测试通知"
        private const val MAX_NOTIFICATION_ID = 1000 // 防止 ID 无限增长

        // 点击两次退出
        @JvmStatic
        var isExit: Boolean = false

        /** 当前时间字符串（yyyy-MM-dd HH:mm:ss），统一日志时间格式 */
        private fun now(): String =
            java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.getDefault())
                .format(Date())

        @JvmStatic
        fun openAlipayPayPage(context: Context, qrcode: String): Boolean {
            var qr = qrcode
            try {
                qr = URLEncoder.encode(qr, "utf-8")
            } catch (e: Exception) {
            }
            return try {
                val alipayqr = "alipayqr://platformapi/startapp?saId=10000007&clientVersion=3.7.0.0718&qrcode=" + qr
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(alipayqr + "%3F_s%3Dweb-other&_t=" + System.currentTimeMillis()))
                context.startActivity(intent)
                true
            } catch (e: Exception) {
                e.printStackTrace()
                false
            }
        }
    }
}