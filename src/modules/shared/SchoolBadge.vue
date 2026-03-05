<template>
  <span class="school-wrap">
    <img v-if="iconUrl" :src="iconUrl" :alt="`${school}图标`" class="school-logo-img" />
    <span v-else class="school-logo-fallback" :style="{ background: color }">{{ shortText }}</span>
    <span>{{ school }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ school: string }>()

const palette: Record<string, string> = {
  万花: '#8d6fd1',
  纯阳: '#5f8fd4',
  天策: '#ce5f5f',
  七秀: '#d368a8',
  少林: '#b48858',
  藏剑: '#d9a23e',
  五毒: '#5aaf88',
  唐门: '#6573cc',
  明教: '#c46f4d',
  丐帮: '#7a9b45',
  苍云: '#5d738a',
  长歌: '#4f86a9',
  霸刀: '#8f5f4d',
  蓬莱: '#4da7b8',
  凌雪: '#7f6f8f',
  衍天: '#6f84b7',
  药宗: '#57a57a',
  刀宗: '#8d5b5b',
  万灵: '#4f9e8d',
  段氏: '#8f6e4d'
}

const iconModules = import.meta.glob('../../assets/school/*.png', { eager: true, import: 'default' }) as Record<string, string>
const iconMap = new Map<string, string>()
Object.entries(iconModules).forEach(([path, url]) => {
  const filename = path.split('/').pop() ?? ''
  const schoolName = filename.replace(/\.png$/i, '')
  iconMap.set(schoolName, url)
})

const iconUrl = computed(() => iconMap.get(props.school) ?? null)
const color = computed(() => palette[props.school] ?? '#6b7280')
const shortText = computed(() => props.school.slice(0, 1))
</script>

<style scoped>
.school-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.school-logo-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex: 0 0 auto;
}

.school-logo-fallback {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  font-weight: 700;
  flex: 0 0 auto;
}
</style>
