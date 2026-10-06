# 当前收款码

两张 PNG 来自用户 2026-10-06 提供的原图，按原始字节保存。

| 文件 | 二维码内容 | SHA-256 |
| --- | --- | --- |
| wechat.png | `wxp://f2f0XO9MxuKhCB52g30uvHa1Pxe4kqoOc9ubMFa82j6b_uM2V3I_cgZzPVoQ5wHbXl0z` | `97a32e1ff21d0ed864327dce079b180dc6cfe0e19b0530e0565bfa034813e6f8` |
| alipay.png | `https://qr.alipay.com/2m611628fhnturpr4p9bs96` | `d115f8041e9e6d99eb7649b8c40c3022b3332f1ca177906d61e970d4c00a513d` |

生产后端的内嵌默认码位于 `D:\mapflow-server-payment-listener\assets\payment-qr\`，Vmq 也配置为这些内容。旧订单保留历史图片版本。

20:40 左右按用户反馈替换微信码：444×447 原图，经 ZXing 解码校验。网站当前微信版本为 UUID 末尾 5，支付宝仍为 4。旧版微信 3 和其订单保留；重新创建订单后才使用新码。
