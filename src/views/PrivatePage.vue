<script setup>
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import PlayerShell from '../components/PlayerShell.vue'
import InfoPanel from '../components/InfoPanel.vue'
import PlaybackTimeline from '../components/PlaybackTimeline.vue'
import { loadScript } from '../utils/scriptLoader.js'
import { probeCapabilities } from '../utils/capability.js'
import { isAllowedStreamUrl } from '../utils/url.js'
import { formatDateTime } from '../utils/format.js'

// 私协页：公司 websdk（JVMP 私协）直播 / 回放 / 对讲 / 截图 / 录像 / 下载 / 倍速。
// 厂商要求：单 WebPlayer 实例承担全部业务；与开源方案页面级隔离。
// 接口/事件严格按 websdk/demo的使用说明.md 书写，勿凭记忆改签名。
const BASE_URL = import.meta.env.BASE_URL
const SPEED_OPTIONS = [8, 4, 2, 1, 0.5, 0.25, 0.125]
const POLL_INTERVAL_MS = 500

const containerEl = useTemplateRef('containerEl')
const playUrl = ref('')
const talkUrl = ref('')
const downloadUrl = ref('')
const mode = ref('live') // 仅控制界面展示形态；SDK 以 URL 自行区分直播/回放
const volume = ref(1)
const micVolume = ref(0.8)
const speed = ref(1)
const seekInput = ref('')
const codecReady = ref(false)
const hasPlayer = ref(false)
const isPaused = ref(false)
const isTalking = ref(false)
const isRecording = ref(false)
const isDownloading = ref(false)
const curTs = ref(null)
const timeRange = ref(null) // { start, end } unix 秒，来自 Play() 返回的回放列表
const status = ref({ text: '初始化中…', kind: '' })
const capRows = ref([])

let webplayer = null
let progressTimer = null

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

// 从 Play() 返回的回放列表中防御性提取起止时间（厂商未文档化 list 结构，按常见键名扫描）。
const START_KEYS = ['starttime', 'startts', 'begintime', 'begints', 'start', 'begin', 'from']
const END_KEYS = ['endtime', 'endts', 'stoptime', 'stopts', 'finishtime', 'finish', 'end', 'stop', 'to']

function extractTimeRange(list) {
  const found = []
  const visit = (node, depth) => {
    if (depth > 4 || found.length > 200 || node === null || typeof node !== 'object') {
      return
    }
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, depth + 1))
      return
    }
    let start = null
    let end = null
    for (const [key, value] of Object.entries(node)) {
      if (typeof value !== 'number') {
        continue
      }
      const k = key.toLowerCase()
      if (start === null && START_KEYS.includes(k)) {
        start = normalizeSeconds(value)
      } else if (end === null && END_KEYS.includes(k)) {
        end = normalizeSeconds(value)
      }
    }
    if (start !== null && end !== null && end > start) {
      found.push({ start, end })
    }
    for (const value of Object.values(node)) {
      visit(value, depth + 1)
    }
  }
  visit(list, 0)
  if (found.length === 0) {
    return null
  }
  return {
    start: Math.min(...found.map((range) => range.start)),
    end: Math.max(...found.map((range) => range.end)),
  }
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

const urlRows = computed(() => [
  { label: '播放地址', value: playUrl.value || '（未填写）', copy: true },
  { label: '对讲地址', value: talkUrl.value || '（未填写）', copy: true },
  { label: '下载地址', value: downloadUrl.value || '（未填写）', copy: true },
])

const videoRows = computed(() => [
  { label: '业务形态', value: mode.value === 'live' ? '直播（界面）' : '回放（界面）' },
  { label: '解码器', value: codecReady.value ? '已就绪（codec_loaded）' : '加载中…' },
  { label: '播放状态', value: hasPlayer.value ? (isPaused.value ? '已暂停' : '播放中') : '未播放' },
  { label: '当前帧时间', value: formatDateTime(curTs.value) },
  { label: '倍速', value: `${speed.value}x` },
  { label: '对讲', value: isTalking.value ? '开启' : '关闭' },
  { label: '录像', value: isRecording.value ? '录像中' : '关闭' },
  { label: '下载', value: isDownloading.value ? '下载中' : '关闭' },
])

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
    // 文档要求：每次播放前重设音量，避免页面残留值与默认值不一致
    webplayer.SetVolume(Number(volume.value))
    const list = await webplayer.Play({ url: target })
    timeRange.value = extractTimeRange(list)
    hasPlayer.value = true
    isPaused.value = false
    curTs.value = null
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
  hasPlayer.value = false
  isPaused.value = false
  curTs.value = null
  setStatus('已停止。', '')
}

async function onPause() {
  try {
    await webplayer.Pause()
    isPaused.value = true
  } catch (err) {
    setStatus(`暂停失败：${err?.message ?? safeMsg(err)}`, 'is-error')
  }
}

async function onResume() {
  try {
    await webplayer.Resume()
    isPaused.value = false
    setStatus('播放中…', 'is-ok')
  } catch (err) {
    setStatus(`恢复失败：${err?.message ?? safeMsg(err)}`, 'is-error')
  }
}

async function onSeek(timestamp) {
  try {
    await webplayer.SetStartTime(Math.floor(timestamp))
    curTs.value = Math.floor(timestamp)
    setStatus(`已跳转到 ${formatDateTime(timestamp)}。`, 'is-ok')
  } catch (err) {
    setStatus(`跳转失败：${err?.message ?? safeMsg(err)}`, 'is-error')
  }
}

function onSeekFromInput() {
  if (!seekInput.value) {
    return
  }
  const timestamp = Math.floor(new Date(seekInput.value).getTime() / 1000)
  if (Number.isNaN(timestamp)) {
    setStatus('跳转时间无效。', 'is-error')
    return
  }
  onSeek(timestamp)
}

async function onStartTalk() {
  if (!codecReady.value) {
    setStatus('解码器尚未加载完成（codec_loaded 未触发），对讲暂不可用。', 'is-error')
    return
  }
  const target = talkUrl.value.trim()
  if (!isAllowedStreamUrl(target)) {
    setStatus('对讲地址无效：仅支持 ws(s)/http(s) 协议。', 'is-error')
    return
  }
  try {
    // 文档要求：每次对讲前重设麦克风音量
    webplayer.SetMicVolume(Number(micVolume.value))
    await webplayer.StartTalk({ url: target })
    setStatus('对讲连接中…', 'is-ok')
  } catch (err) {
    setStatus(`对讲启动失败：${err?.message ?? safeMsg(err)}`, 'is-error')
  }
}

function onStopTalk() {
  webplayer?.StopTalk()
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

async function onToggleDownload() {
  if (isDownloading.value) {
    try {
      await webplayer.StopDownload()
    } catch (err) {
      setStatus(`停止下载失败：${err?.message ?? safeMsg(err)}`, 'is-error')
    }
    return
  }
  const target = downloadUrl.value.trim()
  if (!isAllowedStreamUrl(target)) {
    setStatus('下载地址无效：仅支持 ws(s)/http(s) 协议。', 'is-error')
    return
  }
  try {
    await webplayer.StartDownload({ url: target })
    isDownloading.value = true
    setStatus('下载中…', 'is-ok')
  } catch (err) {
    setStatus(`下载启动失败：${err?.message ?? safeMsg(err)}`, 'is-error')
  }
}

function applyVolume() {
  webplayer?.SetVolume(Number(volume.value))
}

function applySpeed() {
  webplayer?.SetSpeed(Number(speed.value))
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
      <input v-model="talkUrl" class="input url-input" type="text" placeholder="对讲地址（ws://…）" />
      <input v-model="downloadUrl" class="input url-input" type="text" placeholder="下载地址（ws://…）" />
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

    <template #controls>
      <div class="control-bar">
        <button class="btn" type="button" :disabled="!hasPlayer || mode !== 'vod'" @click="onPause">暂停</button>
        <button class="btn" type="button" :disabled="!hasPlayer || mode !== 'vod'" @click="onResume">恢复</button>
        <PlaybackTimeline
          :cur-ts="curTs"
          :start-ts="timeRange ? timeRange.start : null"
          :end-ts="timeRange ? timeRange.end : null"
          :disabled="!hasPlayer || mode !== 'vod'"
          @seek="onSeek"
        />
        <input v-model="seekInput" class="input" type="datetime-local" :disabled="mode !== 'vod'" />
        <button
          class="btn"
          type="button"
          title="timestamp 为 unix 秒；部分设备类型需 +8h 时区偏移（见 websdk 文档 2.2.6）"
          :disabled="!hasPlayer || mode !== 'vod'"
          @click="onSeekFromInput"
        >
          跳转
        </button>
        <span class="field-label">音量</span>
        <input v-model.number="volume" type="range" min="0" max="1" step="0.01" @input="applyVolume" />
        <button class="btn" type="button" :disabled="!hasPlayer" @click="goFullscreen">全屏</button>
      </div>

      <div class="control-bar">
        <button
          class="btn"
          type="button"
          :class="{ 'btn-danger': isTalking }"
          :disabled="!codecReady"
          @click="isTalking ? onStopTalk() : onStartTalk()"
        >
          {{ isTalking ? '停止对讲' : '开始对讲' }}
        </button>
        <span class="field-label">麦克风</span>
        <input v-model.number="micVolume" type="range" min="0" max="1" step="0.01" />
        <span class="field-label">倍速</span>
        <select v-model.number="speed" class="select" :disabled="!hasPlayer || mode !== 'vod'" @change="applySpeed">
          <option v-for="item in SPEED_OPTIONS" :key="item" :value="item">{{ item }}x</option>
        </select>
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
          :class="{ 'btn-danger': isDownloading }"
          :disabled="!codecReady"
          @click="onToggleDownload"
        >
          {{ isDownloading ? '停止下载' : '开始下载' }}
        </button>
      </div>
    </template>

    <template #status>
      <span :class="status.kind">{{ status.text }}</span>
    </template>

    <template #info>
      <InfoPanel title="地址" :rows="urlRows" />
      <InfoPanel title="视频信息" :rows="videoRows" />
      <InfoPanel title="浏览器 / 解码能力" :rows="capRows" />
    </template>
  </PlayerShell>
</template>
