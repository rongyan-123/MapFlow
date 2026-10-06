package com.vone.mq.service;

import com.vone.mq.dao.PayOrderDao;
import com.vone.mq.dao.SettingDao;
import com.vone.mq.entity.PayOrder;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.Assert.assertEquals;
import static org.mockito.Mockito.*;

public class AdminServicePaymentSafetyTests {
    @Test
    public void reviewRecordCannotBeSentAsPaidOrder() {
        AdminService service = new AdminService();
        PayOrderDao orders = mock(PayOrderDao.class);
        SettingDao settings = mock(SettingDao.class);
        PayOrder review = new PayOrder();
        review.setState(3);
        when(orders.getById(7)).thenReturn(review);
        ReflectionTestUtils.setField(service, "payOrderDao", orders);
        ReflectionTestUtils.setField(service, "settingDao", settings);

        assertEquals(-1, service.setBd(7).getCode());
        verifyZeroInteractions(settings);
        verify(orders, never()).setState(anyInt(), anyLong());
    }
}
