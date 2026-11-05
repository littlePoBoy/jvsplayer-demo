# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

面向公司平台开发者的 Web 播放参考 Demo（Vite + Vue3）：演示 ① 如何对接公司闭源 websdk（JVMP 私协：直播 / 回放 / 对讲），② 如何用开源方案播放 HTTP-FLV / WS-FLV / HLS。权威设计文档是 `web-player-tech-scheme.md`，实现前先读；本文件只摘不可从代码推导的决策与坑。

仓库已脚手架化（Vite + Vue3），页面源码在 src/，用 git 管理代码。

## 核心架构原则（勿违背）

1. **不做统一 Facade**：不同协议/方案各用独立页面，禁止抽象公共播放器接口。「一协议一页」是有意为之——方便开发者只收藏/抄录自己需要的一页。
2. **页面级隔离**：websdk 与 mpegts.js / hls.js / h265web.js 不共享播放实例。公司私协 / 对讲 / 回放业务只用 websdk，不与开源方案混用一套实例。
3. **只实现方案标注「要实现」的页面**；方案第 5 节的参考候选（Jessibuca Pro、libmedia、EasyPlayer 系、Jessibuca 开源版、金山 h265webplayer 等）仅写入说明页文档，不进代码。
4. **不用写单元测试**

## 页面清单

| 路由/页 | 依赖 | 用途 | 范围 |
|---------|------|------|------|
| 私协页 | 公司 websdk | JVMP 直播 / 回放 / 截图 / 录像 / 下载 / 倍速 | 要实现 |
| FLV 主路径 | mpegts.js | HTTP-FLV / WS-FLV | 要实现 |
| HLS 主路径 | hls.js | HLS 直播 / 点播 | 要实现 |
| FLV 对照 | h265web.js | 同协议对照实现（用户自选） | 要实现 |
| HLS 对照 | h265web.js | 同上 | 要实现 |
| 说明页 | — | 双方案对比、许可、兼容、参考候选 | 要实现 |

三协议主路径与对照页共用 UI 骨架：左 = 播放区（右下角悬浮控件条：播放/暂停〈FLV/HLS〉或播放/停止〈私协页〉、静音、音量、全屏、截图/录像〈仅私协页〉，悬停显示、鼠标移开隐藏；FLV/HLS 方案无截图/录像能力则不渲染对应按钮）+ 状态行（仅私协页，显示操作回执；FLV/HLS 页无状态行，播放状态见右信息栏）；右 = 视频信息、浏览器/解码能力探测结果（播放地址不出现在右信息栏）；顶 = 平台取流控件（AccessToken、设备 SN、通道 ID、高标清切换、「获取地址」→ 调 openAPI `get_realtime_url_standard` 取播放地址并填入输入框，输入框也可手动填写，带复制按钮，见 StreamSourceBar.vue）+ 播放/停止等控件。直播播放地址可手动填写；高标清映射：高清=主码流（streamId 0）、标清=次码流（streamId 1），取到的地址 180 秒有效。取流协议按页固定：私协页 `wss`、FLV 两页 `http_flv`、HLS 两页 `hls`（HLS 两页暂只做直播取流，点播随回放一起做）。回放模式保留手动 URL 输入框（回放取址待做）。测试流不做内置，输入框占位即可。

## websdk 集成要点

SDK 文件在 `websdk/websdk/`（闭源 bundle，勿修改）

- 全部 SDK 文件须部署在 WEB 根目录（与 index.html 同级），或构造/Play 时传 `prefixPath`；Vite 项目放 `public/`。
- 构造 options：`container` 必填且**必须是 div**（不能是 video/canvas 标签）；`prefixPath` 必填；`decodeType`（默认/wasm/webcodec/video 标签）通常不用指定。
- **单实例**：一个 WebPlayer 实例同时承担直播、回放、对讲、下载，不要多建。
- **`codec_loaded` 事件是前置门槛**：未触发前直播 / 对讲 / 回放均不可用。
- `Play({url})` 返回 Promise，按 URL 自动区分直播/回放；直播模式调 `Stop()` 会连带关闭对讲（回放模式不关下载）。
- 每次播放/对讲前重设 `SetVolume`（默认 1.0）与 `SetMicVolume`（默认 0.8），避免页面残留值与默认值不一致。
- 事件经 `webplayer.on('事件名')` 订阅（事件常量名拼写即为 `JV_WEBPLALYER_EVENT`），完整 API 与事件表见 `websdk/demo的使用说明.md`，勿凭记忆写接口。
- 回放时间轴组件 JTimeLine **不属于 websdk**：官方 demo 源码（含 JtimeLine.js）不在本仓库，进度条需自行实现或另行向厂商索取；`GetCurTimestamp()` 可用于驱动进度。
- 兼容基线（厂商口径）：Chrome 85+、Firefox 82.0.3+；支持 H.264/H.265、G.711/AAC。
- 不需要读取websdk的源码，使用请参考 @websdk/demo的使用说明.md 即可。

## H.265 / 兼容策略（Demo 统一口径）

1. 播放前探测 MSE HEVC / 浏览器能力，结果展示在右侧信息栏。
2. 方案 A（mpegts.js + hls.js）：硬解优先（MSE/系统解码器）；失败时明确提示（换浏览器 / 切 H.264 / 看对照页），不做软解兜底。
3. 方案 B（h265web.js）：按其硬解→软解能力演示「能播」上限（代价是包体、CPU、发热）。
4. 验收矩阵：Chrome/Edge、Firefox、Safari、Android Chrome、iOS Safari（微信内置单测）。iOS：H.264 必过，H.265 尽力。

## 许可约束（说明页须体现）

- mpegts.js、hls.js：**Apache-2.0** —— 主路径推荐，许可干净，客户可直接抄进自有产品。
- h265web.js：**CYL_Free** —— 可嵌入业务商用，但**禁止将本项目单独售卖为播放器商品**；非 OSI 标准许可，说明页须摘录要点并建议法务复核。
- 参考候选的商用结论以各项目当前 LICENSE/商务条款为准，说明页统一标注「落地前法务复核」。

## 常用命令

官方 websdk demo（不在本仓库）的参考命令为 `npm run serve` → localhost:8088。

## 参考文档索引

- `web-player-tech-scheme.md` — 技术方案：页面划分、双方案（A: mpegts.js+hls.js / B: h265web.js）对比、选型建议。实现的权威依据。
- `websdk/demo的使用说明.md` — websdk API 全量说明：初始化、直播/回放/对讲/下载/录像接口、事件表。
- https://open.cloudsee.com/doc/docs/openAPI/media/get_realtime_url_standard — 平台取流接口（POST，X-Token 鉴权）：直播页播放地址来源；另有 JVMP 专属 `GetRealtimeUrl`（返回 jvmpUrl），若私协页 wss 标准地址 websdk 播不了可切换。
