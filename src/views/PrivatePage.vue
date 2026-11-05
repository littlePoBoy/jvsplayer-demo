<script setup>
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import PlayerShell from '../components/PlayerShell.vue'
import InfoPanel from '../components/InfoPanel.vue'
import { loadScript } from '../utils/scriptLoader.js'
import { probeCapabilities } from '../utils/capability.js'
import { isAllowedStreamUrl } from '../utils/url.js'

// 私协页：公司 websdk（JVMP 私协）直播 / 回放 / 截图 / 录像。
// 厂商要求：单 WebPlayer 实例承担全部业务；与开源方案页面级隔离。
// 接口/事件严格按 websdk/demo的使用说明.md 书写，勿凭记忆改签名。
const BASE_URL = import.meta.env.BASE_URL
const POLL_INTERVAL_MS = 500
const META_POLL_INTERVAL_MS = 1000

// DECODE_TYPE（wasm_decoder.bundle.js 常量核对）：0=默认(自动)、1=wasm、2=webcodec、3=video标签
const DECODE_TYPE_OPTIONS = [
  { value: 0, label: '默认（自动）' },
  { value: 3, label: 'video标签（MSE）' },
  { value: 2, label: 'webcodec（硬解）' },
  { value: 1, label: 'wasm（软解）' },
]
const FORCED_DECODE_NAMES = { 1: '指定: WASM（软解）', 2: '指定: WebCodec（硬解）', 3: '指定: video标签（MSE）' }

const containerEl = useTemplateRef('containerEl')
const playUrl = ref('wss://mediadev02.cloudsee.com:20380/live/12221S8GAR8Y?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NfbW9kZSI6IlB1YmxpY0Nsb3VkIiwiY2hhbm5lbF9pZCI6MCwiZGV2aWNlX2lkIjoiMTIyMjFTOEdBUjhZIiwiZXhwaXJlX3RpbWUiOjE4MDM4NTkyMDAsImlubmVyX2FkZHIiOiIxOTIuMTY4LjExNy42OjcwNzAiLCJtYXhfcGxheV9kdXJhdGlvbiI6MCwic3RyZWFtX3R5cGUiOjAsInRlbmFudF9pZCI6IiIsInVzZXJfaWQiOiI1NGFiYjE1OTNlYzM0YmVkODFkOGIwMWRkNTc4MTY0ZSJ9.FXnunl2VLMFlcw4eK_kA1lmz7UxKBsvYpC8SpoOw4Yo')
const decodeType = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const codecReady = ref(false)
const hasPlayer = ref(false)
const isPaused = ref(false)
const isTalking = ref(false)
const talkUrl = ref('wss://mediadev02.cloudsee.com:20380/talk/12221S8GAR8Y?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NfbW9kZSI6IlB1YmxpY0Nsb3VkIiwiY2hhbm5lbF9pZCI6MCwiZGV2aWNlX2lkIjoiMTIyMjFTOEdBUjhZIiwiZXhwaXJlX3RpbWUiOjE4MDM4NTkyMDAsImlubmVyX2FkZHIiOiIxOTIuMTY4LjExNy42OjcwNzAiLCJsaW5rX2tleSI6IjE3OTM4NDY0Mjc1MTE2OTYxNzIxOCIsIm1heF9wbGF5X2R1cmF0aW9uIjowLCJ0ZW5hbnRfaWQiOiIiLCJ1c2VyX2lkIjoiMDE0ZThmODg0OGVjNGNjNDk1NWJkYjc5ZTQ0MjA2NWYifQ.QABXQxcwq-eXpgxNL1tmA3GeAJjsavQuiybVfRiMSJA') // 与播放地址同款预填测试对讲流，弹窗内可改
const talkDialogVisible = ref(false)
const isRecording = ref(false)
const isDownloading = ref(false)
const curTs = ref(null)
const metaInfo = ref(null)
const capRows = ref([])

let webplayer = null
let playerOptions = null // 构造 options；Play() 时从其读取 decodeType
let progressTimer = null
let metaTimer = null

function normalizeSeconds(value) {
  // 兼容毫秒/秒两种时间戳
  return value > 1e12 ? value / 1000 : value
}

function handleProgressMsg(msg) {
  if (typeof msg === 'number') {
    const seconds = normalizeSeconds(msg)
    if (seconds > 1e9) {
      curTs.value = seconds
    }
    return
  }
  if (msg && typeof msg === 'object') {
    for (const key of ['timestamp', 'curTime', 'currentTime', 'pts', 'time', 'cur']) {
      const value = msg[key]
      if (typeof value === 'number') {
        curTs.value = normalizeSeconds(value)
        return
      }
    }
  }
}

// 流信息（与各播放页统一口径）。websdk 公开 API 未暴露流元数据（demo的使用说明.md 2.x/3.x
// 无相关接口），取自内部 m_mediaMetadata（stream_client.bundle.js 解析后经 HandleMetaDataUpdate 存放）：
// { v: { codecType, width, height, frameRate }, a: { codecType, sampleRate } }。
// codecType 枚举经 bundle 核对：视频 1=H264 2=H265；音频 1=G711A 2=G711U 4=AAC。
const VIDEO_CODEC_NAMES = { 1: 'H264', 2: 'H265' }
const AUDIO_CODEC_NAMES = { 1: 'G711A', 2: 'G711U', 4: 'AAC' }

// websdk 解码器自动链（wasm_decoder.bundle.js）：MSE(video标签) → WebCodec → WASM 软解；
// decodeType 默认(0)走自动链，实际解码器按右侧能力探测同序推断；指定后展示所选模式。
const decodeMode = computed(() => {
  if (decodeType.value !== 0) {
    return FORCED_DECODE_NAMES[decodeType.value]
  }
  const codecName = metaInfo.value ? VIDEO_CODEC_NAMES[metaInfo.value.v?.codecType] : null
  if (!codecName) {
    return '自动'
  }
  const cap = (label) => capRows.value.some((row) => row.label === label && row.value === '支持')
  const codecTag = codecName === 'H265' ? 'H.265' : 'H.264'
  if (cap(`MSE ${codecTag}`)) {
    return '自动: MSE（video标签）'
  }
  if (cap(`WebCodecs ${codecTag}`)) {
    return '自动: WebCodec（硬解）'
  }
  return '自动: WASM（软解）'
})

const videoRows = computed(() => {
  const v = metaInfo.value?.v
  const a = metaInfo.value?.a
  return [
    { label: '视频编码', value: v ? (VIDEO_CODEC_NAMES[v.codecType] ?? null) : null },
    { label: '分辨率', value: v?.width ? `${v.width} × ${v.height}` : null },
    { label: '帧率', value: v?.frameRate ? `${Math.round(v.frameRate * 100) / 100} fps` : null },
    { label: '解码模式', value: decodeMode.value },
    { label: '音频编码', value: metaInfo.value ? (a?.isValid ? (AUDIO_CODEC_NAMES[a.codecType] ?? null) : '无音频') : null },
    { label: '音频采样率', value: a?.sampleRate ? `${a.sampleRate} Hz` : null },
  ]
})

// ---------- 进度轮询（GetCurTimestamp 驱动自研进度条） ----------

function startProgressPolling() {
  stopProgressPolling()
  progressTimer = setInterval(() => {
    if (!webplayer) {
      return
    }
    // GetCurTimestamp 仅回放 player 有实现（bundle 内 vod player 定义，直播 player 无此方法，
    // 见 demo的使用说明.md 2.2.12 回放章节），直播模式跳过轮询，避免抛 GetCurTimestamp is not a function
    if (typeof webplayer.m_player?.GetCurTimestamp !== 'function') {
      return
    }
    const ts = Number(webplayer.GetCurTimestamp())
    if (Number.isFinite(ts) && ts > 0) {
      curTs.value = normalizeSeconds(ts)
    }
  }, POLL_INTERVAL_MS)
}

function stopProgressPolling() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}

// ---------- 流信息轮询（内部 m_mediaMetadata，见 videoRows 注释） ----------

function startMetaPolling() {
  stopMetaPolling()
  metaTimer = setInterval(() => {
    const meta = webplayer?.m_player?.m_mediaMetadata ?? null
    metaInfo.value = meta ? { v: { ...meta.v }, a: { ...meta.a } } : null
  }, META_POLL_INTERVAL_MS)
}

function stopMetaPolling() {
  if (metaTimer) {
    clearInterval(metaTimer)
    metaTimer = null
  }
}

// ---------- 事件订阅（事件表见 demo的使用说明.md 第 3 节） ----------

function wireEvents(instance) {
  instance.on('codec_loaded', () => {
    codecReady.value = true
  })
  instance.on('media_play_success', () => {
    hasPlayer.value = true
    isPaused.value = false
  })
  instance.on('media_play_stopped', () => {
    hasPlayer.value = false
    isPaused.value = false
    isTalking.value = false // 直播模式 Stop 会连带关闭对讲
    stopProgressPolling()
    stopMetaPolling()
    metaInfo.value = null
  })
  instance.on('live_failed', (msg) => {
    console.warn('live_failed:', msg)
    hasPlayer.value = false
  })
  instance.on('vod_failed', (msg) => {
    console.warn('vod_failed:', msg)
    hasPlayer.value = false
  })
  instance.on('vod_pausing', () => {
    isPaused.value = true
  })
  instance.on('vod_speed', () => {}) // 仅回执展示；订阅保留待 UI 补回
  instance.on('vod_over', () => {
    isPaused.value = true
    stopProgressPolling()
  })
  instance.on('vod_progress', (msg) => {
    handleProgressMsg(msg)
  })
  instance.on('talk_started', () => {
    isTalking.value = true
  })
  instance.on('talk_failed', (msg) => {
    console.warn('talk_failed:', msg)
    isTalking.value = false
  })
  instance.on('talk_stopped', () => {
    isTalking.value = false
  })
  instance.on('download_failed', (msg) => {
    console.warn('download_failed:', msg)
    isDownloading.value = false
  })
  instance.on('download_over', () => {}) // 仅回执展示；订阅保留待 UI 补回
  instance.on('download_progress', () => {}) // 仅回执展示；订阅保留待 UI 补回
  instance.on('download_stopped', () => {
    isDownloading.value = false
  })
  instance.on('recordered_one_file', () => {}) // 仅回执展示；订阅保留待 UI 补回
}

// ---------- 业务操作 ----------

async function onPlay() {
  if (!webplayer) {
    return
  }
  if (!codecReady.value) {
    return
  }
  const target = playUrl.value.trim()
  if (!isAllowedStreamUrl(target)) {
    return
  }
  try {
    // 文档要求：每次播放前重设音量，避免页面残留值与默认值不一致（静音时按 0 生效）
    webplayer.SetVolume(isMuted.value ? 0 : Number(volume.value))
    // Play() 时从构造 options 读取 decodeType（m_options 即传入对象引用，bundle 核对），播放前同步下拉值
    playerOptions.decodeType = decodeType.value
    await webplayer.Play({ url: target })
    hasPlayer.value = true
    isPaused.value = false
    curTs.value = null
    metaInfo.value = null
    startMetaPolling()
    startProgressPolling()
  } catch (err) {
    console.warn('播放失败：', err)
  }
}

function onStop() {
  if (!webplayer) {
    return
  }
  // 文档：回放模式 Stop 不会关闭下载，这里主动补停；直播模式 Stop 会连带关闭对讲
  if (isDownloading.value) {
    webplayer.StopDownload().catch((err) => console.warn('StopDownload:', err))
  }
  if (isRecording.value) {
    webplayer.StopRecorde()
    isRecording.value = false
  }
  webplayer.Stop()
  stopProgressPolling()
  stopMetaPolling()
  metaInfo.value = null
  hasPlayer.value = false
  isPaused.value = false
  curTs.value = null
}

async function onScreenshot() {
  try {
    await webplayer.ScreenShot({ type: 'download', format: 'png' })
  } catch (err) {
    console.warn('截图失败：', err)
  }
}

async function onToggleRecord() {
  if (isRecording.value) {
    webplayer.StopRecorde()
    isRecording.value = false
    return
  }
  try {
    await webplayer.StartRecorde()
    isRecording.value = true
  } catch (err) {
    console.warn('录像启动失败：', err)
  }
}

function onTalkClick() {
  if (isTalking.value) {
    webplayer.StopTalk() // talk_stopped 事件里复位 isTalking
    return
  }
  talkDialogVisible.value = true
}

async function onTalkConfirm() {
  const target = talkUrl.value.trim()
  if (!webplayer || !isAllowedStreamUrl(target)) {
    return
  }
  talkDialogVisible.value = false
  try {
    // 文档要求：每次对讲前重设扬声器/麦克风音量，避免页面残留值与默认值不一致（麦克风默认 0.8）
    webplayer.SetVolume(isMuted.value ? 0 : Number(volume.value))
    webplayer.SetMicVolume(0.8)
    await webplayer.StartTalk({ url: target })
  } catch (err) {
    console.warn('对讲启动失败：', err)
  }
}

function applyVolume() {
  // 拖动音量滑杆自动取消静音
  isMuted.value = false
  webplayer?.SetVolume(Number(volume.value))
}

function toggleMute() {
  // websdk 无 SetMute，静音即 SetVolume(0)，滑杆值仍保留
  isMuted.value = !isMuted.value
  webplayer?.SetVolume(isMuted.value ? 0 : Number(volume.value))
}

function goFullscreen() {
  webplayer?.FullScreen()
}

// ---------- 生命周期 ----------

onMounted(async () => {
  capRows.value = await probeCapabilities()
  try {
    await loadScript(`${BASE_URL}websdk/JWebPlayer.bundle.js`)
  } catch (err) {
    // 加载失败通常是部署问题，保留提示文本便于排查
    console.warn(`websdk 加载失败：${err.message}。请确认 SDK 文件已部署到 public/websdk/。`)
    return
  }
  playerOptions = {
    container: containerEl.value,
    prefixPath: `${BASE_URL}websdk/`,
    decodeType: decodeType.value,
  }
  webplayer = new window.JWebPlayer(playerOptions)
  wireEvents(webplayer)
})

onUnmounted(() => {
  stopProgressPolling()
  stopMetaPolling()
  if (!webplayer) {
    return
  }
  if (isDownloading.value) {
    webplayer.StopDownload().catch((err) => console.warn('StopDownload:', err))
  }
  if (isRecording.value) {
    webplayer.StopRecorde()
  }
  if (isTalking.value) {
    webplayer.StopTalk()
  }
  webplayer.Stop()
})
</script>

<template>
  <PlayerShell>
    <template #top>
      <input
        v-model="playUrl"
        class="input url-input"
        type="text"
        placeholder="播放地址（ws://…，SDK 按 URL 区分直播/回放）"
        @keyup.enter="onPlay"
      />
      <label class="checkbox-label">
        解码模式
        <select v-model="decodeType" class="select">
          <option v-for="opt in DECODE_TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
      <button class="btn btn-primary" type="button" :disabled="!codecReady" @click="onPlay">播放</button>
      <button class="btn" type="button" :disabled="!hasPlayer" @click="onStop">停止</button>
    </template>

    <template #stage>
      <!-- websdk 要求 container 必须是 div（不能是 video/canvas 标签） -->
      <div ref="containerEl" class="stage-host"></div>
    </template>

    <template #overlay>
      <button class="btn" type="button" :disabled="!hasPlayer && !codecReady" @click="hasPlayer ? onStop() : onPlay()">
        {{ hasPlayer ? '停止' : '播放' }}
      </button>
      <button class="btn" type="button" @click="toggleMute">
        {{ isMuted ? '取消静音' : '静音' }}
      </button>
      <span class="field-label">音量</span>
      <input v-model.number="volume" type="range" min="0" max="1" step="0.01" @input="applyVolume" />
      <button class="btn" type="button" :disabled="!hasPlayer" @click="goFullscreen">全屏</button>
      <button class="btn" type="button" :disabled="!hasPlayer" @click="onScreenshot">截图</button>
      <button
        class="btn"
        type="button"
        :class="{ 'btn-danger': isRecording }"
        :disabled="!hasPlayer"
        @click="onToggleRecord"
      >
        {{ isRecording ? '停止录像' : '开始录像' }}
      </button>
      <button
        class="btn"
        type="button"
        :class="{ 'btn-danger': isTalking }"
        :disabled="!hasPlayer"
        @click="onTalkClick"
      >
        {{ isTalking ? '停止对讲' : '开始对讲' }}
      </button>
    </template>

    <template #info>
      <InfoPanel title="视频信息" :rows="videoRows" />
      <InfoPanel title="浏览器 / 解码能力" :rows="capRows" />
    </template>
  </PlayerShell>

  <!-- 对讲地址弹窗：点击悬浮条「开始对讲」弹出，确定后 StartTalk -->
  <div v-if="talkDialogVisible" class="talk-dialog-mask" @click.self="talkDialogVisible = false">
    <div class="talk-dialog">
      <div class="talk-dialog-title">开始对讲</div>
      <input
        v-model="talkUrl"
        class="input talk-dialog-input"
        type="text"
        placeholder="对讲地址（ws://…）"
        @keyup.enter="onTalkConfirm"
      />
      <div class="talk-dialog-actions">
        <button class="btn" type="button" @click="talkDialogVisible = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="!talkUrl.trim()" @click="onTalkConfirm">确定</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.talk-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}

.talk-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(420px, calc(100vw - 32px));
  padding: 16px;
  border-radius: 8px;
  background: var(--color-panel);
}

.talk-dialog-title {
  font-size: 15px;
  font-weight: 600;
}

.talk-dialog-input {
  width: 100%;
}

.talk-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
