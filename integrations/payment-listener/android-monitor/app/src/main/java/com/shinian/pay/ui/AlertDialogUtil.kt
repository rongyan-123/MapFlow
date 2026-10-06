package com.shinian.pay.ui

import android.app.AlertDialog
import android.content.Context
import android.content.DialogInterface

/**
 * AlertDialog 工具类（Kotlin 版，Java 调用点 API 保持不变）。
 */
object AlertDialogUtil {

    /**
     * 显示简单的提示对话框。
     *
     * @param context 上下文
     * @param title 标题
     * @param message 消息内容
     */
    @JvmStatic
    fun showAlertDialog(context: Context, title: String?, message: String?) {
        AlertDialog.Builder(context)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("确定", null)
            .setCancelable(true)
            .show()
    }

    /**
     * 显示带取消按钮的对话框。
     *
     * @param context 上下文
     * @param title 标题
     * @param message 消息内容
     * @param positiveText 确认按钮文字
     * @param negativeText 取消按钮文字
     * @param positiveListener 确认按钮监听器
     */
    @JvmStatic
    fun showAlertDialog(
        context: Context,
        title: String?,
        message: String?,
        positiveText: String?,
        negativeText: String?,
        positiveListener: DialogInterface.OnClickListener?
    ) {
        AlertDialog.Builder(context)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton(positiveText, positiveListener)
            .setNegativeButton(negativeText, null)
            .setCancelable(true)
            .show()
    }
}