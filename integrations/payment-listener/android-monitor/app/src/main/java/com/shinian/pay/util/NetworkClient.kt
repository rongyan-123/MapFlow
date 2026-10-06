package com.shinian.pay.util

import android.util.Log
import okhttp3.Callback
import okhttp3.Dns
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.net.InetAddress
import java.net.URLEncoder
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit

/**
 * 统一网络客户端（Kotlin 版，Java 调用点 API 保持不变）。
 *
 * 解决问题：移动数据网络下访问境外服务器时，TCP 连接/TLS 握手被中间设备
 * 间歇性重置（Connection reset），导致心跳检测失败。
 *
 * 核心策略（三重保障）：
 * 1. followSslRedirects(true) —— 服务器对 http 返回 308 重定向到 https 时自动跟随；
 * 2. 失败自动重试，并在 https / http 协议间交替切换，单协议被重置时换协议再试；
 * 3. 使用阿里 DoH（HTTPS 加密 DNS）解析，避免明文 UDP DNS 被污染或劫持。
 *
 * 说明：通过 companion object + `@JvmStatic` 为 Java 调用点提供静态方法，
 * 与迁移前的 `NetworkClient.getWithRetry(...)` 静态调用完全兼容。
 */
class NetworkClient private constructor() {

    companion object {

        private const val TAG = "NetworkClient"

        /** 最大尝试次数（含首次） */
        private const val MAX_RETRY = 6

        /** 重试基础延迟（线性退避） */
        private const val RETRY_BASE_DELAY_MS = 300L

        @Volatile
        private var sClient: OkHttpClient? = null

        /** 获取全局唯一的 OkHttpClient（带重定向/重试/加密DNS能力） */
        @JvmStatic
        fun client(): OkHttpClient {
            var c = sClient
            if (c == null) {
                synchronized(NetworkClient::class.java) {
                    c = sClient
                    if (c == null) {
                        c = OkHttpClient.Builder()
                            .connectTimeout(8, TimeUnit.SECONDS)
                            .readTimeout(15, TimeUnit.SECONDS)
                            .writeTimeout(15, TimeUnit.SECONDS)
                            .callTimeout(25, TimeUnit.SECONDS)
                            .retryOnConnectionFailure(true)
                            .followRedirects(true)
                            .followSslRedirects(true)
                            .dns(AliDns())
                            .build()
                        sClient = c
                    }
                }
            }
            return c!!
        }

        /**
         * 异步 GET 请求（带协议交替重试）。
         * 结果始终回调在 OkHttp 工作线程，UI 操作请自行 post 到主线程。
         *
         * @param host 配置的地址（如 your.domain.com，不带协议）
         * @param path 接口路径（如 /appHeart?t=xxx&sign=xxx，含查询参数）
         * @param cb   OkHttp 原生回调；若全部重试仍失败，只会回调一次 onFailure
         */
        @JvmStatic
        fun getWithRetry(host: String, path: String, cb: Callback) {
            // IP 直连模式：http 优先（https+IP 无匹配证书必然失败，不浪费尝试）
            // 域名模式：https 优先（加密+跟随308重定向）
            attempt(host, path, 0, !isIpHost(host), cb)
        }

        private fun attempt(
            host: String,
            path: String,
            attemptIndex: Int,
            httpsFirst: Boolean,
            cb: Callback
        ) {
            if (attemptIndex >= MAX_RETRY) {
                // 保留迁移前语义：全部重试失败时以 null call 回调（消费方仅读取 e.getMessage()）
                cb.onFailure(uncheckedNull(), IOException("网络连续 $MAX_RETRY 次请求失败(已尝试http/https交替重试)"))
                return
            }

            // 偶数次用 https，奇数次用 http
            val useHttps = if (httpsFirst) attemptIndex % 2 == 0 else attemptIndex % 2 == 1
            val url = buildUrl(host, path, useHttps)

            val request = Request.Builder()
                .url(url)
                .header("Connection", "close") // 每次新建连接，避免复用已被中间设备干扰的半死连接
                .build()

            client().newCall(request).enqueue(object : Callback {
                override fun onFailure(call: okhttp3.Call, e: IOException) {
                    Log.w(TAG, "第${attemptIndex + 1}次尝试失败: ${call.request().url.encodedPath} 错误: ${e.message}")
                    // 延迟后换协议重试
                    Thread {
                        try {
                            Thread.sleep(RETRY_BASE_DELAY_MS * (attemptIndex + 1))
                        } catch (ignored: InterruptedException) {
                        }
                        attempt(host, path, attemptIndex + 1, httpsFirst, cb)
                    }.start()
                }

                override fun onResponse(call: okhttp3.Call, response: Response) {
                    Log.d(TAG, "第${attemptIndex + 1}次尝试成功: ${call.request().url.encodedPath}")
                    cb.onResponse(call, response)
                }
            })
        }

        /** 按协议构建请求 URL（host 支持 "域名"、"IP"、"host:端口"、"[IPv6]:端口" 格式） */
        private fun buildUrl(host: String, path: String, useHttps: Boolean): HttpUrl {
            var h = host.trim()
            var port = -1

            // 解析 [IPv6]:端口
            if (h.startsWith("[")) {
                val close = h.indexOf(']')
                if (close > 0) {
                    val rest = h.substring(close + 1)
                    if (rest.startsWith(":")) {
                        port = rest.substring(1).toIntOrNull() ?: -1
                    }
                    h = h.substring(1, close)
                }
            } else {
                // 解析 host:端口（IPv4/域名）
                val colon = h.lastIndexOf(':')
                if (colon > 0) {
                    val parsed = h.substring(colon + 1).toIntOrNull()
                    if (parsed != null) {
                        port = parsed
                        h = h.substring(0, colon)
                    }
                }
            }

            val p = if (path.contains("?")) path.substring(0, path.indexOf('?')) else path
            val q = if (path.contains("?")) path.substring(path.indexOf('?') + 1) else null

            val builder = HttpUrl.Builder()
                .scheme(if (useHttps) "https" else "http")
                .host(h)
            if (port > 0) {
                builder.port(port)
            } else {
                builder.port(if (useHttps) 443 else 80)
            }
            return builder.encodedPath(p).query(q).build()
        }
        /**
         * 故意返回 null 的 Call 引用。
         *
         * 迁移前的 Java 实现会在全部重试失败时调用 `cb.onFailure(null, e)`。
         * 消费方（心跳 / 收款回调 / 补单）只读取 `e.getMessage()`，从不访问 call。
         * Kotlin 的空安全不允许直接传 null，这里用 `@Suppress` 保留原语义，
         * 避免 Java 调用点在 Kotlin 化后触发 NPE 行为差异。
         */
        @Suppress("UNCHECKED_CAST")
        private fun <T> uncheckedCast(value: Any?): T = value as T

        private fun uncheckedNull(): okhttp3.Call = uncheckedCast(null)

        /**
         * 判断 host 是否为 IP 直连（支持 "IP" 和 "IP:端口" 两种格式）
         */
        private fun isIpHost(host: String?): Boolean {
            if (host == null) return false
            var h = host.trim()
            val colon = h.lastIndexOf(':')
            if (colon > 0 && !h.startsWith("[")) {
                h = h.substring(0, colon)
            }
            return Regex("\\d{1,3}(\\.\\d{1,3}){3}").matches(h)
        }

        /**
         * 同步 GET（阻塞当前线程，禁止在主线程调用！），带协议交替重试。
         * 供子线程（如自动补回调）使用。返回响应体字符串，全部重试失败则抛 IOException。
         */
        @JvmStatic
        @Throws(IOException::class)
        fun getWithRetrySync(host: String, path: String): String {
            var last: IOException? = null
            val isIp = isIpHost(host)
            for (i in 0 until MAX_RETRY) {
                val useHttps = if (isIp) false else i % 2 == 0 // 域名: https->http交替; IP: 全http
                val url = buildUrl(host, path, useHttps)
                val request = Request.Builder().url(url).header("Connection", "close").build()
                var resp: Response? = null
                try {
                    resp = client().newCall(request).execute()
                    if (resp.isSuccessful) {
                        val body = resp.body?.string() ?: ""
                        Log.d(TAG, "同步请求第${i + 1}次成功: ${url.encodedPath}")
                        return body
                    }
                    last = IOException("HTTP ${resp.code}")
                } catch (e: IOException) {
                    last = e
                    Log.w(TAG, "同步请求第${i + 1}次失败: ${url.encodedPath} 错误: ${e.message}")
                } finally {
                    resp?.close()
                }
                try {
                    Thread.sleep(RETRY_BASE_DELAY_MS * (i + 1))
                } catch (ignored: InterruptedException) {
                }
            }
            throw last ?: IOException("网络连续请求失败")
        }

        /**
         * 阿里公共 DNS 的 DoH（DNS over HTTPS）解析器。
         * 明文 UDP DNS 在移动网络下易被污染，改用 HTTPS 查询。
         */
        internal class AliDns : Dns {
            override fun lookup(hostname: String): List<InetAddress> {
                // 内网地址/纯IP 直接走系统解析
                if (hostname.isEmpty()) {
                    throw UnknownHostException("hostname is empty")
                }
                if (isIpAddress(hostname)) {
                    val list = Dns.SYSTEM.lookup(hostname)
                    if (list.isEmpty()) throw UnknownHostException(hostname)
                    return list
                }
                try {
                    val u = String.format(DOH_URL, URLEncoder.encode(hostname, "UTF-8"))
                    val bare = bareClient
                    val req = Request.Builder().url(u).header("accept", "application/dns-json").build()
                    val resp = bare.newCall(req).execute()
                    val body = resp.body?.string() ?: ""
                    resp.close()

                    val json = JSONObject(body)
                    // DoH JSON API 中 Status 为数字，0 = NOERROR(成功)
                    if (json.optInt("Status", -1) != 0) {
                        throw UnknownHostException("DoH Status != 0: $hostname")
                    }
                    val answers = json.optJSONArray("Answer")
                    val result = ArrayList<InetAddress>()
                    if (answers != null) {
                        for (i in 0 until answers.length()) {
                            val ans = answers.optJSONObject(i) ?: continue
                            if (ans.optInt("type", -1) == 1) { // A 记录
                                val data = ans.optString("data", "").trim()
                                if (data.isNotEmpty()) {
                                    result.add(InetAddress.getByName(data))
                                }
                            }
                        }
                    }
                    if (result.isNotEmpty()) {
                        return result
                    }
                    throw UnknownHostException("DoH 无 A 记录: $hostname")
                } catch (e: UnknownHostException) {
                    throw e
                } catch (e: Exception) {
                    // DoH 失败时降级回系统 DNS，保证可用性
                    Log.w(TAG, "DoH 解析失败，降级系统DNS: $hostname ${e.message}")
                    val list = Dns.SYSTEM.lookup(hostname)
                    if (list.isEmpty()) throw UnknownHostException(hostname)
                    return list
                }
            }

            /** DoH 专用轻量客户端（系统DNS，避免递归走DoH），全局单例 */
            private val bareClient: OkHttpClient
                get() {
                    var c = sBareClient
                    if (c == null) {
                        synchronized(AliDns::class.java) {
                            c = sBareClient
                            if (c == null) {
                                c = OkHttpClient.Builder()
                                    .connectTimeout(4, TimeUnit.SECONDS)
                                    .readTimeout(4, TimeUnit.SECONDS)
                                    .build()
                                sBareClient = c
                            }
                        }
                    }
                    return c!!
                }

            private fun isIpAddress(s: String): Boolean =
                Regex("\\d{1,3}(\\.\\d{1,3}){3}").matches(s) || s.contains(":") // 粗略匹配 IPv6

            companion object {
                private const val DOH_URL = "https://dns.alidns.com/resolve?name=%s&type=A"

                @Volatile
                private var sBareClient: OkHttpClient? = null
            }
        }
    }
}
