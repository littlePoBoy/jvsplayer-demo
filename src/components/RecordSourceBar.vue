<script setup>
import { ref } from 'vue'
import { token, deviceSn, channelId } from '../utils/credentials.js'

// 回放取流控件（私协页回放模式顶栏）：
// Token / 设备SN / 通道ID（与 StreamSourceBar 共用）+ 查询日期 → 「获取录像文件列表」。
// 文档：https://open.cloudsee.com/doc/docs/openAPI/media/record/get_record_list
// 点击列表项时由页面调 getPlaybackUrl(record) 取播放地址：
// https://open.cloudsee.com/doc/docs/openAPI/media/record/get_playback_wss_url_bytime
// 取 wss 版本（返回 data.url，180 秒有效），与直播页同为 wss 地址；get_playback_url_bytime 只返回 jvmp:// 无法直接交给浏览器 SDK。
const emit = defineEmits(['update:records', 'update:total'])

const OPENAPI_BASE_URL = __OPENAPI_BASE_URL__.replace(/\/+$/, '')
const RECORD_LIST_ENDPOINT = `${OPENAPI_BASE_URL}/v1/api/device/record/get_record_list`
const PLAYBACK_URL_ENDPOINT = `${OPENAPI_BASE_URL}/v1/api/device/video/get_playback_wss_url_bytime`
const PAGE_SIZE = 500 // 接口单页最大 500；Demo 不做翻页，超出时仅展示前 500 条

function todayValue() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const queryDate = ref(todayValue()) // yyyy-MM-dd
const loading = ref(false)
const fetchError = ref('')

function readCredentials() {
  const sn = deviceSn.value.trim()
  const channel = Number(channelId.value)
  if (!token.value.trim() || !sn || channelId.value.trim() === '' || !Number.isInteger(channel) || channel < 0) {
    fetchError.value = '请填写 Token、设备 SN、通道 ID'
    return null
  }
  return { sn, channel, headers: { 'Content-Type': 'application/json', 'X-Token': token.value.trim() } }
}

async function postOpenApi(endpoint, headers, body) {
  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) })
  const data = await res.json()
  if (data.code !== 1000) {
    throw new Error(`${data.code} ${data.msg}`)
  }
  return data.data
}

async function fetchRecords() {
  fetchError.value = ''
  const cred = readCredentials()
  if (!cred) {
    return
  }
  if (!queryDate.value) {
    fetchError.value = '请选择查询日期'
    return
  }
  const day = queryDate.value.replaceAll('-', '')
  loading.value = true
  emit('update:records', [])
  emit('update:total', 0)
  try {
    const data = await postOpenApi(RECORD_LIST_ENDPOINT, cred.headers, {
      deviceSn: cred.sn,
      channelId: cred.channel,
      startTime: `${day}000000`,
      endTime: `${day}235959`,
      pageStart: 1,
      pageSize: PAGE_SIZE,
      sortByTime: 'asc',
    })
    emit('update:records', data?.items ?? [])
    emit('update:total', data?.page?.total ?? data?.items?.length ?? 0)
  } catch (err) {
    fetchError.value = `获取录像列表失败：${err.message}`
  } finally {
    loading.value = false
  }
}

// 返回 wss 播放地址，失败返回 ''（错误写入 fetchError 展示在顶栏）
async function getPlaybackUrl(record) {
  fetchError.value = ''
  const cred = readCredentials()
  if (!cred) {
    return ''
  }
  try {
    const data = await postOpenApi(PLAYBACK_URL_ENDPOINT, cred.headers, {
      deviceSn: cred.sn,
      channelId: cred.channel,
      startTime: record.startTime,
      endTime: record.endTime,
    })
    const url = data?.url ?? ''
    if (!url) {
      fetchError.value = '获取回放地址失败：接口未返回播放地址'
    }
    return url
  } catch (err) {
    fetchError.value = `获取回放地址失败：${err.message}`
    return ''
  }
}

defineExpose({ getPlaybackUrl })
</script>

<template>
  <!-- display:contents：子项直接参与 page-top 的 flex 排布；单根结构供 v-show 隐藏 -->
  <div class="record-source">
    <input v-model="token" class="input source-token" type="text" placeholder="平台 AccessToken" @keyup.enter="fetchRecords" />
    <input v-model="deviceSn" class="input source-sn" type="text" placeholder="设备 SN" @keyup.enter="fetchRecords" />
    <input
      v-model="channelId"
      class="input source-channel"
      type="text"
      inputmode="numeric"
      placeholder="通道 ID"
      @keyup.enter="fetchRecords"
    />
    <input v-model="queryDate" class="input" type="date" @keyup.enter="fetchRecords" />
    <button class="btn" type="button" :disabled="loading" @click="fetchRecords">
      {{ loading ? '获取中…' : '录像文件列表' }}
    </button>
    <span v-if="fetchError" class="url-error fetch-error" :title="fetchError">{{ fetchError }}</span>
  </div>
</template>

<style scoped>
.record-source {
  display: contents;
}

.source-token {
  flex: 1 1 180px;
  min-width: 180px;
}

.source-sn {
  width: 120px;
}

.source-channel {
  width: 48px;
}

.fetch-error {
  flex: 0 1 auto;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.url-error {
  color: var(--color-danger);
}
</style>
