package com.shinian.pay.util

import okhttp3.Call
import okhttp3.Callback
import okhttp3.Response
import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Test

class NetworkClientFailureTest {
    @Test
    fun exhaustedRetriesDeliverOneNonNullFailureInsteadOfCrashing() {
        var failures = 0
        val callback = object : Callback {
            override fun onFailure(call: Call, error: IOException) {
                assertEquals("/appPush", call.request().url.encodedPath)
                failures++
            }
            override fun onResponse(call: Call, response: Response) {
                throw AssertionError("Failure cannot become success")
            }
        }
        // Exercise the exhausted state without waiting through real network timeouts.
        val terminal = NetworkClient.Companion.javaClass.getDeclaredMethod("attempt",
            String::class.java, String::class.java, Int::class.javaPrimitiveType,
            Boolean::class.javaPrimitiveType, Callback::class.java)
        terminal.isAccessible = true
        terminal.invoke(NetworkClient.Companion, "127.0.0.1:28080", "/appPush", 6, false, callback)
        assertEquals(1, failures)
    }
}
