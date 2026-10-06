package com.shinian.pay

import org.junit.Assert.assertTrue
import org.junit.Test
import kotlinx.coroutines.runBlocking

/**
 * S0 阶段：验证 Kotlin 工具链 + 协程依赖在 JVM 单测链路可用。
 */
class KotlinToolchainProbeTest {

    @Test
    fun kotlinCompilesAndRuns() {
        assertTrue(KotlinToolchainProbe.ok())
    }

    @Test
    fun coroutinesDependencyAvailable() = runBlocking {
        val value = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) { 42 }
        assertTrue(value == 42)
    }
}
