import { createApp } from 'vue'
import {
  create,
  NButton,
  NCard,
  NCascader,
  NCheckbox,
  NConfigProvider,
  NDataTable,
  NDatePicker,
  NDialogProvider,
  NDropdown,
  NDivider,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NInputNumber,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NMessageProvider,
  NModal,
  NSelect,
  NSlider,
  NSpace,
  NStatistic,
  NTabPane,
  NTabs,
  NTag,
  NThing
} from 'naive-ui'
import App from './App.vue'
import './style.css'

const naive = create({
  components: [
    NButton,
    NCard,
    NCascader,
    NCheckbox,
    NConfigProvider,
    NDataTable,
    NDatePicker,
    NDialogProvider,
    NDropdown,
    NDivider,
    NForm,
    NFormItem,
    NGrid,
    NGridItem,
    NInput,
    NInputNumber,
    NLayout,
    NLayoutContent,
    NLayoutHeader,
    NMessageProvider,
    NModal,
    NSelect,
    NSlider,
    NSpace,
    NStatistic,
    NTabPane,
    NTabs,
    NTag,
    NThing
  ]
})

createApp(App).use(naive).mount('#app')
