import { ref } from 'vue'

const ocrReady = ref(false)
const ocrLoading = ref(false)
const ocrLoadingText = ref('')
const ocrDownloadPercent = ref(-1)

export function useOcrState() {
  function setReady(v: boolean) {
    ocrReady.value = v
    if (v) {
      ocrLoading.value = false
      ocrLoadingText.value = ''
      ocrDownloadPercent.value = -1
    }
  }
  function setLoading(v: boolean) {
    ocrLoading.value = v
  }
  function setLoadingStatus(status: string) {
    ocrLoadingText.value = status
    const match = status.match(/(\d+)%/)
    if (match) {
      ocrDownloadPercent.value = Number(match[1])
    } else if (status.includes('下载')) {
      ocrDownloadPercent.value = 0
    }
  }
  return { ocrReady, ocrLoading, ocrLoadingText, ocrDownloadPercent, setReady, setLoading, setLoadingStatus }
}
