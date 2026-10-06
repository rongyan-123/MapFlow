package com.shinian.pay.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.Locale

class PaymentPushRequestTest {
    @Test
    fun notificationTimestampUsesPostingTimeAndRefusesStaleOrMissingEvents() {
        assertEquals(123_000L, PaymentPushRequest.notificationTimestamp(123_000L, 124_000L))
        assertNull(PaymentPushRequest.notificationTimestamp(0L, 124_000L))
        assertNull(PaymentPushRequest.notificationTimestamp(1_000L, 124_000L))
        assertNull(PaymentPushRequest.notificationTimestamp(130_000L, 124_000L))
    }
    @Test
    fun retryKeepsOriginalEventTimeAndSignsForTheSelectedChannel() {
        assertEquals(
            "/appPush?t=123&type=1&price=10.00&sign=8fd6798f8ee744af78e8e6264cd03585",
            PaymentPushRequest.path(1, "10.00", "123", "secret")
        )
        assertEquals(
            "/appPush?t=123&type=1&price=10.00&sign=1ba267e3312b4dc11d6456e10904b2dc",
            PaymentPushRequest.path(1, "10.00", "123", "backup")
        )
    }

    @Test
    fun priceUsesDotDecimalRegardlessOfDeviceLocale() {
        val previous = Locale.getDefault()
        try {
            Locale.setDefault(Locale.FRANCE)
            assertEquals("10.29", PaymentPushRequest.price(10.29))
        } finally {
            Locale.setDefault(previous)
        }
    }
}
