package com.shinian.pay.util;

import org.junit.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;

/**
 * ChannelManager 故障切换核心逻辑单测（JVM 环境，反射驱动）。
 *
 * 说明：ChannelManager 依赖 android.content.SharedPreferences，无法在纯 JVM 单测直接调用
 * 其 resolve()/recordXxx()（会抛 Context stub 未初始化）。本测试聚焦于：
 *  1. 通过反射固化设计参数（阈值、SP key），防止实现漂移；
 *  2. 校验工具类的封装约束（final + 私有构造 + 全静态方法）；
 *  3. 校验 SP 状态机 key 命名规范，保证持久化向后兼容。
 */
public class ChannelManagerTest {

    /** 设计参数：迟滞阈值必须为正整数（避免立即抖动切换） */
    @Test
    public void thresholdsArePositive() throws Exception {
        int fatal = (Integer) readStaticField("FATAL_THRESHOLD");
        int good = (Integer) readStaticField("GOOD_THRESHOLD");
        org.junit.Assert.assertTrue("FATAL_THRESHOLD 必须 > 0", fatal > 0);
        org.junit.Assert.assertTrue("GOOD_THRESHOLD 必须 > 0", good > 0);
    }

    /** SP key 命名必须与设计文档一致（旧用户无这些 key 时退化为单通道） */
    @Test
    public void spKeysMatchDesign() throws Exception {
        org.junit.Assert.assertEquals("host2", (String) readStaticField("SP_HOST2"));
        org.junit.Assert.assertEquals("key2", (String) readStaticField("SP_KEY2"));
        org.junit.Assert.assertEquals("active_channel", (String) readStaticField("SP_ACTIVE"));
        org.junit.Assert.assertEquals("main_consec_fails", (String) readStaticField("SP_MAIN_FAILS"));
        org.junit.Assert.assertEquals("main_consec_goods", (String) readStaticField("SP_MAIN_GOODS"));
    }

    /** 工具类约束：Kotlin object 单例 + 私有构造 + 全部公开 API 为 @JvmStatic（兼容 Java 调用点） */
    @Test
    public void utilityClassConstraints() throws Exception {
        int mod = ChannelManager.class.getModifiers();
        org.junit.Assert.assertTrue("工具类必须 final", Modifier.isFinal(mod));
        org.junit.Assert.assertTrue("构造函数必须私有",
                Modifier.isPrivate(ChannelManager.class.getDeclaredConstructors()[0].getModifiers()));
        // Kotlin object 会生成静态 INSTANCE 字段（单例语义）
        java.lang.reflect.Field instanceField = ChannelManager.class.getDeclaredField("INSTANCE");
        org.junit.Assert.assertTrue("必须为 Kotlin 单例（静态 INSTANCE）",
                Modifier.isStatic(instanceField.getModifiers()));
        // 公开 API 必须是 static（@JvmStatic），否则 Java 调用点 NetworkClient.getWithRetry 等会编译失败
        String[] staticApi = {"resolve", "hasBackup", "reset", "saveBackup",
                "recordMainSuccess", "recordMainFailure", "activeName"};
        for (String name : staticApi) {
            boolean found = false;
            for (java.lang.reflect.Method m : ChannelManager.class.getDeclaredMethods()) {
                if (m.getName().equals(name) && Modifier.isStatic(m.getModifiers())) {
                    found = true;
                    break;
                }
            }
            org.junit.Assert.assertTrue("公开 API 必须为 static(@JvmStatic): " + name, found);
        }
    }

    /** 必备方法签名存在性（resolve/hasBackup/reset/saveBackup/recordMainSuccess/recordMainFailure） */
    @Test
    public void requiredMethodsExist() {
        String[] required = {"resolve", "hasBackup", "reset", "saveBackup",
                "recordMainSuccess", "recordMainFailure", "recordBackupSuccess",
                "recordBackupFailure", "activeName", "resolveBackupDefault"};
        java.util.Set<String> names = new java.util.HashSet<>();
        for (java.lang.reflect.Method m : ChannelManager.class.getDeclaredMethods()) {
            names.add(m.getName());
        }
        for (String r : required) {
            org.junit.Assert.assertTrue("缺少方法 " + r, names.contains(r));
        }
    }

    private Object readStaticField(String name) throws Exception {
        Field f = ChannelManager.class.getDeclaredField(name);
        f.setAccessible(true);
        return f.get(null);
    }
}
