package com.shinian.pay.util

import java.util.Locale

object PaymentPushRequest {
    fun price(amount: Double): String = String.format(Locale.US, "%.2f", amount)

    fun path(type: Int, price: String, timestamp: String, key: String): String {
        val sign = Md5.hex(type.toString() + price + timestamp + key)
        return "/appPush?t=$timestamp&type=$type&price=$price&sign=$sign"
    }
}
