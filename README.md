# JVS Web 播放参考 Demo

面向中维平台开发者的 Web 播放参考（Vite + Vue 3）。一协议一页，按自己要接的协议抄对应页面即可。

## 五个播放页

| 页面 | 优点 | 缺点 | 支持的功能 |
|------|------|------|------------|
| 私协 `#/private`（websdk，取流 `wss`） | 出图快、延时极低；支持H.264/H.265；支持硬解；加密传输；实况、回放、对讲、下载都支持 | 跨端面窄于 HLS（仅支持现代主流浏览器）；兼容 Chrome 85+、Firefox 82+、edge 16+ | 直播、录像列表与回放、时间轴跳播、倍速、暂停、对讲、截图、本地录像、下载、音量、全屏；|
| FLV 主路径 `#/flv`（mpegts.js，取流 `https_flv`） | 延时低于 HLS，HTTP-FLV 首次取流约 2–4 秒；支持小程序播放| H.265 依赖浏览器硬解；iOS Safari 对 FLV/MSE 支持弱| 直播：暂停、音量调整、静音、全屏 |
| HLS 主路径 `#/hls`（hls.js，取流 `hls`） | 跨平台最好，覆盖移动端、桌面、H5、Web，含微信；Safari 可原生播放；Apache-2.0 | 首次取流约 4–10 秒，延时大于 FLV 和 WSS；平台这条协议提供实时预览和加密传输。本页只接直播取流。H.265 依赖硬解，失败时换浏览器、切 H.264 或改看对照页 | 直播播放、暂停、音量、静音、全屏；Safari 走原生 HLS，其他浏览器用 MSE |
| FLV 对照 `#/flv-alt`（h265web.js，取流 `https_flv`） | 与主路径同一条 FLV；硬解失败可落到 WASM 软解，H.265 更容易播出来 | 许可是 CYL_Free：可嵌入业务，禁止把播放器单独售卖；包体、CPU 和发热更高。协议限制与 FLV 主路径相同。软解不缩短网络延时。多线程软解需要部署层加 COOP/COEP | 直播；手填回放地址的暂停、倍速、跳播；可选解码内核；音量、全屏 |
| HLS 对照 `#/hls-alt`（h265web.js，取流 `hls`） | 与主路径同一条 HLS；硬解失败可软解，弱环境更容易播 H.265 | 许可、包体和发热与 FLV 对照相同；分片延时仍按 HLS 的约 4–10 秒计。本页只接直播。软解占用 CPU，不缩短 HLS 分片延时 | 直播播放、暂停、音量、全屏；可选解码内核（含原生 HLS） |

私协、对讲、回放只用 websdk，不与 mpegts.js / hls.js / h265web.js 共用播放实例。

方案 A / B 的许可和 H.265 策略详见 `#/about`。

## 本地运行

需要 Node.js 20+。

```bash
npm install
npm run dev
```

播放地址可以手填。顶栏「获取地址」会带 AccessToken、设备 SN、通道 ID 请求平台 openAPI，结果填回输入框。Token 只保存在本机浏览器 `localStorage`，不要写进代码或提交到仓库。

`/webplayer` 反代只为了在本 Demo 里演示浏览器如何请求开放平台接口（取实时地址、录像列表、回放地址）。开发服务器把页面上的 `/webplayer` 转到平台 openAPI，并去掉这个前缀；默认测试环境是 `https://apitest.cloudsee.com:6443`。换成自己的环境：

```bash
cp .env.example .env
# 编辑 OPENAPI_PROXY_TARGET
```

实际项目不要照搬这条反代。开放平台请求应按自己的网关、鉴权和路径来发，本 Demo 的 `/webplayer` 前缀、`vite` 代理和下面的 nginx 示例都只说明演示时请求是怎么走出去的。

`npm run build` 之后没有开发代理。若只是把本 Demo 静态部署出来继续演示，需要自行把 `/webplayer` 反代到 openAPI，并去掉这个前缀，例如：

```nginx
location /webplayer/ {
  proxy_pass https://your-openapi-host/;
  proxy_set_header Host $proxy_host;
}
```

## websdk

闭源 SDK 在 `public/websdk/`，私协页通过 `prefixPath` 加载。接口说明见 `websdk使用说明.md`。容器必须是 `div`。一个 `WebPlayer` 实例同时负责直播、回放、对讲、下载。`codec_loaded` 之前不能播。

## 许可

- mpegts.js、hls.js：Apache-2.0
- h265web.js：CYL_Free-1.0，原文在 `licenses/h265web.js/`。可嵌入业务，禁止把本项目单独当作播放器商品售卖
- websdk：闭源，随本仓库提供参考集成，使用范围以平台授权为准

本仓库页面源码未单独选择开源许可证。说明页有更完整的对比。
