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
}
