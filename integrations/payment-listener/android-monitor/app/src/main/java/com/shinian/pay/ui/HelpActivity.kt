package com.shinian.pay.ui

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.shinian.pay.R

/**
 * 帮助页（Kotlin 版）。
 */
class HelpActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 隐藏系统标题栏
        supportActionBar?.hide()

        setContentView(R.layout.activity_help)

        // 设置返回按钮点击事件
        findViewById<View?>(R.id.btn_back)?.setOnClickListener {
            finish() // 返回上一层
        }
    }
}