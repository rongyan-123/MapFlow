package com.shinian.pay.util

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.widget.Toast
import java.io.File
import java.io.FileNotFoundException
import java.io.FileOutputStream
import java.io.IOException
import java.io.OutputStream

/**
 * 本地图片保存类（Kotlin 版，Java 调用点 API 保持不变）。
 */
object SaveImageUtils {

    /** 仅适用于 Android 10 以下 */
    @JvmStatic
    fun saveImageToGallery(context: Context, bmp: Bitmap) {
        // 首先保存图片
        val appDir = File(Environment.getExternalStorageDirectory(), "Pictures")
        if (!appDir.exists()) {
            appDir.mkdir()
        }
        val fileName = System.currentTimeMillis().toString() + ".jpg"
        val file = File(appDir, fileName)
        try {
            val fos = FileOutputStream(file)
            bmp.compress(Bitmap.CompressFormat.JPEG, 100, fos)
            fos.flush()
            fos.close()
        } catch (e: FileNotFoundException) {
            e.printStackTrace()
        } catch (e: IOException) {
            e.printStackTrace()
        }

        // 其次把文件插入到系统图库
        try {
            MediaStore.Images.Media.insertImage(context.contentResolver, file.absolutePath, fileName, null)
        } catch (e: FileNotFoundException) {
            e.printStackTrace()
        }
        // 最后通知图库更新
        context.sendBroadcast(Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, Uri.parse("file://" + file.path)))
    }

    @JvmStatic
    fun saveImageToGallerys(context: Context, bmp: Bitmap?) {
        if (bmp == null) {
            Toast.makeText(context, "保存出错了...", Toast.LENGTH_SHORT).show()
            return
        }
        // 首先保存图片
        val appDir = File(Environment.getExternalStorageDirectory(), "Boohee")
        if (!appDir.exists()) {
            appDir.mkdir()
        }
        val fileName = System.currentTimeMillis().toString() + ".jpg"
        val file = File(appDir, fileName)
        try {
            val fos = FileOutputStream(file)
            bmp.compress(Bitmap.CompressFormat.JPEG, 100, fos)
            fos.flush()
            fos.close()
        } catch (e: FileNotFoundException) {
            Toast.makeText(context, "文件未发现...", Toast.LENGTH_SHORT).show()
            e.printStackTrace()
        } catch (e: IOException) {
            Toast.makeText(context, "保存出错了...", Toast.LENGTH_SHORT).show()
            e.printStackTrace()
        } catch (e: Exception) {
            Toast.makeText(context, "保存出错了...", Toast.LENGTH_SHORT).show()
            e.printStackTrace()
        }

        // 最后通知图库更新
        try {
            MediaStore.Images.Media.insertImage(context.contentResolver, file.absolutePath, fileName, null)
        } catch (e: FileNotFoundException) {
            e.printStackTrace()
        }
        val intent = Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE)
        intent.data = Uri.fromFile(file)
        context.sendBroadcast(intent)
        Toast.makeText(context, "保存出错了...", Toast.LENGTH_SHORT).show()
    }

    /**
     * 适用 Android 10 及以上：保存文件到公共目录。
     *
     * @param context 上下文
     * @param fileName 文件名
     * @param bitmap 文件
     * @return 路径，为空时表示保存失败
     */
    @JvmStatic
    fun fileSaveToPublic(context: Context, fileName: String, bitmap: Bitmap): String? {
        var path: String? = null

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            // Android 10 以下版本
            var fos: FileOutputStream? = null
            // 设置路径 Pictures/
            val folder = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
            try {
                if (folder.exists() || folder.mkdir()) {
                    val file = File(folder, fileName)
                    fos = FileOutputStream(file)
                    // 写入文件
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, fos)
                    fos.flush()
                    path = file.absolutePath
                }
            } catch (e: IOException) {
                e.printStackTrace()
            } finally {
                if (fos != null) {
                    try {
                        fos.close()
                    } catch (e: IOException) {
                        e.printStackTrace()
                    }
                }
            }
            // 创建文件路径
            val file = File(folder, fileName)
            // 最后通知图库更新
            context.sendBroadcast(Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, Uri.parse("file://" + file.path)))
        } else {
            // Android 10 及以上版本
            val folder = Environment.DIRECTORY_PICTURES
            val values = ContentValues()
            values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            values.put(MediaStore.Images.Media.RELATIVE_PATH, folder)
            // EXTERNAL_CONTENT_URI 代表外部存储器，该值不变
            val uri = context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
            var os: OutputStream? = null
            try {
                if (uri != null) {
                    val out = context.contentResolver.openOutputStream(uri)
                    if (out != null) {
                        os = out
                        bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
                        out.flush()
                        path = uri.path
                    }
                }
            } catch (e: IOException) {
                e.printStackTrace()
            } finally {
                if (os != null) {
                    try {
                        os.close()
                    } catch (e: IOException) {
                        e.printStackTrace()
                    }
                }
            }
        }
        return path
    }
}