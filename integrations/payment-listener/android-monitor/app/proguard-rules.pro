# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Missing classes from R8 analysis（OkHttp/Conscrypt 在不同 Android 版本上的可选依赖）
-dontwarn org.bouncycastle.jsse.BCSSLParameters
-dontwarn org.bouncycastle.jsse.BCSSLSocket
-dontwarn org.bouncycastle.jsse.provider.BouncyCastleJsseProvider
-dontwarn org.conscrypt.Conscrypt$Version
-dontwarn org.conscrypt.Conscrypt
-dontwarn org.conscrypt.ConscryptHostnameVerifier
-dontwarn org.openjsse.javax.net.ssl.SSLParameters
-dontwarn org.openjsse.javax.net.ssl.SSLSocket
-dontwarn org.openjsse.net.ssl.OpenJSSE

# 保留注解/泛型签名（OkHttp 与 zxing 反射读取所需）
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# ===== OkHttp / Okio =====
# 不再全量 -keep（原规则会让 R8 无法裁剪 OkHttp，白增体积）。
# OkHttp 自身已随 AAR 附带 consumer rules，这里只补齐平台相关的保留项。
-dontwarn okhttp3.internal.platform.**
-dontwarn org.codehaus.mojo.**
-dontwarn javax.annotation.**
# OkHttp 通过反射读取 TlsVersion / CipherSuite 的静态字段
-keepnames class okhttp3.internal.platform.ConscryptPlatform
-keepnames class okhttp3.internal.platform.BouncyCastlePlatform

# ===== zxing =====
# 仅保留相机/解码链路可能被反射或 JNI 触及的成员，其余交由 R8 裁剪
-keep class com.google.zxing.camera.** { *; }
-keep class com.google.zxing.decoding.** { *; }
-keep class com.google.zxing.view.** { *; }
-keep class com.google.zxing.activity.** { *; }
-keep class com.google.zxing.util.** { *; }
-dontwarn com.google.zxing.**

# ===== 业务：反射调用点 =====
# android:onClick 由 AGP 自动生成 keep 规则（见 aapt_rules.txt），无需手写。
# 但 com.shinian.pay 内部存在「通过类名字符串访问 miui.os.Build」等反射，
# 以及 Java/Kotlin 互调，保留公开 API 名称以避免混淆引发的 NoSuchMethodError。
-keep class com.shinian.pay.manager.AppConstants { *; }
-keep class com.shinian.pay.util.NetworkClient { *; }
-keep class com.shinian.pay.util.ChannelManager { *; }
-keep class com.shinian.pay.util.MoneyParser { *; }
-keep class com.shinian.pay.util.Md5 { *; }
-keep class com.shinian.pay.util.UpdateChecker { *; }

# 保留行号，便于线上崩溃定位（不显著增加体积）
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
