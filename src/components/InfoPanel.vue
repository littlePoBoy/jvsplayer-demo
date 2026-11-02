<script setup>
import { ref } from 'vue'

// 行：{ label, value, copy? } —— copy=true 时展示「复制」按钮（如播放地址）
const props = defineProps({
  title: { type: String, required: true },
  rows: { type: Array, default: () => [] },
})

const copiedLabel = ref('')

async function copyRow(row) {
  try {
    await navigator.clipboard.writeText(String(row.value))
    copiedLabel.value = row.label
    setTimeout(() => {
      if (copiedLabel.value === row.label) {
        copiedLabel.value = ''
      }
    }, 1500)
  } catch {
    copiedLabel.value = ''
  }
}
</script>

<template>
  <section class="info-panel">
    <h3 class="info-title">{{ props.title }}</h3>
    <dl class="info-list">
      <div v-for="row in props.rows" :key="row.label" class="info-row">
        <dt>{{ row.label }}</dt>
        <dd :title="String(row.value ?? '')">
          <span class="info-value">{{ row.value ?? '-' }}</span>
          <button v-if="row.copy" class="btn btn-copy" type="button" @click="copyRow(row)">
            {{ copiedLabel === row.label ? '已复制' : '复制' }}
          </button>
        </dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.info-panel {
  padding: 12px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.info-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.info-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 12px;
}

.info-row dt {
  flex: 0 0 92px;
  color: var(--color-text-sub);
}

.info-row dd {
  margin: 0;
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 6px;
  align-items: baseline;
  justify-content: space-between;
}

.info-value {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  user-select: text;
}

.btn-copy {
  flex: none;
  padding: 1px 8px;
  font-size: 12px;
}
</style>
