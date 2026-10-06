package com.shinian.pay

/**
 * Kotlin 工具链探针（S0 阶段占位）。
 * 用于验证 Kotlin 编译、协程依赖、JVM 单测链路是否打通。
 * 后续阶段该文件会被真实的 Kotlin 实现替代或删除。
 */
internal object KotlinToolchainProbe {
    /** 供单测断言使用 */
    @JvmStatic
    fun ok(): Boolean = true
}
