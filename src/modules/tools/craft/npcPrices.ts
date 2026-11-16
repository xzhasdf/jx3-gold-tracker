// 技艺 NPC 商店材料售价，按物品名匹配（材料名在当前配方里没有重名）。
// 单位：铜（1 金 = 100 银 = 10000 铜）。数据来自游戏内商店截图，NPC 改价时在这里改。

const SILVER = 100
const GOLD = 10000

export const NPC_PRICES: Record<string, number> = {
  // 铸造
  火墨: 60 * SILVER,
  木炭: 60 * SILVER,
  煤炭: 60 * SILVER,
  菜籽油: 60 * SILVER,
  青铜钥匙模: 18 * SILVER,
  锡制钥匙模: 60 * SILVER,
  精铁钥匙模: 90 * SILVER,
  素银钥匙模: 6 * GOLD,
  鎏金钥匙模: 12 * GOLD,
  旦火油: 30 * GOLD,
  炼火石: 3 * GOLD,
  松脂: 10 * GOLD,
  熟矾: 20 * GOLD,

  // 医术
  药罐: 60 * SILVER,
  药囊: 60 * SILVER,
  葫芦: 60 * SILVER,
  金针: 60 * SILVER,
  银针: 60 * SILVER,
  药料: 60 * SILVER,
  药用黄丹: 1 * GOLD + 20 * SILVER,
  砭石: 30 * GOLD,
  竹沥: 10 * GOLD,
  药曲: 20 * GOLD,

  // 烹饪
  精制面粉: 60 * SILVER,
  料酒: 60 * SILVER,
  白糖: 60 * SILVER,
  调料: 60 * SILVER,
  生粉: 60 * SILVER,
  胡椒粉: 60 * SILVER,
  红辣椒: 60 * SILVER,
  藤椒: 10 * GOLD,
  酥油: 20 * GOLD,
  新鲜冬瓜: 60 * SILVER,
  菌菇: 60 * SILVER,
  老姜: 60 * SILVER,
  大葱: 60 * SILVER,
  莲藕: 60 * SILVER,
  小茴香: 60 * SILVER,
  青瓜: 60 * SILVER,
  粟米: 60 * SILVER,
  红萝卜: 60 * SILVER,
  蒜苗: 60 * SILVER,
  青菜: 60 * SILVER,
  老豆腐: 60 * SILVER,
  蛋: 60 * SILVER,

  // 缝纫
  棉线: 60 * SILVER,
  纺丝: 60 * SILVER,
  金线: 60 * SILVER,
  百花线: 60 * SILVER,
  石灰: 60 * SILVER,
  百股线: 30 * GOLD,
  百染线: 3 * GOLD,
  绢带: 10 * GOLD,
  黄蜡: 20 * GOLD,

  // 酒
  竹叶青: 12 * GOLD,
  郎官清: 12 * GOLD,
  西市腔: 12 * GOLD,
  富水: 12 * GOLD,
  黄酒: 60 * SILVER,
  秋露白: 60 * SILVER,
  干和: 60 * SILVER,
  土窟春: 60 * SILVER,
  新丰酒: 60 * SILVER,
  若下: 60 * SILVER,
  烧春: 60 * SILVER,
  今朝醉: 120 * GOLD,

  // 家具材料
  滑石粉: 30 * GOLD,
  清漆: 6 * GOLD,
  皮革: 6 * GOLD,
  密陀油: 6 * GOLD,
  麻絮: 15 * GOLD,
  石材: 60 * SILVER,
  黏土: 60 * SILVER,
  绳索: 60 * SILVER,
  油布: 60 * SILVER,
  楔子: 60 * SILVER,
  青砖: 60 * SILVER
}
