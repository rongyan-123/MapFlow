package com.vone.mq.service;

import com.vone.mq.dao.PayOrderDao;
import com.vone.mq.dao.PayQrcodeDao;
import com.vone.mq.dao.SettingDao;
import com.vone.mq.dao.TmpPriceDao;
import com.vone.mq.dto.CommonRes;
import com.vone.mq.dto.CreateOrderRes;
import com.vone.mq.entity.PayOrder;
import com.vone.mq.entity.PayQrcode;
import com.vone.mq.entity.Setting;
import com.vone.mq.utils.Arith;
import com.vone.mq.utils.HttpRequest;
import com.vone.mq.utils.ResUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.DigestUtils;

import java.text.SimpleDateFormat;
import java.math.BigDecimal;
import java.util.Date;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class WebService {
    @Autowired
    private SettingDao settingDao;
    @Autowired
    private PayOrderDao payOrderDao;
    @Autowired
    private TmpPriceDao tmpPriceDao;
    @Autowired
    private PayQrcodeDao payQrcodeDao;

    public synchronized CommonRes createOrder(String payId, String param, Integer type, String price, String notifyUrl, String returnUrl, String sign){
        String key = settingDao.findById("key").get().getVvalue();
        String jsSign =  md5(payId+param+type+price+key);
        if (!sign.equals(jsSign)){
            return ResUtil.error("签名校验不通过");
        }

        Double priceD;
        try {
            BigDecimal decimal = new BigDecimal(price);
            if (decimal.signum() <= 0 || decimal.stripTrailingZeros().scale() > 2 || decimal.compareTo(new BigDecimal("10000")) > 0) {
                return ResUtil.error("订单金额无效");
            }
            priceD = decimal.doubleValue();
        } catch (RuntimeException invalid) { return ResUtil.error("订单金额无效"); }
        PayOrder existing = payOrderDao.findByPayId(payId);
        if (existing != null) {
            if (existing.getType() != type || Double.compare(existing.getPrice(), priceD) != 0 ||
                    !java.util.Objects.equals(existing.getParam(), param) ||
                    !java.util.Objects.equals(existing.getNotifyUrl(), notifyUrl) ||
                    !java.util.Objects.equals(existing.getReturnUrl(), returnUrl)) {
                return ResUtil.error("商户订单参数不一致");
            }
            return getOrder(existing.getOrderId());
        }
        String payUrl = settingDao.findById(type == 1 ? "wxpay" : "zfbpay").get().getVvalue();
        if (payUrl == null || payUrl.isEmpty()) { return ResUtil.error("请您先进入后台配置程序"); }


        Date currentTime = new Date();

        SimpleDateFormat formatter = new SimpleDateFormat("yyyyMMddHHmmss");

        String orderId = formatter.format(currentTime) + (int)(1000+Math.random()*(9999-1000+1));

        int payQf = Integer.parseInt(settingDao.findById("payQf").get().getVvalue());
        //实际支付价格
        double reallyPrice = priceD;

        int row = 0;
        int attempts = 0;
        while (row == 0 && attempts++ <= 100){
            // Quarantine recently closed/paid amounts; late duplicates cannot pay a new order.
            long now = System.currentTimeMillis();
            boolean quarantined = !payOrderDao.findAllByReallyPriceAndTypeAndCloseDateBetween(reallyPrice, type, now - 300_000, now).isEmpty();
            try {
                row = quarantined ? 0 : tmpPriceDao.checkPrice(type+"-"+reallyPrice);
            }catch (Exception e){
                row = 0;
            }

            if (row == 0){
                if (payQf==1){

                    reallyPrice = Arith.add(reallyPrice,0.01);
                }else{
                    reallyPrice = Arith.sub(reallyPrice,0.01);
                }

            }else{
                break;
            }
            if (reallyPrice<=0 || reallyPrice>10000){
                return ResUtil.error("所有金额均被占用");
            }
        }

        if (row == 0) { return ResUtil.error("可用付款金额暂时不足，请稍后重试"); }

        int isAuto = 1;

        PayQrcode payQrcode = payQrcodeDao.findByPriceAndType(reallyPrice,type);
        if (payQrcode!=null){
            payUrl = payQrcode.getPayUrl();
            isAuto = 0;
        }


        PayOrder payOrder = new PayOrder();
        payOrder.setPayId(payId);
        payOrder.setOrderId(orderId);
        payOrder.setCreateDate(new Date().getTime());
        payOrder.setPayDate(0);
        payOrder.setCloseDate(0);
        payOrder.setParam(param);
        payOrder.setType(type);
        payOrder.setPrice(priceD);
        payOrder.setReallyPrice(reallyPrice);
        payOrder.setNotifyUrl(notifyUrl);
        payOrder.setReturnUrl(returnUrl);
        payOrder.setState(0);
        payOrder.setIsAuto(isAuto);
        payOrder.setPayUrl(payUrl);

        payOrderDao.save(payOrder);



        String timeOut = settingDao.findById("close").get().getVvalue();
        CreateOrderRes createOrderRes = new CreateOrderRes(payId,orderId,type,priceD,reallyPrice,payUrl,isAuto,0,Integer.valueOf(timeOut),payOrder.getCreateDate());

        return ResUtil.success(createOrderRes);
    }
    public synchronized CommonRes closeOrder(String orderId,String sign){

        String key = settingDao.findById("key").get().getVvalue();
        String jsSign =  md5(orderId+key);
        if (!sign.equals(jsSign)){
            return ResUtil.error("签名校验不通过");
        }

        PayOrder payOrder = payOrderDao.findByOrderId(orderId);
        if (payOrder==null){
            return ResUtil.error("云端订单编号不存在");
        }
        if (payOrder.getState()!=0){
            return ResUtil.error("订单状态不允许关闭");
        }
        tmpPriceDao.delprice(payOrder.getType()+"-"+payOrder.getReallyPrice());
        payOrder.setCloseDate(new Date().getTime());
        payOrder.setState(-1);
        payOrderDao.save(payOrder);
        return ResUtil.success();
    }

    public CommonRes appHeart(String t,String sign){
        String key = settingDao.findById("key").get().getVvalue();
        String jssign = md5(t+key);
        if (!jssign.equals(sign)){
            return ResUtil.error("签名校验错误");
        }
        long cz = Long.valueOf(t)-new Date().getTime();

        if (cz<0){
            cz = cz*-1;
        }
        if (cz>50*1000){
            return ResUtil.error("客户端时间错误");
        }

        Setting setting = new Setting();
        setting.setVkey("lastheart");
        setting.setVvalue(t);
        settingDao.save(setting);

        setting.setVkey("jkstate");
        setting.setVvalue("1");
        settingDao.save(setting);

        return ResUtil.success();
    }

    public synchronized CommonRes appPush(Integer type,String price,String t,String sign){
        if (type == null || (type != 1 && type != 2) || price == null || t == null || sign == null){
            return ResUtil.error("收款通知参数无效");
        }
        double amount;
        long eventTime;
        try {
            BigDecimal decimalAmount = new BigDecimal(price);
            if (decimalAmount.signum() <= 0 || decimalAmount.stripTrailingZeros().scale() > 2) {
                return ResUtil.error("收款金额无效");
            }
            amount = decimalAmount.doubleValue();
            eventTime = Long.parseLong(t);
        } catch (NumberFormatException e) {
            return ResUtil.error("收款通知参数无效");
        }
        if (!Double.isFinite(amount)) {
            return ResUtil.error("收款金额无效");
        }
        String key = settingDao.findById("key").get().getVvalue();
        long cz = eventTime-new Date().getTime();

        if (cz<0){
            cz = cz*-1;
        }
        if (cz>50*1000){
            return ResUtil.error("客户端时间错误");
        }
        String jssign = md5(type+""+price+t+key);
        if (!jssign.equals(sign)){
            return ResUtil.error("签名校验错误");
        }

        Setting setting = new Setting();
        setting.setVkey("lastpay");
        setting.setVvalue(t);
        settingDao.save(setting);
        PayOrder tmp = payOrderDao.findByPayDate(eventTime);
        if (tmp!=null){
            return ResUtil.error("重复推送");
        }

        List<PayOrder> candidates = new ArrayList<>(payOrderDao.findAllByReallyPriceAndStateAndType(amount,0,type));
        long timeoutMillis = Long.parseLong(settingDao.findById("close").get().getVvalue()) * 60_000;
        candidates.removeIf(order -> order.getCreateDate() > eventTime || eventTime > order.getCreateDate() + timeoutMillis);
        List<PayOrder> recentPayments = payOrderDao.findAllByReallyPriceAndTypeAndPayDateBetween(
                amount, type, eventTime - 300_000, eventTime);
        boolean recentlyMatched = recentPayments.stream().anyMatch(order -> order.getState() == 1 || order.getState() == 2);
        if (candidates.size() != 1 || recentlyMatched) {
            PayOrder review = new PayOrder();
            review.setPayId("待核实收款");
            review.setOrderId("review-" + UUID.randomUUID());
            review.setCreateDate(System.currentTimeMillis());
            review.setPayDate(eventTime);
            review.setCloseDate(0);
            review.setParam(recentlyMatched ? "近期同金额收款需复核" :
                    candidates.isEmpty() ? "无匹配订单" : "同金额订单冲突");
            review.setType(type);
            review.setPrice(amount);
            review.setReallyPrice(amount);
            review.setState(3);
            review.setIsAuto(0);
            review.setPayUrl("");
            payOrderDao.save(review);
            return ResUtil.error("收款无法唯一匹配订单，需人工核实");
        }
        PayOrder payOrder = candidates.get(0);

        tmpPriceDao.delprice(payOrder.getType()+"-"+payOrder.getReallyPrice());

        payOrder.setState(1);
        payOrder.setPayDate(eventTime);
        payOrder.setCloseDate(new Date().getTime());
        payOrderDao.save(payOrder);

        return notifyPayment(payOrder);
    }

    public synchronized void retryPendingNotifications() {
        for (PayOrder order : payOrderDao.findFirst5ByStateOrderByIdAsc(2)) {
            notifyPayment(order);
        }
    }

    private CommonRes notifyPayment(PayOrder payOrder) {
        String key = settingDao.findById("key").get().getVvalue();
        String p = "payId="+payOrder.getPayId()+"&param="+payOrder.getParam()+"&type="+payOrder.getType()+"&price="+payOrder.getPrice()+"&reallyPrice="+payOrder.getReallyPrice();
        String sign = md5(payOrder.getPayId()+payOrder.getParam()+payOrder.getType()+payOrder.getPrice()+payOrder.getReallyPrice()+key);
        p = p+"&sign="+sign;
        String url = payOrder.getNotifyUrl();
        if (url==null || url.equals("")){
            url = settingDao.findById("notifyUrl").get().getVvalue();
            if (url==null || url.equals("")){
                payOrderDao.setState(2,payOrder.getId());
                return ResUtil.error("您还未配置异步通知地址，请现在系统配置中配置");
            }
        }

        String res = HttpRequest.sendGet(url,p);

        if (res!=null && res.equals("success")){
            if (payOrder.getState() == 2) { payOrderDao.setState(1,payOrder.getId()); }
            return ResUtil.success();
        }else {
            //通知失败，设置状态为2
            payOrderDao.setState(2,payOrder.getId());
            return ResUtil.error("通知异步地址失败");
        }
    }

    public CommonRes getOrder(String orderId){
        PayOrder payOrder = payOrderDao.findByOrderId(orderId);
        if (payOrder==null){
            return ResUtil.error("云端订单编号不存在");
        }

        String timeOut = settingDao.findById("close").get().getVvalue();
        CreateOrderRes createOrderRes = new CreateOrderRes(
                payOrder.getPayId(),payOrder.getOrderId(),payOrder.getType(),payOrder.getPrice(),payOrder.getReallyPrice()
                ,payOrder.getPayUrl(),payOrder.getIsAuto(),payOrder.getState(),Integer.valueOf(timeOut),payOrder.getCreateDate());
        createOrderRes.setPayDate(payOrder.getPayDate());

        return ResUtil.success(createOrderRes);
    }



    public CommonRes checkOrder(String orderId){
        PayOrder payOrder = payOrderDao.findByOrderId(orderId);
        if (payOrder==null){
            return ResUtil.error("云端订单编号不存在");
        }
        if (payOrder.getState()==0){
            return ResUtil.error("订单未支付");
        }
        if (payOrder.getState()==3){
            return ResUtil.error("收款待人工核实");
        }
        if (payOrder.getState()==-1){
            return ResUtil.error("订单已过期");
        }
        String key = settingDao.findById("key").get().getVvalue();
        //执行通知
        String p = "payId="+payOrder.getPayId()+"&param="+payOrder.getParam()+"&type="+payOrder.getType()+"&price="+payOrder.getPrice()+"&reallyPrice="+payOrder.getReallyPrice();
        String sign = md5(payOrder.getPayId()+payOrder.getParam()+payOrder.getType()+payOrder.getPrice()+payOrder.getReallyPrice()+key);
        p = p+"&sign="+sign;
        String url = payOrder.getReturnUrl();
        if (url==null){
            url = settingDao.findById("returnUrl").get().getVvalue();
        }

        return ResUtil.success(url+"?"+p);
    }

    public CommonRes getState(String t,String sign){

        String key = settingDao.findById("key").get().getVvalue();
        String jsSign =  md5(t+key);
        if (!sign.equals(jsSign)){
            return ResUtil.error("签名校验不通过");
        }

        Map<String,String> map = new HashMap<>();
        String state = settingDao.findById("jkstate").get().getVvalue();
        String lastheart = settingDao.findById("lastheart").get().getVvalue();
        String lastpay = settingDao.findById("lastpay").get().getVvalue();
        map.put("state",state);
        map.put("lastheart",lastheart);
        map.put("lastpay",lastpay);

        return ResUtil.success(map);
    }

    public static String md5(String text) {
        //加密后的字符串
        String encodeStr= DigestUtils.md5DigestAsHex(text.getBytes());
        return encodeStr;
    }
}
