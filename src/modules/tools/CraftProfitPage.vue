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
        <span v-if="isFavTab" class="cp-muted">共收藏 {{ listedCount }} 条配方</span>
        <span v-else class="cp-muted">{{ activeProf }}共 {{ listedCount }} 条{{ activeProf === '梓匠' ? '' : '当前版本' }}配方</span>
      </div>
      </div>

      <div v-if="!profRows.length" class="cp-empty">{{ isFavTab && !favoriteIds.length ? '还没有收藏配方，点配方名前的 ☆ 即可收藏' : '没有匹配的配方' }}</div>

      <table v-else class="cp-table" :style="{ '--cp-sticky-h': `${stickyHeight}px` }">
        <thead>
          <tr>
            <th class="cp-col-name">配方</th>
            <th v-for="col in SORT_COLS" :key="col.key" class="cp-num cp-sortable" @click="toggleSort(col.key)">
              {{ col.label }}<n-tooltip v-if="col.key === 'revenue'" :delay="100" placement="bottom">
                <template #trigger><span class="cp-help" @click.stop>?</span></template>
                <div>收益 = 交易行售出实际可获得金额（已扣 5% 手续费）</div>
                <div>综合收益 = 各产物按出现概率加权的期望收益 = Σ（产物单价 × 单次期望 × 制作次数 × 95%）</div>
                <div class="cp-help-sub">单次期望 = 出现概率 ×（最少 + 最多）÷ 2；95% 为扣除交易行手续费</div>
                <div>保底 = 只算主产物（概率最高的那件）的收益，不算【精】等小概率产物</div>
              </n-tooltip><n-tooltip v-else-if="col.key === 'profit'" :delay="100" placement="bottom">
                <template #trigger><span class="cp-help" @click.stop>?</span></template>
                <div>综合利润 = Σ（产物单价 × 单次期望 × 制作次数 × 95%）− 成本</div>
                <div class="cp-help-sub">单次期望 = 出现概率 ×（最少 + 最多）÷ 2，可在展开面板里改；95% 为扣除交易行手续费</div>
                <div>保底 = 主产物单价 × 单次期望 × 制作次数 × 95% − 成本（不算【精】等小概率产物）</div>
                <div>部分缺价：有小概率产物没有交易行报价，按 0 计入，期望利润可能偏低</div>
              </n-tooltip><span class="cp-sort">{{ sortKey === col.key ? (sortDesc ? '▼' : '▲') : '' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
            <tr v-if="midSummary" class="cp-mids-row">
              <td colspan="7">
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
              <td class="cp-num"><CraftMoney v-if="row.cost !== null" :value="row.cost" /><span v-else class="cp-missing">缺价</span></td>
              <td class="cp-num"><CraftMoney v-if="row.unitCost !== null" :value="row.unitCost" /><span v-else>—</span></td>
              <td class="cp-num">
                <CraftMoney v-if="row.revenue !== null" :value="row.revenue" /><span v-else class="cp-missing">无报价</span>
                <div v-if="row.baseRevenue !== null" class="cp-subline">保底 <CraftMoney :value="row.baseRevenue" /></div>
              </td>
              <td class="cp-num" :class="profitClass(row.profit)">
                <CraftMoney v-if="row.profit !== null" :value="row.profit" /><span v-else>—</span>
                <div v-if="row.baseProfit !== null" class="cp-subline" :class="profitClass(row.baseProfit)">保底 <CraftMoney :value="row.baseProfit" /></div>
                <div v-if="row.partialOutputs" class="cp-subline cp-partial">部分缺价</div>
              </td>
              <td class="cp-num cp-strong" :class="profitClass(row.perVigor)"><CraftMoney v-if="row.perVigor !== null" :value="row.perVigor" /><span v-else>—</span>
                <div v-if="row.basePerVigor !== null" class="cp-subline" :class="profitClass(row.basePerVigor)">保底 <CraftMoney :value="row.basePerVigor" /></div>
              </td>
            </tr>
            <tr v-if="expanded === row.recipe.id" class="cp-detail-row">
              <td colspan="7">
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

      <div v-if="profRows.length" class="cp-foot cp-muted">
        <span v-if="lastRefresh">价格更新于 {{ formatClock(lastRefresh) }}（本地缓存 5 分钟）</span>
        <span>交易行价格取 JX3Box 最近一条小时记录的最低单价；超过 6 小时没人上传的价格标灰，仅供参考。</span>
      </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useTracker } from '../../composables/useTracker'
import type { CraftPriceSource, CraftSettings } from '../../types'
import CraftMoney from './craft/CraftMoney.vue'
import { ageText, isStale } from './craft/priceAge'
import {
  AUCTION_FEE_PERCENT,
  ITEMS,
  PROFESSIONS,
  RECIPES,
  RECIPE_MAP,
  collectPriceIds,
  isCurrentRecipe,
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
/** 当前 Tab 的全部配方：当前版本（梓匠无资料片标记，全部）；收藏页签不限版本 */
const recipesOfProf = computed(() =>
  isFavTab.value
    ? favoriteIds.value.map((id) => RECIPE_MAP.get(id)!)
    : RECIPES.filter((r) => r.prof === activeProf.value && isCurrentRecipe(r))
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

async function loadPrices(force = false) {
  const api = window.electronAPI
  if (!api) {
    priceError.value = '仅桌面端可查询交易行价格'
    return
  }
  const ids = collectPriceIds(recipesOfProf.value.map((r) => r.id))
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

type SortKey = 'vigor' | 'cost' | 'unitCost' | 'revenue' | 'profit' | 'perVigor'
const SORT_COLS: Array<{ key: SortKey; label: string }> = [
  { key: 'vigor', label: '精力' },
  { key: 'cost', label: '成本' },
  { key: 'unitCost', label: '单件成本' },
  { key: 'revenue', label: '综合收益' },
  { key: 'profit', label: '综合利润' },
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
  // 切到哪个技艺 Tab 才查哪个 Tab 的价格
  () => activeProf.value,
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
  width: 16px;
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
</style>
