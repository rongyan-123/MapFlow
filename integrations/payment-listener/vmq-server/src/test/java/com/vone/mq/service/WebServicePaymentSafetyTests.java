package com.vone.mq.service;

import com.vone.mq.dao.PayOrderDao;
import com.vone.mq.dao.SettingDao;
import com.vone.mq.dao.TmpPriceDao;
import com.vone.mq.entity.PayOrder;
import com.vone.mq.entity.Setting;
import org.junit.Before;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Arrays;
import java.util.Collections;
import java.util.Optional;
import org.mockito.ArgumentCaptor;

import static org.junit.Assert.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class WebServicePaymentSafetyTests {
    private WebService service;
    private PayOrderDao orders;
    private TmpPriceDao prices;
    private SettingDao settings;

    @Before
    public void setUp() {
        service = new WebService();
        orders = mock(PayOrderDao.class);
        prices = mock(TmpPriceDao.class);
        settings = mock(SettingDao.class);
        Setting key = new Setting();
        key.setVkey("key");
        key.setVvalue("secret");
        when(settings.findById("key")).thenReturn(Optional.of(key));
        Setting timeout = new Setting(); timeout.setVvalue("5");
        when(settings.findById("close")).thenReturn(Optional.of(timeout));
        ReflectionTestUtils.setField(service, "settingDao", settings);
        ReflectionTestUtils.setField(service, "payOrderDao", orders);
        ReflectionTestUtils.setField(service, "tmpPriceDao", prices);
    }

    @Test
    public void rejectsAmbiguousAmountWithoutMarkingEitherOrderPaid() {
        long timestamp = System.currentTimeMillis();
        when(orders.findAllByReallyPriceAndStateAndType(10.0, 0, 1))
                .thenReturn(Arrays.asList(waitingOrder(timestamp - 1000), waitingOrder(timestamp - 500)));

        assertEquals(-1, service.appPush(1, "10.0", String.valueOf(timestamp),
                WebService.md5("110.0" + timestamp + "secret")).getCode());

        ArgumentCaptor<PayOrder> review = ArgumentCaptor.forClass(PayOrder.class);
        verify(orders).save(review.capture());
        assertEquals(3, review.getValue().getState());
        assertEquals(timestamp, review.getValue().getPayDate());
        verify(prices, never()).delprice(any(String.class));
    }

    @Test
    public void rejectsNotificationPredatingTheOrder() {
        long timestamp = System.currentTimeMillis() - 1000;
        when(orders.findAllByReallyPriceAndStateAndType(10.0, 0, 1))
                .thenReturn(Collections.singletonList(waitingOrder(timestamp + 500)));

        assertEquals(-1, service.appPush(1, "10.0", String.valueOf(timestamp),
                WebService.md5("110.0" + timestamp + "secret")).getCode());

        ArgumentCaptor<PayOrder> review = ArgumentCaptor.forClass(PayOrder.class);
        verify(orders).save(review.capture());
        assertEquals(3, review.getValue().getState());
        verify(prices, never()).delprice(any(String.class));
    }

    @Test
    public void rejectsInvalidAmountBeforeLookingUpOrders() {
        long timestamp = System.currentTimeMillis();
        assertEquals(-1, service.appPush(1, "NaN", String.valueOf(timestamp),
                WebService.md5("1NaN" + timestamp + "secret")).getCode());
        verifyZeroInteractions(orders);
    }

    @Test
    public void acceptsTwoDecimalAmountWithoutFloatingPointFalseRejection() {
        long timestamp = System.currentTimeMillis();
        service.appPush(1, "0.29", String.valueOf(timestamp),
                WebService.md5("10.29" + timestamp + "secret"));
        verify(orders).save(any(PayOrder.class));
    }

    @Test
    public void recentSameAmountEventCannotPayASecondOrder() {
        long timestamp = System.currentTimeMillis();
        PayOrder priorPayment = waitingOrder(timestamp - 60_000);
        priorPayment.setState(1);
        priorPayment.setPayDate(timestamp - 10_000);
        when(orders.findAllByReallyPriceAndTypeAndPayDateBetween(10.0, 1,
                timestamp - 300_000, timestamp)).thenReturn(Collections.singletonList(priorPayment));
        PayOrder nextOrder = waitingOrder(timestamp - 1_000);
        when(orders.findAllByReallyPriceAndStateAndType(10.0, 0, 1))
                .thenReturn(Collections.singletonList(nextOrder));

        assertEquals(-1, service.appPush(1, "10.0", String.valueOf(timestamp),
                WebService.md5("110.0" + timestamp + "secret")).getCode());
        assertEquals(0, nextOrder.getState());
        ArgumentCaptor<PayOrder> review = ArgumentCaptor.forClass(PayOrder.class);
        verify(orders).save(review.capture());
        assertEquals(3, review.getValue().getState());
    }

    @Test
    public void releasesReservedPriceUsingOrderAmountNotNotificationFormatting() {
        long timestamp = System.currentTimeMillis();
        PayOrder order = waitingOrder(timestamp - 1000);
        order.setId(7L);
        when(orders.findAllByReallyPriceAndStateAndType(10.0, 0, 1))
                .thenReturn(Collections.singletonList(order));
        Setting callback = new Setting();
        callback.setVkey("notifyUrl");
        callback.setVvalue("");
        when(settings.findById("notifyUrl")).thenReturn(Optional.of(callback));

        service.appPush(1, "10.00", String.valueOf(timestamp),
                WebService.md5("110.00" + timestamp + "secret"));

        verify(prices).delprice("1-10.0");
        assertEquals(timestamp, order.getPayDate());
    }

    @Test
    public void reviewRecordCanNeverPassPaymentCheck() {
        PayOrder review = new PayOrder();
        review.setState(3);
        when(orders.findByOrderId("review-1")).thenReturn(review);
        assertEquals(-1, service.checkOrder("review-1").getCode());
    }

    private PayOrder waitingOrder(long createdAt) {
        PayOrder order = new PayOrder();
        order.setCreateDate(createdAt);
        order.setState(0);
        order.setType(1);
        order.setReallyPrice(10.0);
        return order;
    }

    @Test
    public void merchantRetryReturnsSameOrderWithoutReservingAnotherAmount() {
        Setting timeout = new Setting();
        timeout.setVvalue("5");
        when(settings.findById("close")).thenReturn(Optional.of(timeout));
        Setting direction = new Setting();
        direction.setVvalue("1");
        when(settings.findById("payQf")).thenReturn(Optional.of(direction));
        Setting qr = new Setting();
        qr.setVvalue("wxp://test");
        when(settings.findById("wxpay")).thenReturn(Optional.of(qr));
        when(prices.checkPrice(any(String.class))).thenReturn(1);
        ReflectionTestUtils.setField(service, "payQrcodeDao", mock(com.vone.mq.dao.PayQrcodeDao.class));
        PayOrder original = waitingOrder(System.currentTimeMillis());
        original.setPayId("site-order");
        original.setOrderId("vmq-order");
        original.setParam("mapflow-v1");
        original.setPrice(10.0);
        original.setNotifyUrl("http://127.0.0.1/notify");
        original.setReturnUrl("https://xxian.fun/");
        when(orders.findByPayId("site-order")).thenReturn(original);
        when(orders.findByOrderId("vmq-order")).thenReturn(original);
        assertEquals(1, service.createOrder("site-order", "mapflow-v1", 1, "10.00",
                "http://127.0.0.1/notify", "https://xxian.fun/",
                WebService.md5("site-ordermapflow-v1110.00secret")).getCode());
        verifyZeroInteractions(prices);
        verify(orders, never()).save(any(PayOrder.class));
    }

    @Test
    public void expiredCandidateCannotBecomePaidBetweenCleanupTicks() {
        long now = System.currentTimeMillis();
        PayOrder expired = waitingOrder(now - 600_000);
        when(orders.findAllByReallyPriceAndStateAndType(10.0, 0, 1)).thenReturn(Collections.singletonList(expired));
        assertEquals(-1, service.appPush(1, "10.0", String.valueOf(now), WebService.md5("110.0" + now + "secret")).getCode());
        assertEquals(0, expired.getState());
        verify(prices, never()).delprice(any(String.class));
    }

    @Test
    public void failedNotificationIsRetriedWithoutChangingPaymentIdentity() throws Exception {
        com.sun.net.httpserver.HttpServer endpoint = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
        java.util.List<String> requests = new java.util.ArrayList<>();
        endpoint.createContext("/notify", exchange -> {
            requests.add(exchange.getRequestURI().getRawQuery());
            byte[] body = (requests.size() == 1 ? "retry" : "success").getBytes("UTF-8");
            exchange.sendResponseHeaders(requests.size() == 1 ? 503 : 200, body.length);
            exchange.getResponseBody().write(body); exchange.close();
        });
        endpoint.start();
        try {
            long now = System.currentTimeMillis();
            PayOrder order = waitingOrder(now - 1000); order.setId(99L);
            order.setPayId("site-order"); order.setParam("mapflow-v1"); order.setPrice(10.0);
            order.setNotifyUrl("http://127.0.0.1:" + endpoint.getAddress().getPort() + "/notify");
            when(orders.findAllByReallyPriceAndStateAndType(10.0, 0, 1)).thenReturn(Collections.singletonList(order));
            assertEquals(-1, service.appPush(1, "10.0", String.valueOf(now), WebService.md5("110.0" + now + "secret")).getCode());
            order.setState(2);
            when(orders.findFirst5ByStateOrderByIdAsc(2)).thenReturn(Collections.singletonList(order));
            service.retryPendingNotifications();
            verify(orders).setState(1,99L);
            assertEquals(2, requests.size());
            assertEquals(requests.get(0), requests.get(1));
        } finally { endpoint.stop(0); }
    }

    @Test
    public void expiredOrderCleanupCannotRaceWithAmountAllocation() throws Exception {
        java.util.concurrent.CountDownLatch cleaning = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch releaseCleanup = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch startingCreation = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch reserving = new java.util.concurrent.CountDownLatch(1);
        Setting direction = new Setting(); direction.setVvalue("1");
        Setting qr = new Setting(); qr.setVvalue("wxp://test");
        Setting state = new Setting(); state.setVvalue("0");
        Setting heartbeat = new Setting(); heartbeat.setVvalue("0");
        when(settings.findById("payQf")).thenReturn(Optional.of(direction));
        when(settings.findById("wxpay")).thenReturn(Optional.of(qr));
        when(settings.findById("jkstate")).thenReturn(Optional.of(state));
        when(settings.findById("lastheart")).thenReturn(Optional.of(heartbeat));
        ReflectionTestUtils.setField(service, "payQrcodeDao", mock(com.vone.mq.dao.PayQrcodeDao.class));
        when(prices.checkPrice(any(String.class))).thenAnswer(invocation -> { reserving.countDown(); return 1; });
        when(orders.setTimeout(any(String.class), any(String.class))).thenAnswer(invocation -> {
            cleaning.countDown(); releaseCleanup.await(5, java.util.concurrent.TimeUnit.SECONDS); return 0;
        });
        QuartzService cleanup = new QuartzService();
        ReflectionTestUtils.setField(cleanup, "settingDao", settings);
        ReflectionTestUtils.setField(cleanup, "payOrderDao", orders);
        ReflectionTestUtils.setField(cleanup, "tmpPriceDao", prices);
        ReflectionTestUtils.setField(cleanup, "webService", service);
        java.util.concurrent.ExecutorService executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            java.util.concurrent.Future<?> expiry = executor.submit(cleanup::timerToZZP);
            org.junit.Assert.assertTrue(cleaning.await(2, java.util.concurrent.TimeUnit.SECONDS));
            java.util.concurrent.Future<?> creation = executor.submit(() -> {
                startingCreation.countDown();
                assertEquals(1, service.createOrder("race-order", "mapflow-v1", 1, "10.00", "http://127.0.0.1/notify", "https://xxian.fun/",
                        WebService.md5("race-ordermapflow-v1110.00secret")).getCode());
            });
            org.junit.Assert.assertTrue(startingCreation.await(2, java.util.concurrent.TimeUnit.SECONDS));
            org.junit.Assert.assertFalse("allocation must wait for expiration cleanup", reserving.await(200, java.util.concurrent.TimeUnit.MILLISECONDS));
            releaseCleanup.countDown();
            expiry.get(3, java.util.concurrent.TimeUnit.SECONDS); creation.get(3, java.util.concurrent.TimeUnit.SECONDS);
        } finally { releaseCleanup.countDown(); executor.shutdownNow(); }
    }
}
