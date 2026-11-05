<script setup>
import { computed, ref, watch } from 'vue'

// 平台取流控件（各直播页顶栏共用 UI 骨架）：
// Token / 设备SN / 通道ID / 高标清 → openAPI get_realtime_url_standard 取播放地址。
// 「获取地址」把结果填入播放地址输入框（含复制）；地址框也可手动填写，播放取当前输入值。
// 文档：https://open.cloudsee.com/doc/docs/openAPI/media/get_realtime_url_standard
// 高清=主码流 streamId 0、标清=次码流 streamId 1；返回地址 180 秒有效，过期需重新「获取地址」。
const props = defineProps({
  protocolType: { type: String, required: true }, // http_flv | https_flv | wss | hls | rtmp
})
const emit = defineEmits(['play', 'update:hasUrl'])

const STORAGE_KEYS = {
  token: 'jvsplayer.stream-source.token',
  deviceSn: 'jvsplayer.stream-source.device-sn',
  channelId: 'jvsplayer.stream-source.channel-id',
}

const OPENAPI_BASE_URL = __OPENAPI_BASE_URL__.replace(/\/+$/, '')
const ENDPOINT = `${OPENAPI_BASE_URL}/v1/api/device/video/get_realtime_url_standard`

const token = ref(localStorage.getItem(STORAGE_KEYS.token) ?? '')
const deviceSn = ref(localStorage.getItem(STORAGE_KEYS.deviceSn) ?? '')
const channelId = ref(localStorage.getItem(STORAGE_KEYS.channelId) ?? '')
const quality = ref(0) // 0=高清(主码流) 1=标清(次码流)
const playUrl = ref('')
const hasUrl = computed(() => !!playUrl.value.trim())
const fetchError = ref('')
const copied = ref(false)

watch(token, (value) => localStorage.setItem(STORAGE_KEYS.token, value))
watch(deviceSn, (value) => localStorage.setItem(STORAGE_KEYS.deviceSn, value))
watch(channelId, (value) => localStorage.setItem(STORAGE_KEYS.channelId, value))
watch(hasUrl, (value) => emit('update:hasUrl', value), { immediate: true })

async function fetchUrl() {
  fetchError.value = ''
  playUrl.value = ''
  const sn = deviceSn.value.trim()
  const channel = Number(channelId.value)
  if (!token.value.trim() || !sn || !Number.isInteger(channel) || channel < 0) {
    fetchError.value = '请填写 Token、设备 SN、通道 ID'
    return ''
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Token': token.value.trim() },
      body: JSON.stringify({
        deviceSn: sn,
        channelId: channel,
        streamId: quality.value,
        protocolType: props.protocolType,
      }),
    })
    const data = await res.json()
    if (data.code === 1000 && data.data?.url) {
      playUrl.value = data.data.url
      return data.data.url
    }
    fetchError.value = `取址失败：${data.code} ${data.msg}`
  } catch (err) {
    fetchError.value = `取址失败：${err.message}`
  }
  return ''
}

// 播放取址：地址框有值直接用（可为手动输入或 180 秒内取到的地址），为空才兜底取一次
async function ensureUrl() {
  return playUrl.value.trim() || (await fetchUrl())
}

function emitPlay() {
  if (hasUrl.value) {
    emit('play')
  }
}

function copyUrl() {
  navigator.clipboard
    .writeText(playUrl.value.trim())
    .then(() => {
      copied.value = true
      setTimeout(() => (copied.value = false), 1500)
    })
    .catch((err) => console.warn('复制失败：', err))
}

defineExpose({ fetchUrl, ensureUrl })
</script>

<template>
  <!-- display:contents 包裹：子项直接参与 page-top 的 flex 排布；单根结构供 v-show 隐藏（保持挂载，切直播/回放不丢输入与取址结果） -->
  <div class="stream-source">
    <input
      v-model="token"
      class="input source-token"
      type="text"
      placeholder="平台 AccessToken"
      @keyup.enter="emitPlay"
    />
    <input
      v-model="deviceSn"
      class="input source-sn"
      type="text"
      placeholder="设备 SN"
      @keyup.enter="emitPlay"
    />
    <input
      v-model="channelId"
      class="input source-channel"
      type="text"
      inputmode="numeric"
      placeholder="通道 ID"
      @keyup.enter="emitPlay"
    />
    <div class="quality-toggle">
      <button type="button" class="btn seg-btn" :class="{ 'seg-active': quality === 0 }" @click="quality = 0">高清</button>
      <button type="button" class="btn seg-btn" :class="{ 'seg-active': quality === 1 }" @click="quality = 1">标清</button>
    </div>
    <button class="btn" type="button" @click="fetchUrl">获取地址</button>
    <div class="source-url-group">
      <span class="field-label">播放地址</span>
      <input
        v-model="playUrl"
        class="input source-url"
        type="text"
        placeholder="点击“获取地址”或手动输入"
        :class="{ 'url-error': fetchError }"
        :title="fetchError || playUrl"
        @keyup.enter="emitPlay"
      />
    </div>
    <span v-if="fetchError" class="url-error fetch-error">{{ fetchError }}</span>
    <button class="btn" type="button" :disabled="!hasUrl" @click="copyUrl">
      {{ copied ? '已复制' : '复制' }}
    </button>
  </div>
</template>

<style scoped>
.stream-source {
  display: contents;
}

.source-token {
  flex: 1 1 220px;
  min-width: 180px;
}

.source-sn {
  width: 140px;
}

.source-channel {
  width: 88px;
}

/* 高标清切换：两态分段按钮 */
.quality-toggle {
  display: inline-flex;
}

.seg-btn {
  border-radius: 0;
}

.seg-btn:first-child {
  border-radius: var(--radius) 0 0 var(--radius);
}

.seg-btn:last-child {
  margin-left: -1px;
  border-radius: 0 var(--radius) var(--radius) 0;
}

.seg-active,
.seg-active:hover:not(:disabled) {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.source-url-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 420px;
  min-width: 300px;
}

.source-url {
  flex: 1 1 auto;
  min-width: 160px;
}

.fetch-error {
  flex: 0 1 auto;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.url-error {
  color: var(--color-danger);
}
</style>
