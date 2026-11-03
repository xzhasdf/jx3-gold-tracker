<template>
  <n-modal
    :show="show"
    preset="card"
    title="金价区服"
    style="max-width: 420px;"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <n-space vertical :size="14">
      <n-form label-placement="left" label-width="60" :show-feedback="false">
        <n-form-item label="大区">
          <n-select
            v-model:value="zoneId"
            :options="zoneOptions"
            :loading="loading"
            placeholder="选择大区"
            @update:value="onZoneChange"
          />
        </n-form-item>
        <n-form-item label="服务器" style="margin-top: 12px;">
          <n-select
            v-model:value="serverId"
            :options="serverOptions"
            :loading="loading"
            placeholder="选择服务器"
          />
        </n-form-item>
      </n-form>
      <div v-if="error" class="gold-server-error">{{ error }}</div>
      <div class="gold-server-actions">
        <n-space>
          <n-button size="small" @click="emit('update:show', false)">取消</n-button>
          <n-button type="primary" size="small" :disabled="!serverId" @click="save">保存</n-button>
        </n-space>
      </div>
    </n-space>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { useGoldPrice } from '../../composables/useGoldPrice'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const message = useMessage()
const { server, changeServer } = useGoldPrice()

const zones = ref<GoldZone[]>([])
const zoneId = ref<string | null>(null)
const serverId = ref<string | null>(null)
const loading = ref(false)
const error = ref('')

const zoneOptions = computed(() => zones.value.map((z) => ({ label: z.zone_name, value: z.zone_id })))
const serverOptions = computed(() => {
  const zone = zones.value.find((z) => z.zone_id === zoneId.value)
  return (zone?.servers ?? []).map((s) => ({ label: s.server_name, value: s.server_id }))
})

function onZoneChange() {
  serverId.value = null
}

async function loadZones() {
  if (!window.electronAPI) return
  loading.value = true
  error.value = ''
  try {
    const result = await window.electronAPI.getGoldGateways()
    if (result.ok && result.data) {
      zones.value = result.data
    } else {
      error.value = result.message || '区服列表获取失败'
    }
  } finally {
    loading.value = false
  }
}

async function save() {
  const zone = zones.value.find((z) => z.zone_id === zoneId.value)
  const target = zone?.servers.find((s) => s.server_id === serverId.value)
  if (!zone || !target) return
  const result = await changeServer({
    zoneId: zone.zone_id,
    zoneName: zone.zone_name,
    serverId: target.server_id,
    serverName: target.server_name
  })
  if (!result.ok) {
    message.error(`切换失败：${result.message ?? '未知错误'}`)
    return
  }
  message.success(`金价区服已切换为 ${target.server_name}`)
  emit('update:show', false)
}

watch(() => props.show, async (visible) => {
  if (!visible) return
  zoneId.value = server.value?.zoneId ?? null
  serverId.value = server.value?.serverId ?? null
  if (zones.value.length === 0) await loadZones()
})
</script>

<style scoped>
.gold-server-actions {
  display: flex;
  justify-content: flex-end;
}

.gold-server-error {
  color: #d03050;
  font-size: 12px;
}
</style>
