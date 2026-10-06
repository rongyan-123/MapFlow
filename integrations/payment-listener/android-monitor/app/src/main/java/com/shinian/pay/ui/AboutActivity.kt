package com.shinian.pay.ui

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.method.ScrollingMovementMethod
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.shinian.pay.R
import java.io.BufferedReader
import java.io.IOException
import java.io.InputStreamReader

/**
 * 关于软件文档阅读界面（Kotlin 版）。
 */
class AboutActivity : AppCompatActivity() {

    private lateinit var versionNameView: TextView
    private lateinit var versionCodeView: TextView
    private lateinit var contentView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_about)

        // 隐藏标题栏
        supportActionBar?.hide()

        // 查找视图并设置返回按钮点击事件
        findViewById<View?>(R.id.btn_back)?.setOnClickListener { finish() }

        versionNameView = findViewById(R.id.about_version_name)
        versionCodeView = findViewById(R.id.about_version_code)
        contentView = findViewById(R.id.about_content)

        // 设置文本可滚动
        contentView.movementMethod = ScrollingMovementMethod.getInstance()

        // 设置版本信息
        setVersionInfo()

        // 加载并显示文档内容
        loadDocumentContent()
    }

    /**
     * 设置版本信息
     */
    private fun setVersionInfo() {
        try {
            val packageManager = packageManager
            val packInfo = packageManager.getPackageInfo(packageName, 0)

            val versionName = packInfo.versionName
            val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packInfo.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                packInfo.versionCode.toLong()
            }

            versionNameView.text = "V$versionName"
            versionCodeView.text = "版本号：$versionCode"
        } catch (e: PackageManager.NameNotFoundException) {
            versionNameView.text = "未知版本"
            versionCodeView.text = "版本号：未知"
            e.printStackTrace()
        }
    }

    /**
     * 加载文档内容
     */
    private fun loadDocumentContent() {
        val content = StringBuilder()

        try {
            // 从 assets 读取简略文档
            val inputStream = assets.open("about_vmapp.txt")
            val reader = BufferedReader(InputStreamReader(inputStream, "UTF-8"))

            var line: String?
            while (reader.readLine().also { line = it } != null) {
                content.append(line).append("\n")
            }

            reader.close()
            inputStream.close()

            // 设置文本内容
            contentView.text = content.toString()
        } catch (e: IOException) {
            // 如果 assets 中没有，显示默认内容
            contentView.text = getDefaultAboutContent()
            e.printStackTrace()
        }
    }

    /**
     * 获取默认的关于内容
     */
    private fun getDefaultAboutContent(): String {
        return "【V 免签监控端_Pro】\n\n" +
            "一款基于 V 免签开发的 Android 收款监听应用\n\n" +
            "【核心功能】\n" +
            "• 双平台监听：支持支付宝和微信收款通知监听\n" +
            "• 智能回调：匹配服务端订单金额后自动触发回调\n" +
            "• 日志面板：实时查看监听日志和回调记录\n" +
            "• 店员管理：支持店员监听功能\n" +
            "• 持久运行：电池白名单保护，后台稳定运行\n" +
            "• 性能优化：精简代码结构，启动速度提升\n\n" +
            "【技术信息】\n" +
            "开发语言：Java + Kotlin + XML\n" +
            "目标平台：Android 5.0+ (API 21)\n" +
            "构建工具：Gradle 8.12.0\n\n" +
            "【开发者信息】\n" +
            "开发者：十年\n" +
            "邮箱：shiniana@qq.com\n" +
            "QQ 群：yy-t5uc2_M6gq66cqFFRDHR4LqQLPCAi\n\n" +
            "GitHub: https://github.com/Nanying666/Vmq-App-Optimized\n\n" +
            "【版权声明】\n" +
            "Copyright © 2022 decade · 版权所有\n\n" +
            "本项目基于 V 免签开发，感谢原作者的贡献。\n\n" +
            "【使用协议】\n" +
            "1. 本软件仅供学习交流使用\n" +
            "2. 请勿将本软件用于非法用途\n" +
            "3. 使用本软件产生的任何责任由使用者承担\n" +
            "4. 请遵守当地法律法规"
    }

    /**
     * 点击访问 GitHub（XML android:onClick 绑定）
     */
    fun openGitHub(v: View?) {
        try {
            val intent = Intent(Intent.ACTION_VIEW)
            intent.data = Uri.parse("https://github.com/Nanying666/Vmq-App-Optimized")
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "无法打开浏览器", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * 点击联系开发者（XML android:onClick 绑定）
     */
    fun contactDeveloper(v: View?) {
        try {
            AlertDialogUtil.showAlertDialog(
                this, "联系方式",
                "邮箱：shiniana@qq.com\n" +
                    "QQ 群：https://qm.qq.com/q/ESWRuTY6uk\n\n" +
                    "如有任何问题或建议，欢迎联系！"
            )
        } catch (e: Exception) {
            Toast.makeText(this, "显示失败", Toast.LENGTH_SHORT).show()
        }
    }
}
