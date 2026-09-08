# MapFlow 浅色落地页只读验收记录

日期：2026-09-08

本轮只读验收覆盖浅色 landing 的五段滚动叙事、公共 Agent 地图、移动触控阅读和 CTA 导航。没有修改产品源码、后端或部署配置；公共地图只观察 GET 加载结果，未触发加入、聊天或其他写入。

## 最终截图

截图来自独立 browser-harness 目标，路径在 `C:\Users\Administrator\.codex\visualizations\2026\09\08\light-landing\`。

- 桌面 C：`landing-desktop-C-latest.png`
- 桌面 D（最终）：`landing-desktop-D-final.png`
- 移动 B：`landing-mobile-B-latest.png`
- 移动 C：`landing-mobile-C-latest.png`
- 移动 C→D 中点：`landing-mobile-C-D-mid-latest.png`
- 移动 D：`landing-mobile-D-latest-2.png`
- 移动 E（最终）：`landing-mobile-E-final.png`
- 长详情后回到 C：`landing-desktop-C-after-long-detail-stable.png`

早期 `landing-desktop-D-latest.png`、`landing-mobile-E-latest.png` 以及第一批 mobile-D 截图均为中间稿，最终证据分别由 `landing-desktop-D-final.png`、`landing-mobile-E-final.png` 替代。

## 已完成检查

- 通过 scene 的实际 `getBoundingClientRect()` 与滚动容器偏移计算定位；桌面 root 高 4569px、五段各 900px，移动五段各约 844px。截图均无水平溢出。
- 桌面 D reload 后 Python 地图正常 fit；74 个真实节点中首屏簇完整可见 10 个，分支显示不超过 10 个。地图缩放控件和 mini-map 位于画布底部，没有遮挡 D 本幕标题或详情标题。
- 移动 E 的“任何地方皆可用”标题为单行 `nowrap`，元素高度约 22.8px；三项功能标题完整可见，CTA 保持可操作尺寸。
- D 打开最长 description（文本长度 87）后回到 C，detail 面板约 740×110.6px；五段 scene 高度未改变，C 的 `direction-crossroads.webp` 仍完整加载（naturalWidth 1448，截图中的可视区域完整对应 C）。
- 之前的交互验收已通过：节点选择、拖拽、缩放、普通滚轮与 Ctrl+滚轮分工、移动 passive/探索/继续阅读触控、Tab+Enter 进入工作台、CTA 键盘激活、CTA 表面偏移，以及 reduced-motion 下不倾斜。

## 边界

公共地图首次加载可能受接口延迟影响；本记录只证明当前浏览器目标在数据返回后的界面和交互状态，不对后端延迟作修复声明。截图是外部验收证据，不属于仓库文件。
