<script setup>
// 行：{ label, value }
const props = defineProps({
  title: { type: String, required: true },
  rows: { type: Array, default: () => [] },
})
</script>

<template>
  <section class="info-panel">
    <h3 class="info-title">{{ props.title }}</h3>
    <dl class="info-list">
      <div v-for="row in props.rows" :key="row.label" class="info-row">
        <dt>{{ row.label }}</dt>
        <dd :title="String(row.value ?? '')">
          <span class="info-value">{{ row.value ?? '-' }}</span>
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
</style>
