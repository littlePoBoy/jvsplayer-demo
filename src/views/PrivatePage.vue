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

const containerEl = useTemplateRef('containerEl')
const playUrl = ref('')
const mode = ref('live') // 仅控制界面展示形态；SDK 以 URL 自行区分直播/回放
const volume = ref(1)
const isMuted = ref(false)
const codecReady = ref(false)
const hasPlayer = ref(false)
const isPaused = ref(false)
const isTalking = ref(false)
const isRecording = ref(false)
const isDownloading = ref(false)
const curTs = ref(null)
const metaInfo = ref(null)
const status = ref({ text: '初始化中…', kind: '' })
const capRows = ref([])

let webplayer = null
let progressTimer = null
let metaTimer = null

function setStatus(text, kind = '') {
  status.value = { text, kind }
}

function safeMsg(msg) {
  if (msg === null || msg === undefined) {
    return ''
  }
  if (typeof msg === 'string' || typeof msg === 'number') {
    return String(msg)
  }
  try {
    return JSON.stringify(msg)
  } catch {
    return String(msg)
  }
}

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
// 本页未指定 decodeType（=自动），实际解码器按右侧能力探测同序推断。
const decodeMode = computed(() => {
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
    setStatus('解码器已就绪（codec_loaded），可以播放 / 回放 / 对讲。', 'is-ok')
  })
  instance.on('media_play_success', () => {
    hasPlayer.value = true
    isPaused.value = false
    setStatus('播放成功。', 'is-ok')
  })
  instance.on('media_play_stopped', () => {
    hasPlayer.value = false
    isPaused.value = false
    isTalking.value = false // 直播模式 Stop 会连带关闭对讲
    stopProgressPolling()
    stopMetaPolling()
    metaInfo.value = null
    setStatus('播放已停止。', '')
  })
  instance.on('live_failed', (msg) => {
    hasPlayer.value = false
    setStatus(`直播失败：${safeMsg(msg)}`, 'is-error')
  })
  instance.on('vod_failed', (msg) => {
    hasPlayer.value = false
    setStatus(`回放失败：${safeMsg(msg)}`, 'is-error')
  })
  instance.on('vod_pausing', () => {
    isPaused.value = true
    setStatus('回放已暂停。', '')
  })
  instance.on('vod_speed', (msg) => {
    setStatus(`倍速切换成功：${safeMsg(msg)}`, 'is-ok')
  })
  instance.on('vod_over', () => {
    isPaused.value = true
    stopProgressPolling()
    setStatus('回放播放完毕。', '')
  })
  instance.on('vod_progress', (msg) => {
    handleProgressMsg(msg)
  })
  instance.on('talk_started', () => {
    isTalking.value = true
    setStatus('对讲已打开。', 'is-ok')
  })
  instance.on('talk_failed', (msg) => {
    isTalking.value = false
    setStatus(`对讲失败：${safeMsg(msg)}`, 'is-error')
  })
  instance.on('talk_stopped', () => {
    isTalking.value = false
    setStatus('对讲已关闭。', '')
  })
  instance.on('download_failed', (msg) => {
    isDownloading.value = false
    setStatus(`下载失败：${safeMsg(msg)}`, 'is-error')
  })
  instance.on('download_over', () => {
    setStatus('下载完毕。', 'is-ok')
  })
  instance.on('download_progress', (msg) => {
    setStatus(`下载中… ${safeMsg(msg)}`, '')
  })
  instance.on('download_stopped', () => {
    isDownloading.value = false
    setStatus('下载已停止。', '')
  })
  instance.on('recordered_one_file', (fileName) => {
    setStatus(`录像文件已保存：${safeMsg(fileName)}`, 'is-ok')
  })
}

// ---------- 业务操作 ----------

async function onPlay() {
  if (!webplayer) {
    setStatus('websdk 尚未初始化完成。', 'is-error')
    return
  }
  if (!codecReady.value) {
    setStatus('解码器尚未加载完成（codec_loaded 未触发），直播 / 回放 / 对讲暂不可用。', 'is-error')
    return
  }
  const target = playUrl.value.trim()
  if (!isAllowedStreamUrl(target)) {
    setStatus('播放地址无效：仅支持 ws(s)/http(s) 协议。', 'is-error')
    return
  }
  try {
    // 文档要求：每次播放前重设音量，避免页面残留值与默认值不一致（静音时按 0 生效）
    webplayer.SetVolume(isMuted.value ? 0 : Number(volume.value))
    await webplayer.Play({ url: target })
    hasPlayer.value = true
    isPaused.value = false
    curTs.value = null
    metaInfo.value = null
    startMetaPolling()
    if (mode.value === 'vod') {
      startProgressPolling()
    }
    setStatus('播放中…', 'is-ok')
  } catch (err) {
    setStatus(`播放失败：${err?.message ?? safeMsg(err)}`, 'is-error')
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
  setStatus('已停止。', '')
}

async function onScreenshot() {
  try {
    await webplayer.ScreenShot({ type: 'download', format: 'png' })
    setStatus('截图已保存（默认文件名：快照+时间戳）。', 'is-ok')
  } catch (err) {
    setStatus(`截图失败：${err?.message ?? safeMsg(err)}`, 'is-error')
  }
}

async function onToggleRecord() {
  if (isRecording.value) {
    webplayer.StopRecorde()
    isRecording.value = false
    setStatus('录像已停止。', 'is-ok')
    return
  }
  try {
    await webplayer.StartRecorde()
    isRecording.value = true
    setStatus('录像中…（每 100MB 保存一个 mp4，编解码参数变化也会切文件）', 'is-ok')
  } catch (err) {
    setStatus(`录像启动失败：${err?.message ?? safeMsg(err)}`, 'is-error')
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
    setStatus(`websdk 加载失败：${err.message}。请确认 SDK 文件已部署到 public/websdk/。`, 'is-error')
    return
  }
  webplayer = new window.JWebPlayer({
    container: containerEl.value,
    prefixPath: `${BASE_URL}websdk/`,
  })
  wireEvents(webplayer)
  setStatus('websdk 已加载，等待解码器（codec_loaded）…', '')
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
        业务形态
        <select v-model="mode" class="select">
          <option value="live">直播</option>
          <option value="vod">回放</option>
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
    </template>

    <!-- <template #status>
      <span :class="status.kind">{{ status.text }}</span>
    </template> -->

    <template #info>
      <InfoPanel title="视频信息" :rows="videoRows" />
      <InfoPanel title="浏览器 / 解码能力" :rows="capRows" />
    </template>
  </PlayerShell>
</template>
