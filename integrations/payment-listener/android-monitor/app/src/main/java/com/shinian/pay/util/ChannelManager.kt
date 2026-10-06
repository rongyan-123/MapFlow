package com.shinian.pay.util

import android.content.Context
import android.content.SharedPreferences
import android.text.TextUtils
import android.util.Log
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Response
import java.io.IOException

/**
 * 双通道健康检查与故障切换管理器（Kotlin 版，Java 调用点 API 保持不变）。
 *
 * 设计原则（保证不破坏现有收款链路）：
 *  1. 主通道 = SP 的 host/key；备用通道 = SP 的 host2/key2（可选）。
 *  2. 未配置 host2 时，行为与单通道完全一致（完全向后兼容）。
 *  3. 故障切换带迟滞：主通道连续失败 FATAL_THRESHOLD 次才切到备用；
 *     主通道恢复 GOOD_THRESHOLD 次健康后才自动回切（hysteresis，避免抖动）。
 *  4. 通道选择与失败计数持久化到 SP，重启后延续。
 *  5. 线程安全：所有变更在 synchronized 锁内进行。
 *
 * 用法：网络调用前调 [resolve] 取当前最可用 host，
 *       请求成功后调 [recordMainSuccess]，失败后调 [recordMainFailure]。
 */
object ChannelManager {

    private const val TAG = "ChannelManager"
    private val LOCK = Any()

    // 迟滞阈值：主通道连续失败达到该次数才切备用；主通道健康达到该次数才回切
    private const val FATAL_THRESHOLD = 3   // 主连续失败 3 次 → 切备用
    private const val GOOD_THRESHOLD = 3    // 主连续 3 次健康 → 回切主

    // SP key（新增，均带默认值，旧用户无这些 key 时为默认，退化为单通道）
    private const val SP_HOST2 = "host2"
    private const val SP_KEY2 = "key2"
    private const val SP_ACTIVE = "active_channel"   // 0=主 1=备
    private const val SP_MAIN_FAILS = "main_consec_fails"
    private const val SP_MAIN_GOODS = "main_consec_goods"

    private fun sp(ctx: Context): SharedPreferences =
        ctx.applicationContext.getSharedPreferences("shinian", Context.MODE_PRIVATE)

    private fun nz(v: String?): String = v?.trim() ?: ""

    /** 当前是否配置了备用通道（host2 非空） */
    @JvmStatic
    fun hasBackup(ctx: Context): Boolean = synchronized(LOCK) {
        !TextUtils.isEmpty(nz(sp(ctx).getString(SP_HOST2, "")))
    }

    /**
     * 解析当前最可用的 host+key（自动选主/备，并尝试惰性探活）。
     * 返回 [host, key]；主通道不可用且有备用时切备用；否则回退主通道（单通道也返回主）。
     */
    @JvmStatic
    fun resolve(ctx: Context): Array<String> = synchronized(LOCK) {
        val p = sp(ctx)
        val host = nz(p.getString("host", ""))
        val key = nz(p.getString("key", ""))
        val host2 = nz(p.getString(SP_HOST2, ""))
        val key2 = nz(p.getString(SP_KEY2, ""))

        val backupCfg = host2.isNotEmpty()
        var active = p.getInt(SP_ACTIVE, 0)
        if (!backupCfg) {
            active = 0 // 无备用则恒用主
        }

        if (active == 1 && backupCfg) {
            return@synchronized arrayOf(host2, key2)
        }
        return@synchronized arrayOf(host, key)
    }

    /** 主通道健康成功记账：连续健康 +1；若正使用备用且主已恢复足够健康，自动回切主 */
    @JvmStatic
    fun recordMainSuccess(ctx: Context) {
        synchronized(LOCK) {
            val p = sp(ctx)
            val goods = p.getInt(SP_MAIN_GOODS, 0) + 1
            val active = p.getInt(SP_ACTIVE, 0)
            var newActive = active
            if (active == 1 && goods >= GOOD_THRESHOLD) {
                newActive = 0 // 主恢复健康，回切主
                Log.w(TAG, "主通道健康达到${goods}次，自动回切主通道")
            }
            p.edit()
                .putInt(SP_MAIN_GOODS, goods)
                .putInt(SP_ACTIVE, newActive)
                .apply()
        }
    }

    /** 主通道失败记账：连续失败 +1；达到阈值且有备用则切备用 */
    @JvmStatic
    fun recordMainFailure(ctx: Context) {
        synchronized(LOCK) {
            val p = sp(ctx)
            val fails = p.getInt(SP_MAIN_FAILS, 0) + 1
            val active = p.getInt(SP_ACTIVE, 0)
            val backupCfg = !TextUtils.isEmpty(nz(p.getString(SP_HOST2, "")))
            var newActive = active
            if (active == 0 && fails >= FATAL_THRESHOLD && backupCfg) {
                newActive = 1 // 主持续失败且有备用，切备用
                Log.w(TAG, "主通道连续失败${fails}次，自动切换至备用通道")
            }
            p.edit()
                .putInt(SP_MAIN_FAILS, fails)
                .putInt(SP_ACTIVE, newActive)
                .apply()
        }
    }

    /** 备用通道成功记账：清零主失败计数（说明主可能已好，下次探活）并重置主健康 */
    @JvmStatic
    fun recordBackupSuccess(ctx: Context) {
        synchronized(LOCK) {
            sp(ctx).edit()
                .putInt(SP_MAIN_FAILS, 0)
                .putInt(SP_MAIN_GOODS, 0)
                .apply()
        }
    }

    /** 备用通道失败记账：备用也失败时，保持备用（不回切主），主计数继续累积 */
    @JvmStatic
    fun recordBackupFailure(ctx: Context) {
        synchronized(LOCK) {
            // 双通道都故障：维持备用通道，等待人工或主恢复；主失败计数保留
            Log.w(TAG, "备用通道也失败，双通道均不可用，等待恢复")
        }
    }

    /** 保存备用通道配置（可选） */
    @JvmStatic
    fun saveBackup(ctx: Context, host2: String?, key2: String?) {
        synchronized(LOCK) {
            sp(ctx).edit()
                .putString(SP_HOST2, host2?.trim() ?: "")
                .putString(SP_KEY2, key2?.trim() ?: "")
                .apply()
        }
    }

    /** 读取已保存的备用通道配置（供设置对话框回填；未配置返回空串） */
    @JvmStatic
    fun resolveBackupDefault(ctx: Context): String = synchronized(LOCK) {
        val p = sp(ctx)
        val h2 = nz(p.getString(SP_HOST2, ""))
        val k2 = nz(p.getString(SP_KEY2, ""))
        if (h2.isEmpty()) "" else "$h2/$k2"
    }

    /** 重置全部通道状态（修改配置后调用，从主通道重新探活） */
    @JvmStatic
    fun reset(ctx: Context) {
        synchronized(LOCK) {
            sp(ctx).edit()
                .putInt(SP_ACTIVE, 0)
                .putInt(SP_MAIN_FAILS, 0)
                .putInt(SP_MAIN_GOODS, 0)
                .apply()
        }
    }

    /** 当前活跃通道名（0主 1备），用于日志/展示 */
    @JvmStatic
    fun activeName(ctx: Context): String = synchronized(LOCK) {
        val a = sp(ctx).getInt(SP_ACTIVE, 0)
        if (a == 1 && hasBackup(ctx)) "备用通道" else "主通道"
    }

    /**
     * 一站式网络调用：自动选当前通道 → 请求 → 成功记账 → 失败记账。
     * 若用主通道失败且已切备用，则用备用通道再试一次（仅限一次，避免网络雪崩）。
     * @return 实际使用的 [host, key]，供上层记录/排查
     */
    @JvmStatic
    fun execute(ctx: Context, path: String, cb: Callback): Array<String> {
        val c = resolve(ctx)
        val isMain = c[0] == nz(sp(ctx).getString("host", ""))
        NetworkClient.getWithRetry(c[0], path, object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (isMain && hasBackup(ctx)) {
                    recordMainFailure(ctx)
                    val b = resolve(ctx)
                    if (b[0] != c[0]) {
                        NetworkClient.getWithRetry(b[0], path, object : Callback {
                            override fun onFailure(call2: Call, e2: IOException) {
                                recordBackupFailure(ctx)
                                cb.onFailure(call2, e2)
                            }

                            override fun onResponse(call2: Call, resp2: Response) {
                                recordBackupSuccess(ctx)
                                cb.onResponse(call2, resp2)
                            }
                        })
                        return
                    }
                }
                if (isMain) recordMainFailure(ctx) else recordBackupFailure(ctx)
                cb.onFailure(call, e)
            }

            override fun onResponse(call: Call, resp: Response) {
                if (isMain) recordMainSuccess(ctx) else recordBackupSuccess(ctx)
                cb.onResponse(call, resp)
            }
        })
        return c
    }
}