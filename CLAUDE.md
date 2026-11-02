# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

面向公司平台开发者的 Web 播放参考 Demo（Vite + Vue3）：演示 ① 如何对接公司闭源 websdk（JVMP 私协：直播 / 回放 / 对讲），② 如何用开源方案播放 HTTP-FLV / WS-FLV / HLS。权威设计文档是 `web-player-tech-scheme.md`，实现前先读；本文件只摘不可从代码推导的决策与坑。

当前仓库尚未脚手架化（无 package.json / 源码），只有方案文档与 websdk 参考材料，页面由研发按方案落地,使用git来管理代码。

## 核心架构原则（勿违背）

1. **不做统一 Facade**：不同协议/方案各用独立页面，禁止抽象公共播放器接口。「一协议一页」是有意为之——方便开发者只收藏/抄录自己需要的一页。
2. **页面级隔离**：websdk 与 mpegts.js / hls.js / h265web.js 不共享播放实例。公司私协 / 对讲 / 回放业务只用 websdk，不与开源方案混用一套实例。
3. **只实现方案标注「要实现」的页面**；方案第 5 节的参考候选（Jessibuca Pro、libmedia、EasyPlayer 系、Jessibuca 开源版、金山 h265webplayer 等）仅写入说明页文档，不进代码。

## 页面清单

| 路由/页 | 依赖 | 用途 | 范围 |
|---------|------|------|------|
| 私协页 | 公司 websdk | JVMP 直播 / 回放 / 对讲 | 要实现 |
| FLV 主路径 | mpegts.js | HTTP-FLV / WS-FLV | 要实现 |
| HLS 主路径 | hls.js | HLS 直播 / 点播 | 要实现 |
| FLV 对照 | h265web.js | 同协议对照实现（用户自选） | 要实现 |
| HLS 对照 | h265web.js | 同上 | 要实现 |
| 说明页 | — | 双方案对比、许可、兼容、参考候选 | 要实现 |

三协议主路径与对照页共用 UI 骨架：左 = 播放区 + 底栏控件（播放/暂停、对讲〈视页面〉、音量、全屏）；右 = 播放地址（可复制）、视频信息、浏览器/解码能力探测结果；顶 = 播放地址等控件，**无设备号、无通道号**。测试流不做内置，URL 输入框占位即可。

## websdk 集成要点

SDK 文件在 `websdk/websdk/`（闭源 bundle，勿修改）：`JWebPlayer.bundle.js` 为主入口（暴露全局 `JWebPlayer`），`decoder.js` / `decoder.wasm`、`wasm_decoder.bundle.js`、`stream_client.bundle.js`、`audio_proccessor.bundle.js`、`audio_render_proccessor.bundle.js` 为运行时按需加载的解码/收流/音频组件。

- 全部 SDK 文件须部署在 WEB 根目录（与 index.html 同级），或构造/Play 时传 `prefixPath`；Vite 项目放 `public/`。
- 构造 options：`container` 必填且**必须是 div**（不能是 video/canvas 标签）；`prefixPath` 必填；`decodeType`（默认/wasm/webcodec/video 标签）通常不用指定。
- **单实例**：一个 WebPlayer 实例同时承担直播、回放、对讲、下载，不要多建。
- **`codec_loaded` 事件是前置门槛**：未触发前直播 / 对讲 / 回放均不可用。
- `Play({url})` 返回 Promise，按 URL 自动区分直播/回放；直播模式调 `Stop()` 会连带关闭对讲（回放模式不关下载）。
- 每次播放/对讲前重设 `SetVolume`（默认 1.0）与 `SetMicVolume`（默认 0.8），避免页面残留值与默认值不一致。
- 事件经 `webplayer.on('事件名')` 订阅（事件常量名拼写即为 `JV_WEBPLALYER_EVENT`），完整 API 与事件表见 `websdk/demo的使用说明.md`，勿凭记忆写接口。
- 回放时间轴组件 JTimeLine **不属于 websdk**：官方 demo 源码（含 JtimeLine.js）不在本仓库，进度条需自行实现或另行向厂商索取；`GetCurTimestamp()` 可用于驱动进度。
- 兼容基线（厂商口径）：Chrome 85+、Firefox 82.0.3+；支持 H.264/H.265、G.711/AAC。

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

仓库目前无 package.json。脚手架（Vite + Vue3）落定后按 Vite 惯例：`npm install`、`npm run dev`、`npm run build`、`npm run preview`——以生成的 package.json scripts 为准。官方 websdk demo（不在本仓库）的参考命令为 `npm run serve` → localhost:8088。

## 参考文档索引

- `web-player-tech-scheme.md` — 技术方案：页面划分、双方案（A: mpegts.js+hls.js / B: h265web.js）对比、选型建议。实现的权威依据。
- `websdk/demo的使用说明.md` — websdk API 全量说明：初始化、直播/回放/对讲/下载/录像接口、事件表。
