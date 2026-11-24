<template>
  <div class="cp-page">
      <div class="cp-head">
        <n-button size="small" quaternary @click="emit('back')">‹ 返回</n-button>
        <span class="cp-title">技艺收益</span>
      </div>
      <div class="cp-bar">
        <div class="cp-bar-info">
          <span>区服 <b>{{ serverName || '—' }}</b></span>
          <span class="cp-muted">跟随顶栏金价的区服设置 · 交易行价格来自 JX3Box 玩家上传，非官方</span>
        </div>
        <div class="cp-bar-ctrl">
          <!-- 禁用的按钮收不到鼠标事件，提示挂在外面一层 -->
          <n-tooltip :disabled="selectedIds.length > 0" :delay="100" placement="bottom">
            <template #trigger>
              <span class="cp-plan-btn">
                <n-button size="small" type="primary" secondary :disabled="!selectedIds.length" @click="planOpen = true">材料清单{{ selectedIds.length ? `（${selectedIds.length}）` : '' }}</n-button>
              </span>
            </template>
            请选择需要制作的物品
          </n-tooltip>
          <n-button v-if="selectedIds.length" size="small" quaternary @click="clearSelected">清空选择</n-button>
          <n-button size="small" :loading="loading" :disabled="!profRows.length" @click="loadPrices(true)">刷新价格</n-button>
        </div>
      </div>
      <div v-if="priceError" class="cp-error">{{ priceError }}</div>

      <!-- 技艺 Tab、中间件价格、筛选框和下面的表头在滚动时固定在顶部 -->
      <div ref="stickyEl" class="cp-sticky">
      <n-tabs v-model:value="activeProf" type="line" class="cp-tabs">
        <n-tab-pane :name="FAV_TAB" :tab="`★ ${FAV_TAB}${favoriteIds.length ? ` ${favoriteIds.length}` : ''}`" />
        <n-tab-pane v-for="p in PROFESSIONS" :key="p" :name="p" :tab="p" />
      </n-tabs>

      <div class="cp-add">
        <n-input v-model:value="keyword" clearable size="small" :placeholder="`按名称筛选${activeProf}配方`" style="width: 260px" />
        <n-radio-group v-if="!isFavTab && activeProf !== '梓匠'" v-model:value="dlcView" size="small">
          <n-radio value="current" :label="`当前版本（${DLC_NAMES[CURRENT_DLC] ?? ''}）`" />
          <n-radio value="old" :label="OLD_DLC_LABEL" />
        </n-radio-group>
        <span v-if="isFavTab" class="cp-muted">共收藏 {{ listedCount }} 条配方</span>
        <span v-else class="cp-muted">{{ activeProf }}共 {{ listedCount }} 条{{ activeProf === '梓匠' ? '' : dlcView === 'old' ? OLD_DLC_LABEL : '当前版本' }}配方</span>
      </div>
      </div>

      <div v-if="!profRows.length" class="cp-empty">{{ isFavTab && !favoriteIds.length ? '还没有收藏配方，点配方名前的 ☆ 即可收藏' : '没有匹配的配方' }}</div>

      <table v-else class="cp-table" :style="{ '--cp-sticky-h': `${stickyHeight}px` }">
        <thead>
          <tr>
            <th class="cp-col-name">配方</th>
            <th v-for="col in SORT_COLS" :key="col.key" class="cp-num cp-sortable" @click="toggleSort(col.key)">
              {{ col.label }}<n-tooltip v-if="col.key === 'unitRevenue'" :delay="100" placement="bottom">
                <template #trigger><span class="cp-help" @click.stop>?</span></template>
                <div class="cp-help-title">本列为单件（每 1 个产物）的收益</div>
                <div>收益 = 交易行售出实际可获得金额（已扣 5% 手续费）</div>
                <div>单件收益 = 各产物期望收益合计 ÷ 期望件数 = Σ（产物单价 × 单次期望 × 95%）÷ Σ 单次期望</div>
                <div class="cp-help-sub">单次期望 = 出现概率 ×（最少 + 最多）÷ 2</div>
                <div>保底 = 只算主产物（概率最高的那件），不算【精】等小概率产物</div>
              </n-tooltip><n-tooltip v-else-if="col.key === 'unitProfit'" :delay="100" placement="bottom">
                <template #trigger><span class="cp-help" @click.stop>?</span></template>
                <div class="cp-help-title">本列为单件（每 1 个产物）的利润</div>
                <div>单件利润 = 单件收益 − 单件成本</div>
                <div class="cp-help-sub">单次期望 = 出现概率 ×（最少 + 最多）÷ 2，可在展开面板里改</div>
                <div>保底 = 假设只出主产物：主产物单价 × 95% − 成本 ÷ 主产物件数（不算【精】等小概率产物）</div>
                <div>部分缺价：有小概率产物没有交易行报价，按 0 计入，期望利润可能偏低</div>
              </n-tooltip><n-tooltip v-else-if="col.key === 'perVigor'" :delay="100" placement="bottom">
                <template #trigger><span class="cp-help" @click.stop>?</span></template>
                <div>每点精力利润 = 单件利润 ÷ 单件精力 = 总利润 ÷ 总精力</div>
                <div class="cp-help-sub">按单件、单次还是多次合计算，结果都一样</div>
                <div>保底 = 假设只出主产物时的每点精力利润</div>
              </n-tooltip><span class="cp-sort">{{ sortKey === col.key ? (sortDesc ? '▼' : '▲') : '' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
            <tr v-if="midSummary" class="cp-mids-row">
              <td colspan="6">
                <span class="cp-mids-title">中间件 {{ midSummary.total }} 个</span>
                <n-button size="tiny" secondary type="primary" @click="midOpen = true">查看 / 编辑中间件配方</n-button>
                <span class="cp-muted">取价选「配方」时按自制成本算</span>
              </td>
            </tr>
          <template v-for="row in profRows" :key="row.recipe.id">
           <!-- 中间件配方的行搬到右侧抽屉里（Teleport），抽屉没打开时不渲染 -->
           <Teleport v-if="!isMidRow(row) || midTbody" :to="midTbody ?? 'body'" :disabled="!isMidRow(row)">
            <tr v-if="isMidRow(row)" class="cp-row cp-mid-row" :class="{ open: expanded === row.recipe.id }" @click="toggleExpand(row.recipe.id)">
              <td class="cp-mid-name-cell">
                <span class="cp-caret">{{ expanded === row.recipe.id ? '▾' : '▸' }}</span>
                <span :style="{ color: qualityColor(row.recipe.outs[0][0]) }">{{ midInfo(row).name }}</span>
              </td>
              <td class="cp-num">
                <CraftMoney v-if="midInfo(row).price !== null" :value="midInfo(row).price!" />
                <span v-else class="cp-missing">{{ loading ? '加载中' : '无报价' }}</span>
              </td>
              <td :class="ageClass(midInfo(row).updatedAt)">{{ midInfo(row).updatedAt ? ageText(midInfo(row).updatedAt) : '' }}</td>
              <td class="cp-num">
                <CraftMoney
                  v-if="row.unitCost !== null"
                  :value="row.unitCost"
                  :class="midInfo(row).price !== null ? (row.unitCost < midInfo(row).price! ? 'cp-pos' : 'cp-neg') : ''"
                />
                <span v-else class="cp-missing">缺价</span>
              </td>
              <td class="cp-num">
                <CraftMoney
                  v-if="row.unitCost !== null && midInfo(row).price !== null"
                  :value="midInfo(row).price! - row.unitCost"
                  :class="midInfo(row).price! - row.unitCost >= 0 ? 'cp-pos' : 'cp-neg'"
                />
                <span v-else>—</span>
              </td>
              <td class="cp-num">
                <CraftMoney v-if="row.perVigor !== null" :value="row.perVigor" :class="profitClass(row.perVigor)" />
                <span v-else>—</span>
              </td>
              <td class="cp-num">{{ round1(row.vigor) }}</td>
            </tr>
            <tr v-if="!isMidRow(row)" class="cp-row" :class="{ open: expanded === row.recipe.id }" @click="toggleExpand(row.recipe.id)">
              <td class="cp-col-name">
                <span class="cp-caret">{{ expanded === row.recipe.id ? '▾' : '▸' }}</span>
                <span class="cp-pick" title="加入材料清单" @click.stop>
                  <n-checkbox size="small" :checked="selectedSet.has(row.recipe.id)" @update:checked="(v: boolean) => toggleSelected(row.recipe.id, v)" />
                </span>
                <span
                  class="cp-star"
                  :class="{ on: favoriteSet.has(row.recipe.id) }"
                  :title="favoriteSet.has(row.recipe.id) ? '取消收藏' : '收藏'"
                  @click.stop="toggleFavorite(row.recipe.id)"
                >{{ favoriteSet.has(row.recipe.id) ? '★' : '☆' }}</span>
                <span :style="{ color: qualityColor(row.recipe.outs[0]?.[0]) }">{{ row.recipe.name }}</span>
                <span v-if="row.times > 1" class="cp-times">×{{ row.times }}</span>
                <n-tag size="tiny" :bordered="false" class="cp-prof">{{ row.recipe.prof }}</n-tag>
                <n-tag v-if="ownedCount(row.recipe.id)" size="tiny" type="info" :bordered="false">有自备</n-tag>
                <n-tag v-if="row.vigorFood" size="tiny" type="warning" :bordered="false">
                  {{ row.vigorFood.food.name }}<template v-if="row.vigorFood.buy.count"> 买{{ row.vigorFood.buy.count }}</template><template v-if="row.vigorFood.self"> 自制{{ row.vigorFood.self.count }}</template>
                </n-tag>
                <div v-if="effectOf(row.recipe.outs[0]?.[0])" class="cp-fx" :title="effectOf(row.recipe.outs[0]?.[0])">{{ effectOf(row.recipe.outs[0]?.[0]) }}</div>
              </td>
              <td class="cp-num">{{ round1(row.vigor) }}</td>
              <td class="cp-num">
                <CraftMoney v-if="row.unitCost !== null" :value="row.unitCost" /><span v-else-if="row.cost === null" class="cp-missing">缺价</span><span v-else>—</span>
              </td>
              <td class="cp-num">
                <CraftMoney v-if="row.unitRevenue !== null" :value="row.unitRevenue" /><span v-else class="cp-missing">无报价</span>
                <div v-if="row.baseUnitRevenue !== null" class="cp-subline">保底 <CraftMoney :value="row.baseUnitRevenue" /></div>
              </td>
              <td class="cp-num" :class="profitClass(row.unitProfit)">
                <CraftMoney v-if="row.unitProfit !== null" :value="row.unitProfit" /><span v-else>—</span>
                <div v-if="row.baseUnitProfit !== null" class="cp-subline" :class="profitClass(row.baseUnitProfit)">保底 <CraftMoney :value="row.baseUnitProfit" /></div>
                <div v-if="row.partialOutputs" class="cp-subline cp-partial">部分缺价</div>
              </td>
              <td class="cp-num cp-strong" :class="profitClass(row.perVigor)"><CraftMoney v-if="row.perVigor !== null" :value="row.perVigor" /><span v-else>—</span>
                <div v-if="row.basePerVigor !== null" class="cp-subline" :class="profitClass(row.basePerVigor)">保底 <CraftMoney :value="row.basePerVigor" /></div>
              </td>
            </tr>
            <tr v-if="expanded === row.recipe.id" class="cp-detail-row">
              <td colspan="6">
                <div class="cp-detail">
                  <div class="cp-detail-head">
                    <span>材料</span>
                    <span class="cp-times-ctrl" @click.stop>
                      制作
                      <n-input-number
                        :value="row.times"
                        size="tiny"
                        :min="1"
                        :max="9999"
                        :precision="0"
                        style="width: 96px"
                        @update:value="(v: number | null) => v !== null && setTimes(row.recipe.id, v)"
                      />
                      次
                    </span>
                    <span class="cp-times-ctrl" @click.stop>
                      额外精力
                      <n-radio-group
                        :value="settings.vigorFood[row.recipe.id] ?? ''"
                        size="small"
                        class="cp-source"
                        @update:value="(v: string) => setVigorFood(row.recipe.id, v)"
                      >
                        <n-radio-button value="" label="不使用" />
                        <n-radio-button v-for="f in VIGOR_FOODS" :key="f.key" :value="f.key" :label="f.name" />
                      </n-radio-group>
                      <template v-if="row.vigorFood">
                        <span>买</span>
                        <n-input-number
                          :value="row.vigorFood.buy.count"
                          size="tiny"
                          :min="0"
                          :precision="0"
                          :class="{ 'cp-yield-custom': settings.foodCount[row.recipe.id] !== undefined }"
                          style="width: 80px"
                          @update:value="(v: number | null) => setFoodCount(row.recipe.id, v)"
                        />
                        <span>个</span>
                        <n-button v-if="settings.foodCount[row.recipe.id] !== undefined" text size="tiny" @click="setFoodCount(row.recipe.id, null)">自动</n-button>
                        <span>自制</span>
                        <n-input-number
                          :value="row.vigorFood.self?.count ?? 0"
                          size="tiny"
                          :min="0"
                          :precision="0"
                          style="width: 80px"
                          @update:value="(v: number | null) => setFoodSelf(row.recipe.id, v)"
                        />
                        <span>个</span>
                      </template>
                    </span>
                    <span class="cp-muted">数量和自备都是 {{ row.times }} 次合计，自备的部分不计成本、不计精力；精力 {{ row.recipe.vigor }} × {{ row.times }}<template v-if="row.vigor !== row.recipe.vigor * row.times"> + 中间件自制 {{ round1(row.vigor - row.recipe.vigor * row.times) }}</template> = {{ round1(row.vigor) }}</span>
                    <span class="cp-detail-actions">
                      <n-button text size="tiny" @click="setAllOwned(row, true)">全部自备</n-button>
                      <n-button text size="tiny" @click="setAllOwned(row, false)">清空自备</n-button>
                    </span>
                  </div>
                  <table class="cp-sub">
                    <thead>
                      <tr><th>材料</th><th class="cp-num">需要</th><th>自备<n-tooltip :delay="100" placement="bottom">
                          <template #trigger><span class="cp-help">?</span></template>
                          自行获取无消耗的数量
                        </n-tooltip></th><th>取价</th><th class="cp-num">单价<n-tooltip :delay="100" placement="bottom"><template #trigger><span class="cp-help">?</span></template>交易行最低售价（取价选 NPC 商店 / 自定义 / 配方时按所选的价）</n-tooltip></th><th class="cp-num">小计</th><th>价格时间</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="line in row.lines" :key="line.id">
                        <td :style="{ color: qualityColor(line.id) }">{{ line.name }}</td>
                        <td class="cp-num">{{ line.need }}</td>
                        <td>
                          <span v-if="line.unit.via === 'npc'" class="cp-muted">—</span>
                          <div v-else class="cp-owned">
                            <n-input-number
                              :value="line.owned"
                              size="tiny"
                              :min="0"
                              :max="line.need"
                              :precision="0"
                              style="width: 84px"
                              @update:value="(v: number | null) => setOwned(row.recipe.id, line.id, v ?? 0)"
                            />
                            <n-button text size="tiny" @click="setOwned(row.recipe.id, line.id, line.owned === line.need ? 0 : line.need)">
                              {{ line.owned === line.need ? '清零' : '全自备' }}
                            </n-button>
                          </div>
                        </td>
                        <td>
                          <span v-if="line.unit.via === 'npc'" class="cp-npc">NPC 商店</span>
                          <n-radio-group
                            v-else
                            :value="line.unit.via"
                            size="small"
                            class="cp-source"
@update:value="(v: CraftPriceSource) => setSource(line.id, v)"
                          >
                            <n-radio-button v-for="o in MID_IDS.has(line.id) ? MID_SOURCE_OPTIONS : SOURCE_OPTIONS" :key="o.value" :value="o.value" :label="o.label" />
                          </n-radio-group>
                          <div v-if="line.unit.via === 'craft'" class="cp-mid-self">
                            <div class="cp-mid-self-line">
                              自制
                              <n-input-number
                                :value="line.craftCount"
                                size="tiny"
                                :min="0"
                                :max="line.buy"
                                :disabled="line.buy === 0"
                                :precision="0"
                                :class="{ 'cp-yield-custom': settings.midSelf[row.recipe.id]?.[line.id] !== undefined }"
                                style="width: 84px"
                                @update:value="(v: number | null) => setMidSelf(row.recipe.id, line.id, v)"
                              />
                              个
                              <n-button text size="tiny" :disabled="settings.midSelf[row.recipe.id]?.[line.id] === undefined" @click="setMidSelf(row.recipe.id, line.id, null)">全部自制</n-button>
                            </div>
                            <div class="cp-muted">剩余 {{ line.need - line.craftCount }} 个：交易行获取 {{ line.buy - line.craftCount }} 个，自备 {{ line.owned }} 个</div>
                          </div>
                        </td>
                        <td class="cp-num">
                          <n-input-number
                            v-if="line.unit.via === 'manual'"
                            :value="toGoldInput(settings.manual[line.id])"
                            size="tiny"
                            :min="0"
                            :precision="2"
                            :show-button="false"
                            placeholder="单价"
                            style="width: 96px"
                            @update:value="(v: number | null) => setManual(line.id, v)"
                          >
                            <template #suffix>金</template>
                          </n-input-number>
                          <CraftMoney v-else-if="line.unit.price !== null" :value="line.unit.price" />
                          <span v-else class="cp-missing">无报价</span>
                          <div v-if="line.craftVigor > 0" class="cp-muted">+{{ round1(line.craftVigor) }} 精力</div>
                        </td>
                        <td class="cp-num">
                          <CraftMoney v-if="line.subtotal !== null" :value="line.subtotal" />
                          <span v-else class="cp-missing">—</span>
                        </td>
                        <td :class="ageClass(line.unit.updatedAt)">{{ ageText(line.unit.updatedAt) }}</td>
                      </tr>
                      <template v-if="row.vigorFood">
                        <tr v-if="row.vigorFood.buy.count > 0 || !row.vigorFood.self" class="cp-food-row">
                          <td>
                            <span :style="{ color: qualityColor(row.vigorFood.food.id) }">{{ row.vigorFood.food.name }}</span>
                            <n-tag size="tiny" :bordered="false" class="cp-food-tag">购买</n-tag>
                            <div class="cp-muted">消耗 {{ row.vigorFood.buy.count }} 个</div>
                          </td>
                          <td class="cp-num">{{ row.vigorFood.buy.count }}</td>
                          <td></td>
                          <td>
                            <n-radio-group
                              :value="row.vigorFood.buy.unit.via"
                              size="small"
                              class="cp-source"
                              @update:value="(v: CraftPriceSource) => setSource(row.vigorFood!.food.id, v)"
                            >
                              <n-radio-button v-for="o in SOURCE_OPTIONS" :key="o.value" :value="o.value" :label="o.label" />
                            </n-radio-group>
                          </td>
                          <td class="cp-num">
                            <n-input-number
                              v-if="row.vigorFood.buy.unit.via === 'manual'"
                              :value="toGoldInput(settings.manual[row.vigorFood.food.id])"
                              size="tiny"
                              :min="0"
                              :precision="2"
                              :show-button="false"
                              placeholder="单价"
                              style="width: 96px"
                              @update:value="(v: number | null) => setManual(row.vigorFood!.food.id, v)"
                            >
                              <template #suffix>金</template>
                            </n-input-number>
                            <CraftMoney v-else-if="row.vigorFood.buy.unit.price !== null" :value="row.vigorFood.buy.unit.price" />
                            <span v-else class="cp-missing">无报价</span>
                          </td>
                          <td class="cp-num">
                            <CraftMoney v-if="row.vigorFood.buy.cost !== null" :value="row.vigorFood.buy.cost" />
                            <span v-else class="cp-missing">—</span>
                          </td>
                          <td :class="ageClass(row.vigorFood.buy.unit.updatedAt)">{{ ageText(row.vigorFood.buy.unit.updatedAt) }}</td>
                        </tr>
                        <tr v-if="row.vigorFood.self" class="cp-food-row">
                          <td>
                            <span :style="{ color: qualityColor(row.vigorFood.food.id) }">{{ row.vigorFood.food.name }}</span>
                            <n-tag size="tiny" type="success" :bordered="false" class="cp-food-tag">自制</n-tag>
                            <div class="cp-muted">消耗 {{ row.vigorFood.self.count }} 个</div>
                          </td>
                          <td class="cp-num">{{ row.vigorFood.self.count }}</td>
                          <td></td>
                          <td class="cp-npc">
                            <n-tooltip :delay="100">
                              <template #trigger><span class="cp-hint">按材料费</span></template>
                              一次制作的材料费 ÷ 期望产出 {{ round2(row.vigorFood.self.perCraft) }} 个
                            </n-tooltip>
                          </td>
                          <td class="cp-num">
                            <CraftMoney v-if="row.vigorFood.self.unit.price !== null" :value="row.vigorFood.self.unit.price" />
                            <span v-else class="cp-missing">材料缺价</span>
                          </td>
                          <td class="cp-num">
                            <CraftMoney v-if="row.vigorFood.self.cost !== null" :value="row.vigorFood.self.cost" />
                            <span v-else class="cp-missing">—</span>
                          </td>
                          <td></td>
                        </tr>
                      </template>
                    </tbody>
                    <tfoot>
                      <tr class="cp-total-row">
                        <td colspan="5">
                          合计
                        </td>
                        <td class="cp-num">
                          <CraftMoney v-if="row.cost !== null" :value="row.cost" />
                          <span v-else class="cp-missing">缺价</span>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>

                  <div class="cp-detail-head">
                    <span>产物</span>
                    <span class="cp-muted">期望共 {{ round2(row.expectedItems) }} 件<template v-if="row.unitCost !== null">，单件成本 <CraftMoney :value="row.unitCost" /></template>；收益已扣 {{ AUCTION_FEE_PERCENT }}% 交易行手续费<template v-if="row.partialOutputs">；小概率产物没有报价，按 0 计</template></span>
                  </div>
                  <table class="cp-sub">
                    <thead>
                      <tr><th>产物</th><th class="cp-num">单次期望</th><th>取价</th><th class="cp-num">单价<n-tooltip :delay="100" placement="bottom"><template #trigger><span class="cp-help">?</span></template>交易行最低售价</n-tooltip></th><th class="cp-num">收益<n-tooltip :delay="100" placement="bottom">
                          <template #trigger><span class="cp-help">?</span></template>
                          交易行售出实际可获得金额（已扣 5% 手续费）
                        </n-tooltip></th><th>价格时间</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="(out, oi) in row.outputs" :key="out.id">
                        <td>
                          <div :style="{ color: nameColor(out.id, oi > 0 && out.perCraft < LOW_EXPECT) }">{{ out.name }}</div>
                          <div v-if="effectOf(out.id)" class="cp-fx cp-fx-full">{{ effectOf(out.id) }}</div>
                        </td>
                        <td class="cp-num">
                          <div class="cp-yield">
                            <n-input-number
                              :value="round2(out.perCraft)"
                              size="tiny"
                              :min="0"
                              :step="0.1"
                              :precision="2"
                              :show-button="false"
                              :class="{ 'cp-yield-custom': out.custom }"
                              style="width: 72px"
                              @update:value="(v: number | null) => setYield(row.recipe.id, out.id, v)"
                            />
                            <n-button v-if="out.custom" text size="tiny" @click="setYield(row.recipe.id, out.id, null)">默认</n-button>
                          </div>
                          <div v-if="row.times > 1" class="cp-muted">共 {{ round2(out.expected) }}</div>
                        </td>
                        <td>
                          <span v-if="out.unit.via === 'npc'" class="cp-npc">NPC 商店</span>
                          <n-radio-group
                            v-else
                            :value="out.unit.via"
                            size="small"
                            class="cp-source"
                            @update:value="(v: CraftPriceSource) => setSource(out.id, v)"
                          >
                            <n-radio-button v-for="o in SOURCE_OPTIONS" :key="o.value" :value="o.value" :label="o.label" />
                          </n-radio-group>
                        </td>
                        <td class="cp-num">
                          <n-input-number
                            v-if="out.unit.via === 'manual'"
                            :value="toGoldInput(settings.manual[out.id])"
                            size="tiny"
                            :min="0"
                            :precision="2"
                            :show-button="false"
                            placeholder="单价"
                            style="width: 96px"
                            @update:value="(v: number | null) => setManual(out.id, v)"
                          >
                            <template #suffix>金</template>
                          </n-input-number>
                          <CraftMoney v-else-if="out.unit.price !== null" :value="out.unit.price" />
                          <span v-else class="cp-missing">无报价</span>
                        </td>
                        <td class="cp-num"><CraftMoney v-if="out.value !== null" :value="out.value" /><span v-else>—</span></td>
                        <td :class="ageClass(out.unit.updatedAt)">{{ ageText(out.unit.updatedAt) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
           </Teleport>
          </template>
        </tbody>
      </table>

      <n-drawer v-model:show="midOpen" :width="1040" placement="right">
        <n-drawer-content :title="`${activeProf}中间件配方`" closable>
          <div class="cp-mids-label">点击中间件展开配方；「省」= 交易行价 − 自制成本，负数表示自己做更亏</div>
          <table class="cp-table cp-mid-table">
            <thead>
              <tr>
                <th>中间件</th>
                <th class="cp-num">交易行价</th>
                <th>价格时间</th>
                <th class="cp-num">自制成本/个</th>
                <th class="cp-num">省</th>
                <th class="cp-num">每点精力</th>
                <th class="cp-num">精力</th>
              </tr>
            </thead>
            <tbody :ref="(el) => (midTbody = el as HTMLElement | null)"></tbody>
          </table>
        </n-drawer-content>
      </n-drawer>


      <n-drawer v-model:show="planOpen" :width="900" placement="right">
        <n-drawer-content title="材料清单" closable>
          <div v-if="!selectedIds.length" class="cp-empty">先在配方列表里勾选要做的配方</div>
          <template v-else>
            <div class="cp-muted cp-plan-temp">这里的修改都是临时的，关闭后恢复默认，不会改动配方里的设置</div>
            <div class="cp-plan-cards">
              <div class="cp-plan-card">
                <div class="cp-plan-card-k">基础材料总成本</div>
                <div class="cp-plan-card-v"><CraftMoney v-if="plan.cost !== null" :value="plan.cost" /><span v-else class="cp-missing">缺价</span></div>
                <div class="cp-plan-card-s">{{ plan.materials.length }} 种基础材料<template v-if="plan.missing.length">，缺价：{{ plan.missing.join('、') }}</template><template v-else>，自备材料不计</template></div>
              </div>
              <div v-if="planFoodOn" class="cp-plan-card">
                <div class="cp-plan-card-k">总精力消耗</div>
                <div class="cp-plan-card-v">{{ round1(plan.vigorAll) }}</div>
                <div class="cp-plan-card-s">
                  本体 {{ round1(plan.vigorBody) }}<template v-if="!planIgnoreMid"> ＋ 中间件 {{ round1(plan.vigorMid) }}</template><template v-if="plan.vigorFood"> ＋ 精力药制作 {{ round1(plan.vigorFood) }}</template><template v-if="planIgnoreMid && plan.vigorMidIgnored">，已忽略中间件</template>
                </div>
              </div>
              <div v-if="plan.food" class="cp-plan-card">
                <div class="cp-plan-card-k">精力药 · {{ plan.food.food.name }}</div>
                <div class="cp-plan-card-v">{{ plan.food.count }} 个</div>
                <div class="cp-plan-card-s">{{ plan.food.source === 'self' ? `自己做 ${plan.food.crafts} 次（按${planFoodYield === 'expected' ? '期望' : '保底'}产出）` : '交易行买' }}；数量按{{ planIgnoreMid ? '本体' : '本体 + 中间件' }}精力折算</div>
              </div>
              <div v-if="plan.crafts.some((c) => c.kind === 'mid')" class="cp-plan-card">
                <div class="cp-plan-card-k">中间件</div>
                <div class="cp-plan-card-v">{{ plan.crafts.filter((c) => c.kind === 'mid').length }} 种</div>
                <div class="cp-plan-card-s">共做 {{ plan.crafts.filter((c) => c.kind === 'mid').reduce((n, c) => n + c.crafts, 0) }} 次</div>
              </div>
            </div>

            <div class="cp-plan-title">已选配方<n-tooltip :delay="100" placement="bottom"><template #trigger><span class="cp-help">?</span></template><div>按次数：初始取配方列表里的制作次数，这里改动只对本次清单有效</div><div>按数量：填想要的产出件数，自动折算制作次数</div><div>取消「计入精力」的配方，它的本体精力不算进精力药</div></n-tooltip></div>
            <table class="cp-table cp-plan-table">
              <thead><tr><th>配方</th><th>制作方式</th><th class="cp-num">数量 / 次数</th><th class="cp-num">折合</th><th v-if="planFoodOn" class="cp-num">精力</th><th v-if="planFoodOn" class="cp-center">计入精力</th><th></th></tr></thead>
              <tbody>
                <tr v-for="row in planRows" :key="row.id" :class="{ 'cp-plan-ignored': !row.line }">
                  <template v-if="!row.line">
                    <td><span :style="{ color: qualityColor(row.recipe.outs[0]?.[0]) }">{{ row.recipe.name }}</span> <n-tag size="tiny" :bordered="false">{{ row.recipe.prof }}</n-tag></td>
                    <td :colspan="planFoodOn ? 5 : 3" class="cp-muted">已忽略，不参与计算</td>
                    <td class="cp-num cp-plan-acts"><n-button size="tiny" quaternary type="primary" @click="setIgnored(row.id, false)">取消忽略</n-button><n-button size="tiny" quaternary @click="toggleSelected(row.id, false)">移除</n-button></td>
                  </template>
                  <template v-else-if="row.line">
                  <td><span :style="{ color: qualityColor(row.line.recipe.outs[0]?.[0]) }">{{ row.line.recipe.name }}</span> <n-tag size="tiny" :bordered="false">{{ row.line.recipe.prof }}</n-tag></td>
                  <td>
                    <div class="cp-plan-mode">
                      <n-radio-group :value="row.line!.qty === undefined ? 'times' : 'qty'" size="small" @update:value="(v: string) => setPlanMode(row.line!, v === 'qty')">
                        <n-radio-button value="times" label="按次数" />
                        <n-radio-button value="qty" label="按数量" />
                      </n-radio-group>
                      <!-- 按数量时才需要：单次产出按保底还是期望折算次数 -->
                      <n-radio-group v-if="row.line!.qty !== undefined" :value="row.line!.qtyYield" size="small" @update:value="(v: PlanYieldMode) => setPlanQtyYield(row.line!.recipe.id, v)">
                        <n-radio-button value="min" label="保底" />
                        <n-radio-button value="expected" label="期望" />
                      </n-radio-group>
                    </div>
                  </td>
                  <td class="cp-num">
                    <div class="cp-plan-qty">
                      <n-input-number
                        v-if="row.line.qty === undefined"
                        :value="row.line.times"
                        size="tiny"
                        :min="1"
                        :precision="0"
                        style="width: 110px"
                        @update:value="(v: number | null) => setPlanTimes(row.line!.recipe.id, v ?? 1)"
                      />
                      <n-input-number
                        v-else
                        :value="row.line.qty"
                        size="tiny"
                        :min="1"
                        :precision="0"
                        style="width: 110px"
                        @update:value="(v: number | null) => setPlanQty(row.line!.recipe.id, v ?? 1)"
                      >
                        <template #suffix>件</template>
                      </n-input-number>
                    </div>
                  </td>
                  <td class="cp-num cp-muted">
                    <div v-if="row.line.qty !== undefined">做 {{ row.line.times }} 次（{{ row.line.qtyYield === 'expected' ? '期望' : '保底' }}每次 {{ round2(row.line.perCraft ?? 0) }} 件）</div>
                    <!-- 按数量选保底时，主产物件数就是填的数量，不再重复写；只提示可能多出的精 -->
                    <div v-if="!(row.line.qty !== undefined && row.line.qtyYield !== 'expected')">产出约 {{ round1(row.line.expectedOuts[0]?.qty ?? 0) }} 件</div>
                    <div v-for="o in row.line.expectedOuts.slice(1)" :key="o.id">【{{ shortOutName(o.name) }}】约 {{ round1(o.qty) }} 件</div>
                  </td>
                  <td v-if="planFoodOn" class="cp-num">{{ round1(row.line.vigor) }}</td>
                  <td v-if="planFoodOn" class="cp-center"><n-checkbox size="small" :checked="!noVigorIds.has(row.line!.recipe.id)" @update:checked="(v: boolean) => setCountVigor(row.line!.recipe.id, v)" /></td>
                  <td class="cp-num cp-plan-acts"><n-button size="tiny" quaternary @click="setIgnored(row.id, true)">忽略</n-button><n-button size="tiny" quaternary @click="toggleSelected(row.id, false)">移除</n-button></td>
                  </template>
                </tr>
              </tbody>
            </table>

            <div class="cp-plan-title cp-plan-title-row">
              <span>选项</span>
              <n-button size="small" type="primary" secondary :loading="exporting" @click="exportPlan">导出 Excel</n-button>
            </div>
            <div class="cp-plan-opts">
              <div class="cp-plan-opt">
                <span class="cp-plan-opt-label"><n-switch v-model:value="planFoodOn" size="small" />按精力折算精力药</span>
                <template v-if="planFoodOn">
                  <n-radio-group v-model:value="planFoodKey" size="small">
                    <n-radio-button v-for="f in VIGOR_FOODS" :key="f.key" :value="f.key" :label="`${f.name}（回复 ${f.vigor}）`" />
                  </n-radio-group>
                  <n-radio-group v-model:value="planFoodSource" size="small">
                    <n-radio-button value="self" label="自己做" />
                    <n-radio-button value="buy" label="交易行买" />
                  </n-radio-group>
                  <span v-if="planFoodSource === 'self'" class="cp-plan-opt-label cp-plan-opt-inline">
                    <n-switch :value="planFoodYield === 'expected'" size="small" @update:value="(v: boolean) => (planFoodYield = v ? 'expected' : 'min')">
                      <template #checked>期望</template>
                      <template #unchecked>保底</template>
                    </n-switch>
                    精力药产出
                  </span>
                </template>
                <span v-else class="cp-muted">关闭时只统计材料，不补精力</span>
              </div>
              <div v-if="planFoodOn" class="cp-plan-opt">
                <span class="cp-plan-opt-label"><n-switch v-model:value="planIgnoreMid" size="small" />忽略中间件精力</span>
                <span class="cp-muted">只算配方本体的精力</span>
              </div>
              <div class="cp-plan-opt">
                <span class="cp-plan-opt-label">
                  <n-switch :value="planYieldMode === 'expected'" size="small" @update:value="(v: boolean) => (planYieldMode = v ? 'expected' : 'min')">
                    <template #checked>期望</template>
                    <template #unchecked>保底</template>
                  </n-switch>
                  中间件产出
                </span>
              </div>
            </div>

            <div class="cp-plan-title">基础材料合计<n-tooltip :delay="100" placement="bottom"><template #trigger><span class="cp-help">?</span></template><div>中间件和自制精力药已展开，这里只统计基础材料</div><div>取价、单价沿用各材料在配方里的取价设置（交易行 / 自定义，NPC 有售的固定按 NPC 价）</div><div>要改取价，请到配方展开面板里改</div></n-tooltip></div>
            <table class="cp-table cp-plan-table cp-plan-mat-table">
              <thead>
                <tr>
                  <th>材料</th><th class="cp-num">合计</th>
                  <th v-if="showCol.direct" class="cp-num">配方直接用</th>
                  <th v-if="showCol.mid" class="cp-num">中间件用</th>
                  <th v-if="showCol.food" class="cp-num">精力药用</th>
                  <th class="cp-plan-src-col">取价<n-button v-if="ownableMats.length" text size="tiny" type="primary" class="cp-all-own" @click="setAllMatOwn(!allMatsOwn)">{{ allMatsOwn ? '清空自备' : '全自备' }}</n-button></th><th v-if="showCol.owned" class="cp-num cp-plan-own-col">自备数量</th><th class="cp-num">单价</th><th class="cp-num">小计</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in plan.materials" :key="m.id">
                  <td><span :style="{ color: qualityColor(m.id) }">{{ m.name }}</span></td>
                  <td class="cp-num cp-strong">{{ m.total }}</td>
                  <td v-if="showCol.direct" class="cp-num">{{ m.direct || '' }}</td>
                  <td v-if="showCol.mid" class="cp-num">{{ m.viaMid || '' }}</td>
                  <td v-if="showCol.food" class="cp-num">{{ m.viaFood || '' }}</td>
                  <td class="cp-plan-src-col">
                    <n-tag v-if="m.unit.via === 'npc'" size="tiny" type="success" :bordered="false" class="cp-plan-src-tag">NPC</n-tag>
                    <n-select
                      v-else
                      :value="m.isOwn ? 'own' : 'buy'"
                      :options="[{ label: VIA_LABEL[m.unit.via], value: 'buy' }, { label: '自备', value: 'own' }]"
                      size="tiny"
                      class="cp-plan-src"
                      :consistent-menu-width="false"
                      style="width: 64px"
                      @update:value="(v: string) => setMatOwn(m.id, v === 'own', m.total)"
                    />
                  </td>
                  <td v-if="showCol.owned" class="cp-num cp-plan-own-col">
                    <n-input-number
                      v-if="m.isOwn"
                      :value="m.owned"
                      size="tiny"
                      :min="0"
                      :max="m.total"
                      :precision="0"
                      :show-button="false"
                      style="width: 76px"
                      @update:value="(v: number | null) => setMatOwned(m.id, v ?? 0)"
                    />
                    <div v-if="m.isOwn && m.owned < m.total" class="cp-own-short">差 {{ m.total - m.owned }} 件</div>
                  </td>
                  <td class="cp-num"><CraftMoney v-if="m.unit.price !== null" :value="m.unit.price" /><span v-else class="cp-missing">{{ loading ? '加载中' : '无报价' }}</span></td>
                  <td class="cp-num"><CraftMoney v-if="m.subtotal !== null" :value="m.subtotal" /><span v-else>—</span></td>
                </tr>
                <tr v-if="plan.food && plan.food.source === 'buy'">
                  <td><n-tag size="tiny" type="warning" :bordered="false">精力药</n-tag> {{ plan.food.food.name }}</td>
                  <td class="cp-num cp-strong">{{ plan.food.count }}</td>
                  <td v-if="foodBlankCols" :colspan="foodBlankCols"></td>
                  <td class="cp-plan-src-col">{{ plan.food.unit ? VIA_LABEL[plan.food.unit.via] : '' }}</td>
                  <td v-if="showCol.owned"></td>
                  <td class="cp-num"><CraftMoney v-if="plan.food.unit?.price != null" :value="plan.food.unit.price" /><span v-else class="cp-missing">无报价</span></td>
                  <td class="cp-num"><CraftMoney v-if="plan.food.cost !== null" :value="plan.food.cost" /><span v-else>—</span></td>
                </tr>
                <tr class="cp-plan-total">
                  <td :colspan="totalLabelCols">合计（自备材料不计）</td>
                  <td class="cp-num cp-strong"><CraftMoney v-if="plan.cost !== null" :value="plan.cost" /><span v-else class="cp-missing">缺价：{{ plan.missing.join('、') }}</span></td>
                </tr>
              </tbody>
            </table>

            <template v-if="plan.crafts.length">
              <div class="cp-plan-title">中间件 / 精力药<n-tooltip :delay="100" placement="bottom"><template #trigger><span class="cp-help">?</span></template><div>单独列出，它们的材料已计入上面的基础材料</div><div>制作次数 = (需要个数 − 自备个数) ÷ 单次产出，向上取整</div><div>自备的部分不用做，对应的材料和精力都不算</div><div>精力药个数只按配方的精力需求折算，做药本身的精力计入总精力消耗，但不会让药越补越多</div></n-tooltip></div>
              <table class="cp-table cp-plan-table">
                <thead><tr><th>名称</th><th class="cp-num">需要</th><th class="cp-num">自备</th><th class="cp-num">制作次数</th><th class="cp-num">产出</th><th v-if="planFoodOn" class="cp-num">精力</th><th>材料</th></tr></thead>
                <tbody>
                  <tr v-for="c in plan.crafts" :key="c.key">
                    <td>
                      <n-tag size="tiny" :type="c.kind === 'food' ? 'warning' : 'info'" :bordered="false">{{ c.kind === 'food' ? '精力药' : '中间件' }}</n-tag>
                      {{ c.name }}
                    </td>
                    <td class="cp-num">{{ c.need }}</td>
                    <td class="cp-num">
                      <n-input-number :value="c.owned || null" placeholder="0" size="tiny" :min="0" :max="c.need" :precision="0" :show-button="false" style="width: 64px" @update:value="(v: number | null) => setCraftOwned(c.key, v ?? 0)" />
                    </td>
                    <td class="cp-num cp-strong">{{ c.crafts }}</td>
                    <td class="cp-num">{{ round1(c.produced) }}</td>
                    <td v-if="planFoodOn" class="cp-num" :class="{ 'cp-muted': c.kind === 'mid' && planIgnoreMid }">{{ round1(c.vigor) }}</td>
                    <td class="cp-plan-mats">
                      <span v-for="m in c.mats" :key="m.id" class="cp-plan-mat"><span :style="{ color: qualityColor(m.id) }">{{ m.name }}</span><b>×{{ m.qty }}</b></span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>

          </template>
        </n-drawer-content>
      </n-drawer>

      <div v-if="profRows.length" class="cp-foot cp-muted">
        <span v-if="lastRefresh">价格更新于 {{ formatClock(lastRefresh) }}（本地缓存 5 分钟）</span>
        <span>交易行价格取 JX3Box 最近一条小时记录的最低单价；超过 6 小时没人上传的价格标灰，仅供参考。</span>
      </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { useTracker } from '../../composables/useTracker'
import type { CraftPriceSource, CraftSettings } from '../../types'
import CraftMoney from './craft/CraftMoney.vue'
import { ageText, isStale } from './craft/priceAge'
import * as XLSX from 'xlsx-js-style'
import { planMaterials, type PlanFoodSource, type PlanYieldMode } from './craft/craftPlan'
import {
  AUCTION_FEE_PERCENT,
  ITEMS,
  PROFESSIONS,
  RECIPES,
  RECIPE_MAP,
  collectPriceIds,
  isCurrentRecipe,
  DLC_NAMES,
  CURRENT_DLC,
  VIGOR_FOODS,
  MIDS,
  MID_IDS,
  npcPrice,
  priceOf,
  evaluateRecipe,
  type PriceContext,
  type RecipeResult
} from './craft/craftCalc'

const emit = defineEmits<{ (e: 'back'): void }>()

const tracker = useTracker()
const settings = computed(() => tracker.craft.value)

const COPPER_PER_GOLD = 10000

const SOURCE_OPTIONS = [
  { label: '交易行', value: 'auction' },
  { label: '自定义', value: 'manual' }
]
/** 中间件材料多一个「配方」：按配方材料费折算（仅材料行；NPC 商店的材料不走这里） */
const MID_SOURCE_OPTIONS = [...SOURCE_OPTIONS, { label: '配方', value: 'craft' }]

// ─── 技艺 Tab / 配方选择 ──────────────────────────────────────────
const FAV_TAB = '收藏'
/** 收藏里可能有数据更新后已不存在的配方 id，显示时跳过 */
const favoriteIds = computed(() => settings.value.favorites.filter((id) => RECIPE_MAP.has(id)))
const favoriteSet = computed(() => new Set(settings.value.favorites))
// 有收藏就默认打开「收藏」页签
const activeProf = ref<string>(favoriteIds.value.length ? FAV_TAB : PROFESSIONS[0])
const isFavTab = computed(() => activeProf.value === FAV_TAB)
const keyword = ref('')
/** 当前版本 / 上个资料片 切换；梓匠没有资料片标记，不受影响 */
const dlcView = ref<'current' | 'old'>('current')
const OLD_DLC_LABEL = DLC_NAMES[CURRENT_DLC - 1] ?? '上个资料片'
/** 当前 Tab 的全部配方；中间件两边都显示（旧配方也用它们，「配方」取价要靠中间件配方）；收藏页签不限版本 */
const recipesOfProf = computed(() =>
  isFavTab.value
    ? favoriteIds.value.map((id) => RECIPE_MAP.get(id)!)
    : RECIPES.filter(
        (r) =>
          r.prof === activeProf.value &&
          (MID_IDS.has(r.outs[0]?.[0]) || isCurrentRecipe(r) === (dlcView.value === 'current'))
      )
)

function toggleFavorite(recipeId: string) {
  const list = settings.value.favorites
  tracker.setCraft({ favorites: list.includes(recipeId) ? list.filter((id) => id !== recipeId) : [...list, recipeId] })
}

// ─── 交易行价格 ────────────────────────────────────────────────
const auction = ref<Record<string, AuctionPrice | null>>({})
const loading = ref(false)
const priceError = ref('')
const serverName = ref('')
const lastRefresh = ref(0)
let requestSeq = 0

async function loadPrices(force = false, recipeIds?: string[]) {
  const api = window.electronAPI
  if (!api) {
    priceError.value = '仅桌面端可查询交易行价格'
    return
  }
  const ids = collectPriceIds(recipeIds ?? recipesOfProf.value.map((r) => r.id))
  const todo = force ? ids : ids.filter((id) => !(id in auction.value))
  if (!todo.length) return
  const seq = ++requestSeq
  loading.value = true
  priceError.value = ''
  try {
    const result = await api.getAuctionPrices(todo, force)
    if (seq !== requestSeq) return
    if (!result.ok || !result.data) {
      priceError.value = result.message || '查询失败'
      return
    }
    // 切了区服就整表作废，避免新旧区服价格混在一起
    const base = result.data.server === serverName.value ? auction.value : {}
    serverName.value = result.data.server
    auction.value = { ...base, ...result.data.prices }
    lastRefresh.value = Date.now()
    resort()
    if (result.data.failed.length) priceError.value = `${result.data.failed.length} 个物品价格查询失败，可稍后点「刷新价格」重试`
  } catch (e) {
    if (seq === requestSeq) priceError.value = e instanceof Error ? e.message : '查询失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}


// ─── 计算与排序 ────────────────────────────────────────────────
const ctx = computed<PriceContext>(() => ({ settings: settings.value, auction: auction.value }))
// 只算当前 Tab 的配方
const rows = computed<RecipeResult[]>(() => recipesOfProf.value.map((r) => evaluateRecipe(r, ctx.value)))

type SortKey = 'vigor' | 'unitCost' | 'unitRevenue' | 'unitProfit' | 'perVigor'
const SORT_COLS: Array<{ key: SortKey; label: string }> = [
  { key: 'vigor', label: '精力' },
  { key: 'unitCost', label: '单件成本' },
  { key: 'unitRevenue', label: '单件收益' },
  { key: 'unitProfit', label: '单件利润' },
  { key: 'perVigor', label: '每点精力利润' }
]
const sortKey = ref<SortKey>('perVigor')
const sortDesc = ref(true)

function toggleSort(key: SortKey) {
  if (sortKey.value === key) sortDesc.value = !sortDesc.value
  else {
    sortKey.value = key
    sortDesc.value = true
  }
  resort()
}

// 排序顺序是「快照」：只在刷新价格、点表头、增删配方、收起展开行时重排。
// 改自备数量 / 取价方式会让利润实时变化，若跟着实时重排，正在编辑的行会跳走。
const order = ref<string[]>([])

function resort() {
  const dir = sortDesc.value ? -1 : 1
  // 缺价的永远排在最后，不参与升降序
  const incomplete = (r: RecipeResult) => r.cost === null || r.revenue === null
  order.value = [...rows.value]
    .sort((a, b) => {
      // 缺价（算不出成本或收益）的行不论按哪列排都沉底
      if (incomplete(a) !== incomplete(b)) return incomplete(a) ? 1 : -1
      const va = a[sortKey.value]
      const vb = b[sortKey.value]
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return (va - vb) * dir
    })
    .map((r) => r.recipe.id)
}

const profRows = computed(() => {
  const kw = keyword.value.trim()
  // 中间件的明细不受名称筛选影响（它们在中间件条里展开）
  return kw ? sortedRows.value.filter((r) => isMidRow(r) || r.recipe.name.includes(kw)) : sortedRows.value
})

/** 技艺页签里的中间件配方：汇总行由顶部中间件条代替（收藏页签仍按普通行显示） */
function isMidRow(r: RecipeResult): boolean {
  return !isFavTab.value && MID_IDS.has(r.recipe.outs[0]?.[0])
}
const listedCount = computed(() => profRows.value.filter((r) => !isMidRow(r)).length)

const sortedRows = computed(() => {
  const byId = new Map(rows.value.map((r) => [r.recipe.id, r]))
  const known = order.value.filter((id) => byId.has(id))
  const fresh = rows.value.map((r) => r.recipe.id).filter((id) => !known.includes(id))
  const all = [...known, ...fresh].map((id) => byId.get(id)!)
  // 中间件配方是各配方共用的基础材料，技艺页签里置顶（各自仍按当前排序）；收藏页签保持收藏顺序
  if (isFavTab.value) return all
  return [...all.filter(isMidRow), ...all.filter((r) => !isMidRow(r))]
})

const expanded = ref<string | null>(null)
function toggleExpand(id: string) {
  const collapsing = expanded.value === id
  expanded.value = collapsing ? null : id
  // 收起时按改过的设置重排；切到另一行时不动，免得刚点的行跳走
  if (collapsing) resort()
}

// ─── 自备 / 取价设置 ────────────────────────────────────────────
function ownedCount(recipeId: string): number {
  // NPC 商店的材料不支持自备，以前存下的不算
  return Object.keys(settings.value.owned[recipeId] ?? {}).filter((id) => npcPrice(id) === null).length
}

function setOwned(recipeId: string, itemId: string, count: number) {
  const inner = { ...(settings.value.owned[recipeId] ?? {}) }
  if (count > 0) inner[itemId] = Math.floor(count)
  else delete inner[itemId]
  // 自备变了，要买的数量跟着变，之前手填的「自制 N 个」作废，回到全部自制
  const midInner = { ...(settings.value.midSelf[recipeId] ?? {}) }
  delete midInner[itemId]
  const midSelf = { ...settings.value.midSelf, [recipeId]: midInner }
  if (!Object.keys(midInner).length) delete midSelf[recipeId]
  tracker.setCraft({ owned: { ...settings.value.owned, [recipeId]: inner }, midSelf })
}

function setAllOwned(row: RecipeResult, all: boolean) {
  const inner: Record<string, number> = {}
  if (all) row.lines.forEach((l) => { if (l.unit.via !== 'npc') inner[l.id] = l.need })
  const { [row.recipe.id]: _mid, ...midSelf } = settings.value.midSelf
  tracker.setCraft({ owned: { ...settings.value.owned, [row.recipe.id]: inner }, midSelf })
}

function setTimes(recipeId: string, n: number) {
  const times = { ...settings.value.times }
  const value = Math.max(1, Math.floor(n))
  if (value > 1) times[recipeId] = value
  else delete times[recipeId]
  // 自备数量原样保留：计算时会截到「单次数量 × 次数」，次数改小再改回不会丢。
  // 手填的补精力食物个数（买 / 自制）是按旧次数填的，次数一变就清掉，回到自动折算
  if (value === (settings.value.times[recipeId] ?? 1)) return
  const { [recipeId]: _count, ...foodCount } = settings.value.foodCount
  const { [recipeId]: _self, ...foodSelf } = settings.value.foodSelf
  // 中间件自制个数同样是按旧次数填的，清掉回到「全部自制」
  const { [recipeId]: _mid, ...midSelf } = settings.value.midSelf
  tracker.setCraft({ times, foodCount, foodSelf, midSelf })
}

function setMidSelf(recipeId: string, itemId: string, count: number | null) {
  const all = { ...settings.value.midSelf }
  const inner = { ...(all[recipeId] ?? {}) }
  if (count === null) delete inner[itemId]
  else inner[itemId] = Math.max(0, Math.floor(count))
  if (Object.keys(inner).length) all[recipeId] = inner
  else delete all[recipeId]
  tracker.setCraft({ midSelf: all })
}

function setYield(recipeId: string, itemId: string, value: number | null) {
  const inner = { ...(settings.value.yield[recipeId] ?? {}) }
  if (value === null) delete inner[itemId]
  else inner[itemId] = value
  tracker.setCraft({ yield: { ...settings.value.yield, [recipeId]: inner } })
}

function setFoodSelf(recipeId: string, count: number | null) {
  const next = { ...settings.value.foodSelf }
  if (!count || count <= 0) delete next[recipeId]
  else next[recipeId] = Math.floor(count)
  tracker.setCraft({ foodSelf: next })
}

function setFoodCount(recipeId: string, count: number | null) {
  const next = { ...settings.value.foodCount }
  if (count === null) delete next[recipeId]
  else next[recipeId] = Math.max(0, Math.floor(count))
  tracker.setCraft({ foodCount: next })
}

function setVigorFood(recipeId: string, key: string) {
  const next = { ...settings.value.vigorFood }
  if (key) next[recipeId] = key
  else delete next[recipeId]
  // 换了食物，原来手填的个数是按旧食物填的，不再适用
  const { [recipeId]: _count, ...foodCount } = settings.value.foodCount
  const { [recipeId]: _self, ...foodSelf } = settings.value.foodSelf
  tracker.setCraft({ vigorFood: next, foodCount, foodSelf })
}

function setSource(itemId: string, source: CraftPriceSource) {
  const next = { ...settings.value.source }
  // 缺省即交易行，只记录改成自定义 / 配方的
  if (source === 'manual' || source === 'craft') next[itemId] = source
  else delete next[itemId]
  // 切换取价方式后，各配方里手填的「自制 N 个」作废，回到默认（全部自制）
  const midSelf: CraftSettings['midSelf'] = {}
  for (const [rid, inner] of Object.entries(settings.value.midSelf)) {
    const { [itemId]: _drop, ...rest } = inner
    if (Object.keys(rest).length) midSelf[rid] = rest
  }
  tracker.setCraft({ source: next, midSelf })
}

function setManual(itemId: string, gold: number | null) {
  const next = { ...settings.value.manual }
  if (gold === null) delete next[itemId]
  else next[itemId] = Math.round(gold * COPPER_PER_GOLD)
  tracker.setCraft({ manual: next })
}

// 放在 order / sortKey 等声明之后：immediate 回调会调 resort()
watch(
  // 切到哪个技艺 Tab / 版本才查对应配方的价格
  () => [activeProf.value, dlcView.value],
  async () => {
    const server = await window.electronAPI?.getGoldServer()
    if (server && server.serverName !== serverName.value) {
      auction.value = {}
      serverName.value = server.serverName
    }
    expanded.value = null
    keyword.value = ''
    resort()
    void loadPrices()
  },
  { immediate: true }
)

const midOpen = ref(false)
/** 抽屉里放中间件行的 tbody；抽屉关闭时为 null，中间件行就不渲染 */
const midTbody = ref<HTMLElement | null>(null)
watch(activeProf, () => { midOpen.value = false })

/** 外面只留简要信息：中间件个数 */
const midSummary = computed(() => {
  if (isFavTab.value) return null
  const total = rows.value.filter((r) => MID_IDS.has(r.recipe.outs[0]?.[0])).length
  return total ? { total } : null
})

/** 中间件条上的名称和交易行价（固定交易行价，方便和自制成本对比） */
function midInfo(row: RecipeResult) {
  const id = row.recipe.outs[0][0]
  const a = auction.value[id]
  return { name: ITEMS[id]?.name ?? id, price: a ? a.price : null, updatedAt: a?.updatedAt }
}

// ─── 固定头部 ────────────────────────────────────────────────
// 表头要贴在固定区块下面，而固定区块高度会变（中间件价格条可能换行），所以实时量
const stickyEl = ref<HTMLElement | null>(null)
const stickyHeight = ref(0)
let stickyObserver: ResizeObserver | null = null
watch(stickyEl, (el) => {
  stickyObserver?.disconnect()
  if (!el) return
  stickyObserver = new ResizeObserver(() => { stickyHeight.value = el.offsetHeight })
  stickyObserver.observe(el)
}, { flush: 'post', immediate: true })
onBeforeUnmount(() => stickyObserver?.disconnect())

// ─── 显示辅助 ────────────────────────────────────────────────
/** 「·精」是小概率出的精品，用和补精力标签一样的橙色突出 */
const REFINED_COLOR = '#f0a020'
/** 非主产物且单次期望低于这个值，算「低期望」（如 4% 出的高档宴席），同样标橙 */
const LOW_EXPECT = 0.5
function nameColor(itemId: string, lowExpect = false): string | undefined {
  return lowExpect || ITEMS[itemId]?.name.endsWith('·精') ? REFINED_COLOR : qualityColor(itemId)
}

function effectOf(itemId?: string): string {
  return itemId ? ITEMS[itemId]?.fx ?? '' : ''
}

const QUALITY_COLORS: Record<number, string> = { 2: '#2e9d4f', 3: '#2b7bd6', 4: '#a33fd1', 5: '#e08a00' }
function qualityColor(itemId?: string): string | undefined {
  return itemId ? QUALITY_COLORS[ITEMS[itemId]?.q ?? 0] : undefined
}

function profitClass(v: number | null): string {
  if (v === null) return ''
  return v > 0 ? 'cp-pos' : v < 0 ? 'cp-neg' : ''
}

function toGoldInput(copper?: number): number | null {
  return copper === undefined ? null : copper / COPPER_PER_GOLD
}


function ageClass(ts?: number): string {
  return isStale(ts) ? 'cp-stale' : 'cp-muted'
}

function formatClock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

// ─── 材料清单（多配方合计） ───────────────────────────────────────
// 选择只在本页内存里保存，跨技艺 Tab 有效；制作次数复用配方各自的「制作次数」设置
const selectedIds = ref<string[]>([])
const selectedSet = computed(() => new Set(selectedIds.value))
/** 不计入精力的配方（咸骨粥这类不想算进精力药的） */
const noVigorIds = ref<Set<string>>(new Set())
/** 清单里被忽略的配方：不参与计算，相当于没选，但随时能加回来；和列表里的勾选无关 */
const ignoredIds = ref<Set<string>>(new Set())
function setIgnored(id: string, on: boolean) {
  const next = new Set(ignoredIds.value)
  if (on) next.add(id)
  else next.delete(id)
  ignoredIds.value = next
}
const planOpen = ref(false)
const planFoodOn = ref(false)
const planFoodKey = ref<string>(VIGOR_FOODS[0].key)
const planFoodSource = ref<PlanFoodSource>('self')
const planIgnoreMid = ref(true)
const planYieldMode = ref<PlanYieldMode>('min')
/** 自制精力药的产出口径，默认期望（折算的本来就是大概值） */
const planFoodYield = ref<PlanYieldMode>('expected')
/** 按数量制作的配方各自的产出口径：recipeId → 保底 / 期望；缺省保底 */
const planQtyYield = ref<Record<string, PlanYieldMode>>({})
/** 按数量制作的配方：recipeId → 想要的件数；没有记录 = 按次数 */
const planQty = ref<Record<string, number>>({})
/** 按次数制作的临时次数：recipeId → 次数；没有记录 = 取配方设置里的制作次数。只在本次清单有效 */
const planTimes = ref<Record<string, number>>({})
/** 自备的基础材料：itemId → 自备数量；有记录 = 选了自备，这部分不计成本 */
const planOwned = ref<Record<string, number>>({})
/** 自备的中间件 / 精力药：制作行 key → 自备个数，这部分不用做 */
const planOwnedCraft = ref<Record<string, number>>({})
/** 基础材料表里没有数据的来源列整列隐藏（比如没用到中间件就不显示「中间件用」） */
const showCol = computed(() => ({
  direct: plan.value.materials.some((m) => m.direct),
  mid: plan.value.materials.some((m) => m.viaMid),
  food: plan.value.materials.some((m) => m.viaFood),
  /** 有材料选了自备才显示「自备数量」列 */
  owned: plan.value.materials.some((m) => m.isOwn)
}))
/** 「合计」行文字占的列数：材料 + 合计 + 可见的来源列 / 自备数量列 + 取价 + 单价 */
const totalLabelCols = computed(() => 2 + Object.values(showCol.value).filter(Boolean).length + 2)
/** 买的精力药行里，「合计」和「取价」之间的空列数（至少 1 列，保持列对齐） */
const foodBlankCols = computed(() => [showCol.value.direct, showCol.value.mid, showCol.value.food].filter(Boolean).length)
const VIA_LABEL: Record<string, string> = { npc: 'NPC', auction: '交易行', manual: '自定义', craft: '配方' }

function toggleSelected(id: string, on: boolean) {
  selectedIds.value = on ? (selectedSet.value.has(id) ? selectedIds.value : [...selectedIds.value, id]) : selectedIds.value.filter((x) => x !== id)
}
function clearSelected() {
  selectedIds.value = []
  resetPlanTemp()
}
/** 清单里的修改都是临时的：关闭抽屉就恢复默认（选择哪些配方不属于「修改」，保留） */
function resetPlanTemp() {
  planTimes.value = {}
  planQty.value = {}
  planQtyYield.value = {}
  planOwned.value = {}
  planOwnedCraft.value = {}
  ignoredIds.value = new Set()
  noVigorIds.value = new Set()
  planFoodOn.value = false
  planFoodKey.value = VIGOR_FOODS[0].key
  planFoodSource.value = 'self'
  planFoodYield.value = 'expected'
  planIgnoreMid.value = true
  planYieldMode.value = 'min'
}
watch(planOpen, (open) => {
  if (!open) resetPlanTemp()
})

/** 切换取价方式：选自备时默认全部自备，之后可改数量；切回交易行就清掉 */
function setMatOwn(id: string, own: boolean, total: number) {
  if (own) planOwned.value = { ...planOwned.value, [id]: total }
  else {
    const { [id]: _drop, ...rest } = planOwned.value
    planOwned.value = rest
  }
}
function setCraftOwned(key: string, qty: number) {
  planOwnedCraft.value = { ...planOwnedCraft.value, [key]: Math.max(0, Math.floor(qty)) }
}
/** 能自备的材料（NPC 有售的不支持）：一键全自备 / 清空 */
const ownableMats = computed(() => plan.value.materials.filter((m) => m.unit.via !== 'npc'))
const allMatsOwn = computed(() => ownableMats.value.length > 0 && ownableMats.value.every((m) => m.isOwn && m.owned >= m.total))
function setAllMatOwn(own: boolean) {
  const next = { ...planOwned.value }
  for (const m of ownableMats.value) {
    if (own) next[m.id] = m.total
    else delete next[m.id]
  }
  planOwned.value = next
}
function setMatOwned(id: string, qty: number) {
  planOwned.value = { ...planOwned.value, [id]: Math.max(0, Math.floor(qty)) }
}
/** 小概率产物的简称：「云芝竹沥羹·精」→「精」 */
function shortOutName(name: string): string {
  const i = name.lastIndexOf('·')
  return i >= 0 ? name.slice(i + 1) : name
}
function setPlanTimes(id: string, n: number) {
  planTimes.value = { ...planTimes.value, [id]: Math.max(1, Math.floor(n)) }
}
function setPlanQty(id: string, qty: number) {
  planQty.value = { ...planQty.value, [id]: Math.max(1, Math.floor(qty)) }
}
function setPlanQtyYield(id: string, mode: PlanYieldMode) {
  planQtyYield.value = { ...planQtyYield.value, [id]: mode }
}
/** 切换制作方式时数字原样带过去，不做折算：次数 70 → 按数量 70 件；反过来同理。之后想改自己再改 */
function setPlanMode(r: { recipe: { id: string }; times: number; qty?: number }, byQty: boolean) {
  if (byQty) setPlanQty(r.recipe.id, r.times)
  else {
    const { [r.recipe.id]: _drop, ...rest } = planQty.value
    planQty.value = rest
    if (r.qty !== undefined) setPlanTimes(r.recipe.id, r.qty)
  }
}
function setCountVigor(id: string, count: boolean) {
  const next = new Set(noVigorIds.value)
  if (count) next.delete(id)
  else next.add(id)
  noVigorIds.value = next
}

const planEntry = (recipeId: string) => ({ recipeId, times: planTimes.value[recipeId], countVigor: !noVigorIds.value.has(recipeId), qty: planQty.value[recipeId], qtyYield: planQtyYield.value[recipeId] })
const planOpts = computed(() => ({
  food: planFoodOn.value ? VIGOR_FOODS.find((f) => f.key === planFoodKey.value) ?? null : null,
  foodSource: planFoodSource.value,
  ignoreMidVigor: planIgnoreMid.value,
  yieldMode: planYieldMode.value,
  foodYieldMode: planFoodYield.value,
  owned: planOwned.value,
  ownedCraft: planOwnedCraft.value
}))
const plan = computed(() => planMaterials(selectedIds.value.filter((id) => !ignoredIds.value.has(id)).map(planEntry), planOpts.value, ctx.value))

/** 清单里的配方行：按勾选顺序，被忽略的没有 line */
const planRows = computed(() =>
  selectedIds.value.flatMap((id) => {
    const recipe = RECIPE_MAP.get(id)
    return recipe ? [{ id, recipe, line: plan.value.recipes.find((r) => r.recipe.id === id) }] : []
  })
)

// 打开清单（或清单打开时选择变了）就补查选中配方、精力药、中间件材料的价格
watch([planOpen, selectedIds], () => {
  if (planOpen.value && selectedIds.value.length) void loadPrices(false, selectedIds.value)
})

// ─── 导出 Excel ──────────────────────────────────────────────────
type XCell = string | number | null | { v: string | number; fill?: string; color?: string; bold?: boolean; align?: 'left' | 'center' | 'right'; fmt?: string }

const X_BORDER = { top: { style: 'thin', color: { rgb: 'D0D5DD' } }, bottom: { style: 'thin', color: { rgb: 'D0D5DD' } }, left: { style: 'thin', color: { rgb: 'D0D5DD' } }, right: { style: 'thin', color: { rgb: 'D0D5DD' } } }
const X_FONT = '微软雅黑'

/** 带样式的单元格：表头蓝底白字、斑马纹、细边框、数字靠右、金额两位小数 */
function xCell(c: XCell, opt: { header?: boolean; zebra?: boolean; total?: boolean; num?: boolean; wrap?: boolean }) {
  const o = c !== null && typeof c === 'object' ? c : { v: c ?? '' }
  const isNum = typeof o.v === 'number'
  const fill = opt.header ? '4472C4' : o.fill ?? (opt.total ? 'E8EEF9' : opt.zebra ? 'F5F7FA' : undefined)
  return {
    v: o.v,
    t: isNum ? 'n' : 's',
    z: isNum ? o.fmt ?? (opt.num ? '#,##0.00##' : '0') : undefined,
    s: {
      font: { name: X_FONT, sz: 11, bold: opt.header || opt.total || o.bold || false, color: { rgb: opt.header ? 'FFFFFF' : o.color ?? '1F2937' } },
      fill: fill ? { patternType: 'solid', fgColor: { rgb: fill } } : undefined,
      alignment: { horizontal: opt.header ? 'center' : o.align ?? (isNum ? 'right' : 'left'), vertical: 'center', wrapText: opt.wrap ?? false },
      border: X_BORDER
    }
  }
}

function xSheet(headers: string[], rows: XCell[][], opt: { widths: number[]; wrapCols?: number[]; totalLast?: boolean; moneyCols?: number[] }) {
  const money = new Set(opt.moneyCols ?? [])
  const wrap = new Set(opt.wrapCols ?? [])
  const data = [
    headers.map((h) => xCell(h, { header: true })),
    ...rows.map((r, i) => r.map((c, j) => xCell(c, { zebra: i % 2 === 1, total: opt.totalLast && i === rows.length - 1, num: money.has(j), wrap: wrap.has(j) })))
  ]
  const ws = XLSX.utils.aoa_to_sheet(data as never)
  ws['!cols'] = opt.widths.map((wch) => ({ wch }))
  ws['!rows'] = [{ hpt: 24 }]
  return ws
}

const exporting = ref(false)
const message = useMessage()

async function exportPlan() {
  const api = window.electronAPI
  if (!api?.saveFile) {
    message.warning('仅桌面端可导出 Excel')
    return
  }
  if (exporting.value) return
  exporting.value = true
  try {
    const p = plan.value
    const gold = (copper: number | null): number | string => (copper === null ? '' : Math.round((copper / COPPER_PER_GOLD) * 10000) / 10000)
    const noPrice: XCell = { v: '无报价', color: 'D92D20', align: 'right' }
    const viaCell = (via: string): XCell => (via === 'npc' ? { v: VIA_LABEL[via], fill: 'E6F4EA', color: '1E7B3A', align: 'center' } : { v: VIA_LABEL[via] ?? via, align: 'center' })

    // 基础材料
    const nameCell = (id: string, name: string): XCell => {
      const c = qualityColor(id)
      return c ? { v: name, color: c.slice(1).toUpperCase() } : name
    }
    const mats: XCell[][] = p.materials.map((m) => [
      nameCell(m.id, m.name),
      { v: m.total, bold: true },
      m.direct || '',
      m.viaMid || '',
      m.viaFood || '',
      m.isOwn ? { v: '自备', fill: 'FFF4E5', color: 'B54708', align: 'center' } : viaCell(m.unit.via),
      m.isOwn ? m.owned : '',
      m.isOwn && m.owned < m.total ? { v: m.total - m.owned, color: 'D92D20', bold: true } : '',
      m.unit.price === null ? noPrice : gold(m.unit.price),
      m.subtotal === null ? noPrice : gold(m.subtotal)
    ])
    if (p.food?.source === 'buy') {
      mats.push([`${p.food.food.name}（精力药）`, { v: p.food.count, bold: true }, '', '', '', p.food.unit ? viaCell(p.food.unit.via) : '', '', '', p.food.unit?.price == null ? noPrice : gold(p.food.unit.price), p.food.cost === null ? noPrice : gold(p.food.cost)])
    }
    mats.push(['合计（自备材料不计）', '', '', '', '', '', '', '', '', p.cost === null ? { v: `缺价：${p.missing.join('、')}`, color: 'D92D20' } : gold(p.cost)])

    // 不输出的列：没有自备材料时去掉「自备数量 / 差额」
    const dropCols = (headers: string[], rows: XCell[][], widths: number[], idx: number[]) => ({
      headers: headers.filter((_, i) => !idx.includes(i)),
      rows: rows.map((r) => r.filter((_, i) => !idx.includes(i))),
      widths: widths.filter((_, i) => !idx.includes(i))
    })
    const hasOwn = p.materials.some((m) => m.isOwn)
    const matsT = dropCols(['材料', '合计', '配方直接用', '中间件用', '精力药用', '取价', '自备数量', '差额', '单价（金）', '小计（金）'], mats, [22, 10, 12, 10, 10, 10, 10, 8, 14, 16], hasOwn ? [] : [6, 7])

    // 配方材料明细：每个配方、每种中间件 / 精力药各一张小表，叠在同一个工作表里
    // 配方的小表单独算（中间件、自制精力药一并展开），不扣自备；中间件 / 精力药的小表是汇总后的实际用量，已扣自备
    const kindCell = (kind: 'mid' | 'food'): XCell => (kind === 'food' ? { v: '精力药', fill: 'FFF4E5', color: 'B54708', align: 'center' } : { v: '中间件', fill: 'E8F0FE', color: '1D4ED8', align: 'center' })
    const blocks: Array<{ title: string; rows: XCell[][] }> = []
    for (const r of p.recipes) {
      const solo = planMaterials([planEntry(r.recipe.id)], { ...planOpts.value, owned: {}, ownedCraft: {} }, ctx.value)
      const via = (m: (typeof solo.materials)[number]) => [m.direct ? `配方 ${m.direct}` : '', m.viaMid ? `中间件 ${m.viaMid}` : '', m.viaFood ? `精力药 ${m.viaFood}` : ''].filter(Boolean).join(' / ')
      const how = r.qty === undefined ? `按次数 ${r.times} 次` : `按数量 ${r.qty} 件（${r.qtyYield === 'expected' ? '期望' : '保底'}），做 ${r.times} 次`
      const vigor = planFoodOn.value ? `　精力 ${round1(r.vigor)}${r.countVigor ? '' : '（不计入）'}` : ''
      blocks.push({
        title: `${r.recipe.name}（${r.recipe.prof}）　${how}${vigor}`,
        rows: [
          ...solo.materials.map((m): XCell[] => ['材料', nameCell(m.id, m.name), { v: m.total, bold: true }, via(m)]),
          ...solo.crafts.map((c): XCell[] => [kindCell(c.kind), c.name, { v: c.crafts, bold: true }, `需要 ${c.need}，做 ${c.crafts} 次：${c.mats.map((m) => `${m.name}×${m.qty}`).join('、')}`])
        ]
      })
    }
    for (const c of p.crafts) {
      blocks.push({
        title: `${c.name}（${c.kind === 'food' ? '精力药' : '中间件'}）　需要 ${c.need}${c.owned ? `，自备 ${c.owned}` : ''}，做 ${c.crafts} 次，产出 ${round1(c.produced)}${planFoodOn.value ? `　精力 ${round1(c.vigor)}` : ''}`,
        rows: c.mats.map((m): XCell[] => ['材料', nameCell(m.id, m.name), { v: m.qty, bold: true }, ''])
      })
    }
    // 全部放在同一个工作表：基础材料表在最上面，下面接精力汇总和各张小表。
    // 小表的列对齐到基础材料表的列宽：名称（材料列）、数量（合计列）、类别、说明（合并到最右）
    const COLS = matsT.headers.length
    const fillCell = (v: string) => xCell({ v, bold: true, fill: 'E8EEF9' }, {})
    const wb = XLSX.utils.book_new()
    const ws = xSheet(matsT.headers, matsT.rows, { widths: matsT.widths, moneyCols: hasOwn ? [8, 9] : [6, 7], totalLast: true })
    const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [...(ws['!merges'] ?? [])]
    let row = matsT.rows.length + 2 // 表头 + 数据行，再空一行

    // 精力汇总
    const sum: Array<[string, string | number]> = !planFoodOn.value ? [] : [['精力：本体', round1(p.vigorBody)], [planIgnoreMid.value ? '精力：中间件（已忽略）' : '精力：中间件', planIgnoreMid.value ? round1(p.vigorMidIgnored) : round1(p.vigorMid)], ['精力：精力药制作', round1(p.vigorFood)], ['精力：总消耗', round1(p.vigorAll)]]
    if (planFoodOn.value && p.food) sum.push([`精力药：${p.food.food.name}`, `${p.food.count} 个（${p.food.source === 'self' ? `自己做 ${p.food.crafts} 次` : '交易行买'}）`])
    if (sum.length) {
      XLSX.utils.sheet_add_aoa(ws, sum.map(([k, v], i) => [xCell({ v: k, bold: true, fill: 'E8EEF9' }, {}), xCell({ v, bold: i === 3, align: typeof v === 'number' ? 'right' : 'left', fmt: 'General' }, {})]) as never, { origin: { r: row, c: 0 } })
      row += sum.length + 1
    }

    // 各张小表：先每个配方，再每种中间件 / 精力药
    for (const [i, b] of blocks.entries()) {
      if (i === 0) {
        merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })
        XLSX.utils.sheet_add_aoa(ws, [[fillCell('配方材料明细'), ...Array.from({ length: COLS - 1 }, () => fillCell(''))]] as never, { origin: { r: row, c: 0 } })
        row += 2
      }
      const pad = (cells: unknown[]) => [...cells, ...Array.from({ length: COLS - cells.length }, () => xCell('', {}))]
      const aoa: unknown[][] = [
        [fillCell(b.title), ...Array.from({ length: COLS - 1 }, () => fillCell(''))],
        pad(['名称', '数量 / 次数', '类别', '说明'].map((h) => xCell(h, { header: true }))),
        // 名称、数量、类别、说明：说明合并到最右，长文字不会被截断
        ...b.rows.map((r, j) => pad([r[1], r[2], r[0], r[3]].map((c) => xCell(c, { zebra: j % 2 === 1 }))))
      ]
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })
      merges.push({ s: { r: row + 1, c: 3 }, e: { r: row + 1, c: COLS - 1 } })
      b.rows.forEach((_, j) => merges.push({ s: { r: row + 2 + j, c: 3 }, e: { r: row + 2 + j, c: COLS - 1 } }))
      XLSX.utils.sheet_add_aoa(ws, aoa as never, { origin: { r: row, c: 0 } })
      row += aoa.length + 1
    }
    ws['!merges'] = merges
    XLSX.utils.book_append_sheet(wb, ws, '材料清单')

    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string
    const date = new Date().toISOString().slice(0, 10)
    const result = await api.saveFile(`技艺材料清单-${date}.xlsx`, base64, 'Excel 文件', 'xlsx')
    if (result.ok) message.success(`已导出：${result.filePath ?? ''}`)
    else if (result.message) message.error(`导出失败：${result.message}`)
    else message.info('已取消导出')
  } catch (e) {
    message.error(`导出失败：${e instanceof Error ? e.message : '未知错误'}`)
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.cp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.cp-title {
  font-size: 16px;
  font-weight: 600;
}
.cp-tabs {
  margin-top: 12px;
}
.cp-sticky {
  position: sticky;
  top: 0;
  z-index: 3;
  background: #fff;
}
/* 只固定主表自己的表头；展开面板里嵌套的材料表 / 产物表表头不固定 */
.cp-table > thead > tr > th {
  position: sticky;
  top: var(--cp-sticky-h, 0px);
  z-index: 2;
  background: #fff;
}
.cp-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f7f3ea 0%, #eef5fb 100%);
}
.cp-bar-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cp-bar-ctrl {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cp-muted {
  font-size: 12px;
  color: #8a96a3;
}
.cp-error {
  margin-top: 8px;
  font-size: 12px;
  color: #d03050;
}
.cp-add {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 14px 0;
}
.cp-empty {
  padding: 40px 0;
  text-align: center;
  color: #8a96a3;
  font-size: 13px;
}
.cp-table,
.cp-sub {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.cp-table th,
.cp-sub th {
  font-weight: 500;
  color: #6b7785;
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid #eceff3;
  white-space: nowrap;
}
.cp-table td {
  padding: 8px;
  border-bottom: 1px solid #f2f4f7;
}
.cp-sub td {
  padding: 4px 8px;
}
.cp-num {
  text-align: right !important;
  white-space: nowrap;
}
.cp-sortable {
  cursor: pointer;
  user-select: none;
}
.cp-sort {
  display: inline-block;
  width: 12px;
  font-size: 10px;
}
.cp-row {
  cursor: pointer;
}
.cp-row:hover,
.cp-row.open {
  background: #f7f9fc;
}
.cp-row.open > td {
  border-bottom-color: transparent;
  font-weight: 500;
}
.cp-caret {
  display: inline-block;
  width: 14px;
  color: #a0a9b4;
}
.cp-subline {
  margin-top: 2px;
  font-size: 12px;
  font-weight: normal;
}
.cp-subline:not(.cp-pos):not(.cp-neg) {
  color: #8a96a3;
}
.cp-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-left: 3px;
  border: 1px solid #b6bec8;
  border-radius: 50%;
  font-size: 10px;
  line-height: 1;
  color: #8a96a3;
  cursor: help;
  vertical-align: 1px;
}
.cp-help-sub {
  margin-bottom: 4px;
  font-size: 12px;
  opacity: 0.75;
}
.cp-help:hover {
  border-color: #18a058;
  color: #18a058;
}
.cp-hint {
  cursor: help;
}
.cp-partial {
  color: #d08a00 !important;
}
.cp-star {
  display: inline-block;
  width: 21px;
  font-size: 17px;
  line-height: 1;
  vertical-align: -2px;
  margin-right: 2px;
  color: #c2c8cf;
  cursor: pointer;
}
.cp-star:hover,
.cp-star.on {
  color: #f0a020;
}
.cp-prof {
  margin-left: 6px;
  margin-right: 4px;
}
.cp-col-op {
  width: 48px;
  text-align: right;
}
.cp-strong {
  font-weight: 600;
}
.cp-pos {
  color: #18a058;
}
.cp-neg {
  color: #d03050;
}
.cp-missing {
  font-size: 12px;
  color: #c0874f;
}
.cp-stale {
  font-size: 12px;
  color: #c0c4cc;
}
.cp-source {
  /* 缩到和 tiny 输入框一样高（22px）。改 naive 的尺寸变量而不是分别改高度：
     按钮组外壳、按钮、分隔线都读 --n-height，只改按钮会让它沉到 28px 外壳底部，跟旁边控件对不齐 */
  --n-height: 22px !important;
  --n-font-size: 12px !important;
  vertical-align: middle;
}
.cp-source :deep(.n-radio-button) {
  padding: 0 8px;
}
.cp-mids {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.cp-yield {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.cp-yield-custom :deep(input) {
  color: #2080f0;
  font-weight: 600;
}
.cp-mid-clickable {
  cursor: pointer;
}
.cp-mid-clickable:hover,
.cp-mid.open {
  border-color: #18a058;
}
.cp-mid-self {
  margin-top: 4px;
  font-size: 12px;
  white-space: nowrap;
}
.cp-mid-self-line {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
}
.cp-mid-k {
  font-size: 12px;
  color: #8a96a3;
}
.cp-mids-label {
  margin: 8px 0 6px;
  font-size: 12px;
  color: #8a96a3;
}
.cp-mids-row > td {
  display: table-cell;
}
.cp-mids-row > td > * {
  margin-right: 12px;
}
.cp-mids-title {
  font-weight: 600;
}
.cp-mid {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid #e3e8ee;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
}
.cp-fx {
  margin: 2px 0 0 14px;
  max-width: 420px;
  font-size: 12px;
  color: #8a96a3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cp-fx-full {
  margin-left: 0;
  max-width: 460px;
  white-space: normal;
}
.cp-food-tag {
  margin-left: 6px;
}
.cp-food-row > td {
  border-top: 1px dashed #dfe5ec;
}
.cp-npc {
  font-size: 12px;
  color: #6b7785;
}
.cp-times {
  margin-left: 4px;
  font-size: 12px;
  color: #8a96a3;
}
.cp-times-ctrl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 400;
}
.cp-via {
  font-size: 11px;
  color: #a0a9b4;
}
.cp-detail-row > td {
  padding: 6px 0 16px;
}
/* 展开面板做成独立卡片，和上下的配方行区分开 */
.cp-detail {
  border: 1px solid #dfe5ec;
  border-left: 3px solid #18a058;
  border-radius: 10px;
  background: #fafbfc;
  padding: 4px 16px 12px;
  box-shadow: 0 2px 8px rgba(31, 45, 61, 0.06);
}
.cp-total-row td {
  border-top: 1px solid #dfe5ec;
  padding-top: 6px !important;
  font-weight: 600;
  color: #2c3a47;
}
.cp-help-title {
  font-weight: 600;
  margin-bottom: 2px;
}
.cp-detail-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 10px 0 4px;
  font-weight: 500;
}
.cp-detail-actions {
  margin-left: auto;
  display: flex;
  gap: 12px;
}
.cp-owned {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cp-foot {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 12px;
}

.cp-pick {
  display: inline-flex;
  vertical-align: middle;
  margin-right: 4px;
}
.cp-plan-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 22px 0 8px;
  font-weight: 600;
}
.cp-plan-title:first-child {
  margin-top: 0;
}
.cp-plan-title .cp-muted {
  margin-left: 10px;
  font-weight: 400;
  font-size: 12px;
}
.cp-plan-temp {
  margin-bottom: 10px;
  font-size: 12px;
}
.cp-plan-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 10px;
  margin-bottom: 4px;
}
.cp-plan-card {
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.1);
}
.cp-plan-card-k {
  font-size: 12px;
  opacity: 0.65;
}
.cp-plan-card-v {
  margin: 2px 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
}
.cp-plan-card-s {
  font-size: 12px;
  opacity: 0.6;
}
.cp-plan-opts {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.07);
}
.cp-plan-opt {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.cp-plan-opt-label.cp-plan-opt-inline {
  min-width: 0;
  margin-left: 6px;
}
.cp-plan-opt-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 170px;
}
.cp-plan-mat {
  display: inline-block;
  margin: 2px 12px 2px 0;
}
.cp-plan-mat b {
  margin-left: 2px;
  font-weight: 600;
}
.cp-plan-table td,
.cp-plan-table th {
  padding: 4px 8px;
}
/* 基础材料表：除「材料」外各列都收到内容宽度，多余的宽度全给第一列，避免数字列之间被撑出大块空白 */
.cp-plan-mat-table th:not(:first-child),
.cp-plan-mat-table td:not(:first-child) {
  width: 1%;
  white-space: nowrap;
  padding-left: 16px;
  padding-right: 16px;
}
.cp-plan-total td {
  font-weight: 600;
  border-top: 1px solid rgba(127, 127, 127, 0.3);
}
.cp-plan-mats {
  font-size: 12px;
  line-height: 1.6;
}
.cp-plan-note {
  margin-top: 4px;
  font-size: 12px;
}
.cp-plan-mode {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cp-plan-qty {
  display: flex;
  justify-content: flex-end;
}
.cp-center {
  text-align: center;
}
.cp-plan-btn {
  display: inline-flex;
}
.cp-plan-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
/* 自备数量列收到刚好放下输入框的宽度，多余的宽度留给别的列 */
.cp-all-own {
  margin-left: 6px;
  font-weight: normal;
}
.cp-plan-ignored td {
  opacity: 0.6;
}
.cp-plan-ignored td:last-child {
  opacity: 1;
}
.cp-plan-acts {
  white-space: nowrap;
}
.cp-own-short {
  color: #d03050;
  font-size: 12px;
  line-height: 1.2;
  margin-top: 2px;
}
.cp-plan-own-col {
  width: 1%;
  white-space: nowrap;
}
/* 取价列收到刚好放下下拉的宽度；NPC 标签和下拉同宽、左对齐 */
.cp-plan-src-col {
  width: 1%;
  white-space: nowrap;
  text-align: left;
}
.cp-plan-src-tag {
  width: 64px;
  justify-content: center;
  box-sizing: border-box;
}
.cp-plan-src :deep(.n-base-selection) {
  --n-font-size: 12px;
  --n-height: 22px;
  --n-padding-single: 0 20px 0 8px;
  --n-arrow-size: 12px;
}
.cp-plan-src :deep(.n-base-selection-input__content) {
  font-size: 12px;
}
</style>
