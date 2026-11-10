# JVS Web 播放参考 Demo

面向中维平台开发者的 Web 播放参考（Vite + Vue 3）。一协议一页，按自己要接的协议抄对应页面即可。

| 路由 | 依赖 | 用途 |
|------|------|------|
| `#/private` | `public/websdk` | JVMP 私协：直播 / 回放 / 截图 / 录像 |
| `#/flv` | mpegts.js | HTTP-FLV / WS-FLV 主路径 |
| `#/hls` | hls.js | HLS 主路径 |
| `#/flv-alt` | h265web.js | FLV 对照（硬解失败时可软解） |
| `#/hls-alt` | h265web.js | HLS 对照 |
| `#/about` | — | 方案对比、许可、兼容 |

私协、对讲、回放只用 websdk，不与 mpegts.js / hls.js / h265web.js 共用播放实例。

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
