<script setup>
// 说明页：双方案对比、许可、兼容、参考候选。内容依据 web-player-tech-scheme.md §3–§5。
</script>

<template>
  <div class="about">
    <section>
      <h2>flv/hls双方案对比</h2>
      <table class="about-table">
        <thead>
          <tr>
            <th>维度</th>
            <th>方案 A：mpegts.js + hls.js（主路径推荐）</th>
            <th>方案 B：h265web.js（对照路径）</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>定位</td>
            <td>协议专用库：FLV/TS ↔ mpegts.js；HLS ↔ hls.js</td>
            <td>偏全能 Web 播放器（多协议 + 硬解/软解）</td>
          </tr>
          <tr>
            <td>许可</td>
            <td>均为 Apache-2.0，许可干净，客户可直接抄进自有产品</td>
            <td>CYL_Free-1.0（可商用嵌入；禁止单独售卖为播放器商品；非 OSI 标准许可）</td>
          </tr>
          <tr>
            <td>优势</td>
            <td>
              ① 与「一协议一页」对齐，只关心一种协议时心智负担小 ② 社区事实标准、示例多 ③ 许可省心 ④
              解封装与渲染路径清晰（MSE→&lt;video&gt;）
            </td>
            <td>
              ① H.265 软解/硬解路径更完整，弱环境「能播」概率更高 ② 单库覆盖面广 ③
              适合验证软解发热、清晰度、延迟上限
            </td>
          </tr>
          <tr>
            <td>劣势</td>
            <td>
              ① H.265 主要依赖浏览器硬解（MSE/系统解码器）② 无硬解时需自建 WASM/WebCodecs 或提示切
              H.264，软解体验弱于全能播放器
            </td>
            <td>
              ① 与「单一协议最小依赖」目标不同构，体积/复杂度更大 ②维护与 API 风格不如 mpegts/hls 两件套「行业默认」
            </td>
          </tr>
          <tr>
            <td>平台兼容</td>
            <td>PC Chrome/Edge 较友好；Firefox/部分环境 HEVC 弱；Safari 上 FLV 靠 JS、HLS 相对自然</td>
            <td>硬解可用走硬解，否则软解兜底——H.265 覆盖面通常优于纯 MSE 方案；代价是包体、CPU、发热</td>
          </tr>
          <tr>
            <td>适用</td>
            <td>「只接 FLV」或「只接 HLS」的正式参考路径</td>
            <td>同一 FLV/HLS 场景下的对照实现，由用户自行选型</td>
          </tr>
        </tbody>
      </table>

      <h3>选型建议</h3>
      <ol>
        <li>如果只是在pc web上播放，首选websdk，兼容性好，功能齐全，播放延迟低。</li>
        <li>flv/hls选型 默认跟方案 A：协议清晰、许可省心、对接成本低。</li>
        <li>想要兼容性好，要支持h5、H265：评估方案 B 。</li>
      </ol>
    </section>
    <section>
      <h2>websdk（私协页）要点</h2>
      <ul>
        <li>单 WebPlayer 实例同时承担直播、回放、对讲、下载、录像，不要多建。</li>
        <li>每次播放前调 <code>SetVolume</code>、每次对讲前调 <code>SetMicVolume</code>，避免残留值。</li>
        <li>
          回放进度条使用的JTimeLine 组件不属于 websdk，仅作参考，可以使用其他方案。以 <code>GetCurTimestamp()</code> 驱动，
          <code>SetStartTime()</code> 跳转。
        </li>
        <li>兼容基线：Chrome 85+、Firefox 82.0.3+；支持 H.264/H.265、G.711/AAC。</li>
      </ul>
    </section>

    <section>
      <h2>许可</h2>
      <table class="about-table">
        <thead>
          <tr>
            <th>组件</th>
            <th>许可</th>
            <th>要点</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>mpegts.js</td>
            <td>Apache-2.0</td>
            <td>可商用、可嵌入、可修改分发；保留许可与版权声明即可。主路径推荐。</td>
          </tr>
          <tr>
            <td>hls.js</td>
            <td>Apache-2.0</td>
            <td>同上。主路径推荐。</td>
          </tr>
          <tr>
            <td>h265web.js</td>
            <td>CYL_Free-1.0</td>
            <td>
              允许在自有项目中使用、允许商业制作与盈利；<strong>禁止将本项目单独售卖/盈利</strong
              >（须结合实际业务，如监控安防、视频网站等使用）；权利归创始人，无担保。非 OSI
              标准许可，建议法务复核。
            </td>
          </tr>
          <tr>
            <td>公司 websdk</td>
            <td>闭源</td>
            <td>随本仓库提供，供平台集成参考。</td>
          </tr>
        </tbody>
      </table>
      <p class="about-note">
        h265web.js 许可原文随仓库附带：<code>licenses/h265web.js/LICENSE-Free_CN.MD</code>（中文）/
        <code>LICENSE-Free_EN.MD</code>（英文）。本页摘录仅供参考，
        <strong>商用结论以原文为准，落地前法务复核</strong>。本 Demo 内嵌的 h265web.js 取自
        <a href="https://github.com/numberwolf/h265web.js" target="_blank" rel="noreferrer">numberwolf/h265web.js</a>
        master（commit <code>87a9c728</code>）的 <code>static/</code> 预构建产物。
      </p>
    </section>

    <section>
      <h2>参考候选（仅文档，不实现）</h2>
      <table class="about-table">
        <thead>
          <tr>
            <th>候选</th>
            <th>许可倾向</th>
            <th>能力侧重点</th>
            <th>建议</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Jessibuca Pro</td>
            <td>商业授权（开源版 GPL，勿当免费底座）</td>
            <td>FLV/多协议、H.265、产品化播放器</td>
            <td>采购对标；Demo 不实现</td>
          </tr>
          <tr>
            <td>libmedia</td>
            <td>LGPL-3.0（有条件）</td>
            <td>TS 媒体库，WebCodecs+WASM，协议面广</td>
            <td>中长期引擎候选；合规成本高</td>
          </tr>
          <tr>
            <td>EasyPlayer 系</td>
            <td>偏商业产品</td>
            <td>监控场景、多协议</td>
            <td>询价对标；勿当开源底座</td>
          </tr>
          <tr>
            <td>Jessibuca 开源版</td>
            <td>GPL-3.0</td>
            <td>架构/降级参考价值高</td>
            <td><strong>仅学习</strong>；闭源产品慎用</td>
          </tr>
          <tr>
            <td>金山 h265webplayer 等</td>
            <td>商务/token</td>
            <td>H.265 WASM</td>
            <td>商务路径，非 Demo 依赖</td>
          </tr>
        </tbody>
      </table>
      <p class="about-note">
        上述候选不进入 Demo 编码范围。商用结论以各项目当前 LICENSE/商务条款为准，
        <strong>落地前法务复核</strong>。未列入「可默认商用」：无 LICENSE 仓、Anti-996、纯 GPL
        开源直接嵌入闭源产品等。
      </p>
    </section>


  </div>
</template>

<style scoped>
.about {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1080px;
}

.about section {
  padding: 16px 20px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.about h2 {
  margin: 0 0 12px;
  font-size: 16px;
}

.about h3 {
  margin: 16px 0 8px;
  font-size: 14px;
}

.about p,
.about li {
  line-height: 1.7;
  color: var(--color-text);
}

.about-note {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--color-text-sub);
}

.about-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.about-table th,
.about-table td {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
  line-height: 1.6;
}

.about-table th {
  background: var(--color-bg);
  white-space: nowrap;
}

code {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--color-bg);
  font-size: 12px;
}
</style>
