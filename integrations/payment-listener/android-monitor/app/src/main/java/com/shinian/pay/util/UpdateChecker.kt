package com.shinian.pay.util

import android.util.Log
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

/**
 * 版本更新检查器。
 *
 * 数据源改为**本仓库的 GitHub Releases**（原实现指向第三方私有接口，
 * 依赖 `POST ver=xxx` 并返回自定义 JSON，无法迁移到 GitHub）。
 *
 * 当前仓库：https://github.com/Nanying666/Vmq-App-Optimized
 *
 * 说明：
 * - 使用 GitHub REST `releases/latest`（GET，未鉴权，限流 60 次/小时/IP）；
 * - 版本号取自 release 的 `tag_name`（如 `v3.1` → 3.1），与本地 versionName 比较；
 * - 更新说明取 `body`，下载地址优先取 release 内第一个 `.apk` 资产，
 *   没有资产时回退到 release 页面 `html_url`。
 */
object UpdateChecker {

    private const val TAG = "UpdateChecker"

    /** 本仓库 GitHub Releases API */
    private const val API_LATEST_RELEASE =
        "https://api.github.com/repos/Nanying666/Vmq-App-Optimized/releases/latest"

    /** 仓库主页（兜底跳转地址） */
    const val REPO_URL = "https://github.com/Nanying666/Vmq-App-Optimized"

    /** 更新检查结果 */
    class UpdateInfo(
        @JvmField val latestVersion: String,
        @JvmField val changelog: String,
        @JvmField val downloadUrl: String,
        @JvmField val hasUpdate: Boolean
    )

    /**
     * 查询最新 Release 并与本地版本比较。
     *
     * @param currentVersionName 本地 versionName（如 "3.0"）
     * @return 检查结果；网络异常 / 限流 / 解析失败时返回 null（调用方按"已是最新"处理）
     */
    @JvmStatic
    fun check(currentVersionName: String): UpdateInfo? {
        var conn: HttpURLConnection? = null
        var reader: BufferedReader? = null
        try {
            conn = (URL(API_LATEST_RELEASE).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8000
                readTimeout = 8000
                // GitHub API 强制要求 User-Agent，缺失会返回 403
                setRequestProperty("User-Agent", "Vmq-App-Optimized")
                setRequestProperty("Accept", "application/vnd.github+json")
            }

            val code = conn.responseCode
            if (code != HttpURLConnection.HTTP_OK) {
                // 404 = 尚无 Release；403 = 触发限流；其余为网络/服务异常
                Log.w(TAG, "检查更新失败，HTTP $code")
                return null
            }

            val sb = StringBuilder()
            reader = BufferedReader(InputStreamReader(conn.inputStream, Charsets.UTF_8))
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                sb.append(line).append("\n")
            }

            val json = JSONObject(sb.toString().trim())
            val tag = json.optString("tag_name", "")
            if (tag.isEmpty()) {
                Log.w(TAG, "Release 缺少 tag_name")
                return null
            }

            val changelog = json.optString("body", "").trim()
            val htmlUrl = json.optString("html_url", REPO_URL)

            // 优先取 release 中的 .apk 资产
            var downloadUrl = htmlUrl
            val assets = json.optJSONArray("assets")
            if (assets != null) {
                for (i in 0 until assets.length()) {
                    val a = assets.optJSONObject(i) ?: continue
                    val name = a.optString("name", "")
                    if (name.endsWith(".apk", ignoreCase = true)) {
                        downloadUrl = a.optString("browser_download_url", htmlUrl)
                        break
                    }
                }
            }

            val latest = versionNumbers(tag)
            val current = versionNumbers(currentVersionName)
            val hasUpdate = isNewer(latest, current)

            Log.i(TAG, "检查更新：tag=$tag 本地=$currentVersionName 有更新=$hasUpdate")

            return UpdateInfo(
                latestVersion = tag,
                changelog = changelog,
                downloadUrl = downloadUrl,
                hasUpdate = hasUpdate
            )
        } catch (e: Exception) {
            Log.e(TAG, "检查更新发生异常", e)
            return null
        } finally {
            try {
                reader?.close()
            } catch (e: Exception) {
                // ignore
            }
            conn?.disconnect()
        }
    }

    /** 提取版本号中的数字段，例如 "v3.1" → [3, 1] */
    private fun versionNumbers(v: String): List<Int> {
        val nums = Regex("\\d+").findAll(v).map { it.value.toIntOrNull() ?: 0 }.toList()
        return if (nums.isEmpty()) listOf(0) else nums
    }

    /** latest 是否比 current 新（逐段比较，缺失段按 0） */
    private fun isNewer(latest: List<Int>, current: List<Int>): Boolean {
        val n = maxOf(latest.size, current.size)
        for (i in 0 until n) {
            val l = latest.getOrElse(i) { 0 }
            val c = current.getOrElse(i) { 0 }
            if (l > c) return true
            if (l < c) return false
        }
        return false
    }
}