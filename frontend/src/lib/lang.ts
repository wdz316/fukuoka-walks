import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Lang = 'zh' | 'ja'

type Dict = Record<string, string>
type Params = Record<string, string | number>

const zh: Dict = {
  // Navigation / layout
  'nav.home': '首页',
  'nav.plan': '旅行计划',
  'nav.history': '历史',

  // Common
  'common.loading': '加载中...',
  'common.backToHistory': '返回历史',
  'error.fetchHistory': '获取历史记录失败',
  'error.fetchDestination': '获取旅行目的地失败',
  'error.notFoundDestination': '未找到旅行目的地',
  'error.deleteFailed': '删除失败',
  'error.processFailed': '处理失败',

  // Countdown
  'countdown.departure': '出发日就是今天！',
  'countdown.days': '天',
  'countdown.hours': '小时',
  'countdown.minutes': '分',
  'countdown.seconds': '秒',

  // Dashboard
  'dash.title': '首页',
  'dash.nextTrip': '距离下一次旅行「{title}」还有',
  'dash.viewPlan': '查看计划',
  'dash.noUpcoming': '暂无计划中的旅行。',
  'dash.ctaRecommend': '不知道去哪里 → 推荐',
  'dash.recentHistory': '最近的历史',
  'dash.noHistory': '还没有历史记录。',
  'dash.view': '查看',
  'dash.totalHistory': '共 {n} 条历史记录（已完成 {m} 条）',

  // History
  'history.title': '历史',
  'history.newPlan': '新建计划',
  'history.empty': '还没有历史记录，去创建计划吧。',
  'history.detail': '详情',
  'history.mdExport': 'MD导出',
  'history.icsExport': 'ICS导出',
  'history.deleting': '删除中...',
  'history.delete': '删除',
  'history.replan': '重新计划',
  'history.confirmDelete': '确定删除这个计划吗？',

  // Destination detail
  'dest.recommendedSeason': '推荐季节：{season}',
  'dest.createPlan': '使用此目的地创建计划',

  // Recommend — headings & fields
  'plan.title': '旅行计划',
  'plan.searchByConditions': '按条件搜索',
  'plan.normalSearch': '普通搜索',
  'plan.sameCityPlan': '同城计划',
  'plan.origin': '出发地',
  'plan.destination': '目的地',
  'plan.startDate': '出发日',
  'plan.endDate': '结束日',
  'plan.sameCityMode': '出发地=目的地：{origin} ⇔ {destination}（同城模式）',
  'plan.sameCityHint': '在出发地和目的地输入相同城市即可进行同城搜索。',
  'plan.howToSpend': '度过方式',
  'plan.preferences': '偏好',
  'plan.stayDuration': '停留时间',
  'plan.searching': '搜索中...',
  'plan.searchSameCity': '搜索同城计划',
  'plan.tripScope': '行程范围',
  'plan.freeTravel': '自由行（无跟团）',
  'plan.popularDestinations': '热门目的地',
  'plan.holidayType': '假期类型',
  'plan.budget': '预算（当地货币）',
  'plan.interests': '兴趣（逗号分隔）',
  'plan.region': '地区',
  'plan.nearbyTheme': '按周边/主题选择',
  'plan.nearbyPrefix': '周边:',
  'plan.getRecommendations': '获取推荐',
  'plan.specifyDestination': '指定目的地',
  'plan.createWithDestination': '使用此目的地创建计划',
  'plan.processing': '处理中...',
  'plan.recommendedDestinations': '推荐旅行目的地',
  'plan.fitScore': '适合度 {score}%',
  'plan.recommendReason': '推荐理由',
  'plan.schedule': '计划：{start} 〜 {end}（共{days}天）',
  'plan.budgetEstimate': '参考预算：约 ¥{amount}',
  'plan.modelRoute': '示例路线（按时间段）',
  'plan.dayX': '第{day}天',
  'plan.commonSchedule': '通用日程',
  'plan.transport': '交通：{transport}',
  'plan.book': '预订',
  'plan.ifTimeVisit': '有时间可以去',
  'plan.sights': '观光景点',
  'plan.hotels': '酒店',
  'plan.officialSite': '官网',
  'plan.saved': '已保存',
  'plan.saving': '保存中...',
  'plan.savePlan': '保存计划',
  'plan.exportMarkdown': '导出Markdown',
  'plan.exportIcs': '导出ICS（日历）',
  'plan.selectDestination': '请选择旅行目的地',
  'plan.regionUnlimited': '・取消地区限定',
  'plan.fixedCityMode': '本次只做{city}市内游',

  // Recommend — 足迹 (check-in / visited)
  'visit.trailMap': '足迹地图',
  'visit.completeCheckin': '完成打卡',
  'visit.completing': '打卡中...',
  'visit.completedMsg': '已为 {n} 个地点完成打卡',
  'visit.completeFail': '打卡失败，请稍后重试',
  'visit.completed': '已完成打卡',
  'visit.checkinHint': '点击后，将当前路线的所有地点标记为已去过。',
  'visit.saveFirst': '请先保存计划后再打卡。',
  'visit.visited': '去过',
  'visit.notVisited': '未去',
  'visit.removeFromRoute': '移出路线',
  'visit.addToRouteBtn': '加入路线',
  'visit.customPlaces': '自定地点',
  'visit.customStop': '自定',
  'visit.addCustomPlace': '+ 自定地点',
  'visit.placeName': '地点名',
  'visit.note': '备注',
  'visit.addToRoute': '加入路线',
  'visit.customAdded': '已将「{name}」加入路线',
  'visit.emptyCustom': '请输入地点名。',
  'visit.routeExcluded': '路线除外',
  'plan.visitFilter': '去过的地方',
  'plan.visitAny': '都可以',
  'plan.visitNewOnly': '只去新的',
  'plan.mapHint': '点标记看详情，进出路线点弹窗里按钮，拖动可调位置',
  'plan.mapEmptyHint': '搜索后，所选目的地的地图和路线显示在这里',
  'plan.walkMode': '徒步',
  'plan.transitMode': '电车巴士',
  'plan.minutes': '{n}分钟',
  'plan.nextStop': '下一站：{to}（{detail}）',
  'plan.arriveBy': '从{from}来（{detail}）',
  'plan.lastStop': '终点',

  // Recommend — messages
  'plan.msgNoMatch': '未找到符合「{summary}」的旅行目的地。',
  'plan.pinnedPrefix': '指定目的地：',
  'plan.msgFound': '为「{summary}」找到了 {n} 条推荐。',
  'plan.failRecommend': '推荐失败',
  'plan.msgSelectStartDate': '请选择出发日期。',
  'plan.sameCitySummary': '{origin} 的同城计划',
  'plan.recommend3plus': '建议3天以上',
  'plan.msgEnterDestination': '请输入目的地。',
  'plan.msgDestinationNotFound': '未找到指定的旅行目的地「{query}」，请检查输入。',
  'plan.specifiedDestination': '这是指定的旅行目的地',
  'plan.msgDirectWithDefault':
    '正在显示「{name}」的详情。由于未指定出发日期，暂定为下周六（{start}，一日游）。',
  'plan.msgDirect': '正在显示「{name}」的详情。',
  'plan.tripTitle': '{name} 旅行计划',
  'plan.msgSaved': '已保存计划，可在历史记录中查看。',
  'plan.failSave': '保存失败',
  'plan.bestSeason': '最佳季节：{season}',

  // Options — holiday types
  'holiday.weekend': '周末',
  'holiday.threeDay': '三连休',
  'holiday.obon': '盂兰盆节',
  'holiday.goldenWeek': '黄金周',
  'holiday.custom': '不指定',

  // Options — trip scope
  'scope.near': '近郊',
  'scope.far': '长途',
  'scope.nearHint': '一日游~2天・以东亚为主',
  'scope.farHint': '3天以上・不限制地区',

  // Options — themes
  'theme.food': '美食',
  'theme.nature': '自然',
  'theme.culture': '文化',
  'theme.shopping': '购物',

  // Options — walk type
  'walk.city': '市内漫步',
  'walk.suburban': '近郊一日游',
  'walk.stay': '住宿小住',

  // Options — same-city preferences
  'pref.food': '美食',
  'pref.nature': '自然',
  'pref.culture': '文化',
  'pref.family': '亲子',
  'pref.shopping': '购物',

  // Options — stay length
  'stay.half': '半天',
  'stay.one': '1天',
  'stay.two': '2天',
}

const ja: Dict = {
  // Navigation / layout
  'nav.home': 'ホーム',
  'nav.plan': '旅行計画',
  'nav.history': '履歴',

  // Common
  'common.loading': '読み込み中...',
  'common.backToHistory': '履歴に戻る',
  'error.fetchHistory': '履歴の取得に失敗しました',
  'error.fetchDestination': '旅行先の取得に失敗しました',
  'error.notFoundDestination': '旅行先が見つかりませんでした',
  'error.deleteFailed': '削除に失敗しました',
  'error.processFailed': '処理に失敗しました',

  // Countdown
  'countdown.departure': '出発日です！',
  'countdown.days': '日',
  'countdown.hours': '時間',
  'countdown.minutes': '分',
  'countdown.seconds': '秒',

  // Dashboard
  'dash.title': 'ホーム',
  'dash.nextTrip': '次の旅行「{title}」まで',
  'dash.viewPlan': 'プランを確認',
  'dash.noUpcoming': '予定している旅行はありません。',
  'dash.ctaRecommend': 'どこへ行きたいか分からない → レコメンド',
  'dash.recentHistory': '最近の履歴',
  'dash.noHistory': 'まだ履歴がありません。',
  'dash.view': '表示',
  'dash.totalHistory': '合計 {n} 件の履歴（完了 {m} 件）',

  // History
  'history.title': '履歴',
  'history.newPlan': '新しいプランを作成',
  'history.empty': '履歴はまだありません。プランを作成しましょう。',
  'history.detail': '詳細',
  'history.mdExport': 'MD出力',
  'history.icsExport': 'ICS出力',
  'history.deleting': '削除中...',
  'history.delete': '削除',
  'history.replan': '再プラン',
  'history.confirmDelete': 'このプランを削除しますか？',

  // Destination detail
  'dest.recommendedSeason': 'おすすめシーズン：{season}',
  'dest.createPlan': 'この旅行先でプランを作成',

  // Recommend — headings & fields
  'plan.title': '旅行計画',
  'plan.searchByConditions': '旅行条件から探す',
  'plan.normalSearch': '通常検索',
  'plan.sameCityPlan': '同都市プラン',
  'plan.origin': '出発地',
  'plan.destination': '目的地',
  'plan.startDate': '出発日',
  'plan.endDate': '終了日',
  'plan.sameCityMode': '出発地＝目的地：{origin} ⇔ {destination}（同都市モード）',
  'plan.sameCityHint': '出発地と目的地に同じ都市を入力すると同都市検索になります。',
  'plan.howToSpend': '過ごし方',
  'plan.preferences': '好み',
  'plan.stayDuration': '滞在時間',
  'plan.searching': '検索中...',
  'plan.searchSameCity': '同都市プランを探す',
  'plan.tripScope': '行程範囲',
    'plan.freeTravel': 'フリープラン（ツアーなし）',
  'plan.popularDestinations': '人気目的地',
  'plan.holidayType': '休暇の種類',
  'plan.budget': '予算（現地通貨）',
  'plan.interests': '興味（カンマ区切り）',
  'plan.region': '地域',
  'plan.nearbyTheme': '周辺・テーマから選ぶ',
  'plan.nearbyPrefix': '周辺:',
  'plan.getRecommendations': 'レコメンド取得',
  'plan.specifyDestination': '目的地を指定',
  'plan.createWithDestination': 'この目的地でプランを作成',
  'plan.processing': '処理中...',
  'plan.recommendedDestinations': 'おすすめの旅行先',
  'plan.fitScore': '適合 {score}%',
  'plan.recommendReason': 'レコメンド理由',
  'plan.schedule': '予定：{start} 〜 {end}（{days}日間）',
  'plan.budgetEstimate': '予算目安：約 ¥{amount}',
  'plan.modelRoute': 'モデルルート（時間帯別）',
  'plan.dayX': '{day}日目',
  'plan.commonSchedule': '日程共通',
  'plan.transport': '移動：{transport}',
  'plan.book': '予約',
  'plan.ifTimeVisit': '時間があれば寄りたい',
  'plan.sights': '観光スポット',
  'plan.hotels': 'ホテル',
  'plan.officialSite': '公式サイト',
  'plan.saved': '保存済み',
  'plan.saving': '保存中...',
  'plan.savePlan': 'プランを保存',
  'plan.exportMarkdown': 'マークダウンで出力',
  'plan.exportIcs': 'ICS（カレンダー）で出力',
  'plan.selectDestination': '旅行先を選択してください',
  'plan.regionUnlimited': '・地域の絞り込みを外します',
  'plan.fixedCityMode': '今回は{city}市内観光のみ',

  // Recommend — フットプリント (チェックイン)
  'visit.trailMap': 'フットプリントマップ',
  'visit.completeCheckin': 'チェックイン完了',
  'visit.completing': 'チェックイン中...',
  'visit.completedMsg': '{n} 件のスポットをチェックインしました',
  'visit.completeFail': 'チェックインに失敗しました。後で再試行してください',
  'visit.completed': 'チェックイン済み',
  'visit.checkinHint': 'クリックすると、現在のルートの全スポットを「行った」にします。',
  'visit.saveFirst': '先にプランを保存してからチェックインしてください。',
  'visit.visited': '行った',
  'visit.notVisited': '未訪問',
  'visit.removeFromRoute': 'ルートから外す',
  'visit.addToRouteBtn': 'ルートに入れる',
  'visit.customPlaces': 'カスタム地点',
  'visit.customStop': 'カスタム',
  'visit.addCustomPlace': '+ カスタム地点',
  'visit.placeName': 'スポット名',
  'visit.note': 'メモ',
  'visit.addToRoute': 'ルートに追加',
  'visit.customAdded': '「{name}」をルートに追加しました',
  'visit.emptyCustom': 'スポット名を入力してください。',
  'visit.routeExcluded': 'ルート除外',
  'plan.visitFilter': '行った場所',
  'plan.visitAny': 'どちらも',
  'plan.visitNewOnly': '新規のみ',
  'plan.mapHint': 'マーカーをタップで詳細、ルート出入りはポップアップのボタン、ドラッグで位置調整',
  'plan.mapEmptyHint': '検索後、選んだ目的地の地図とルートがここに表示されます',
  'plan.walkMode': '徒歩',
  'plan.transitMode': '電車・バス',
  'plan.minutes': '{n}分',
  'plan.nextStop': '次：{to}（{detail}）',
  'plan.arriveBy': '{from}から（{detail}）',
  'plan.lastStop': '終点',

  // Recommend — messages
  'plan.msgNoMatch': '「{summary}」に合う旅行先が見つかりませんでした。',
  'plan.pinnedPrefix': '指定の目的地：',
  'plan.msgFound': '「{summary}」のおすすめが {n} 件見つかりました。',
  'plan.failRecommend': 'レコメンドに失敗しました',
  'plan.msgSelectStartDate': '出発日を選択してください。',
  'plan.sameCitySummary': '{origin} の同都市プラン',
  'plan.recommend3plus': '3日以上推奨',
  'plan.msgEnterDestination': '目的地を入力してください。',
  'plan.msgDestinationNotFound':
    '指定した旅行先「{query}」が見つかりませんでした。表記を確認してください。',
  'plan.specifiedDestination': '指定した旅行先です',
  'plan.msgDirectWithDefault':
    '「{name}」の詳細を表示しています。出発日が未指定のため、次の土曜（{start}、日帰り）を仮定しました。',
  'plan.msgDirect': '「{name}」の詳細を表示しています。',
  'plan.tripTitle': '{name} 旅行計画',
  'plan.msgSaved': 'プランを保存しました。履歴から確認できます。',
  'plan.failSave': '保存に失敗しました',
  'plan.bestSeason': 'ベストシーズン：{season}',

  // Options — holiday types
  'holiday.weekend': '週末',
  'holiday.threeDay': '三連休',
  'holiday.obon': 'お盆',
  'holiday.goldenWeek': 'ゴールデンウィーク',
  'holiday.custom': '指定なし',

  // Options — trip scope
  'scope.near': '近郊',
    'scope.far': '長距離',
  'scope.nearHint': '日帰り〜2日・東アジア中心',
  'scope.farHint': '3日以上・地域を問わず',

  // Options — themes
  'theme.food': '美食',
  'theme.nature': '自然',
  'theme.culture': '文化',
    'theme.shopping': 'ショッピング',

  // Options — walk type
  'walk.city': '市内散策',
  'walk.suburban': '近郊日帰り',
  'walk.stay': '宿泊ステイ',

  // Options — same-city preferences
  'pref.food': 'グルメ',
  'pref.nature': '自然',
  'pref.culture': '文化',
  'pref.family': '親子',
  'pref.shopping': 'ショッピング',

  // Options — stay length
  'stay.half': '半日',
  'stay.one': '1日',
  'stay.two': '2日',
}

export const dicts: Record<Lang, Dict> = { zh, ja }

export function translate(
  lang: Lang,
  key: string,
  params?: Params,
): string {
  const template = dicts[lang][key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    String(params[k] ?? ''),
  )
}

export function dictKeys(dict: Dict): string[] {
  return Object.keys(dict).sort()
}

const STORAGE_KEY = 'lang'

interface LangContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string, params?: Params) => string
}

const LangContext = createContext<LangContextValue | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'ja' ? 'ja' : 'zh'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  const t = useCallback(
    (key: string, params?: Params) => translate(lang, key, params),
    [lang],
  )

  const value = useMemo(
    () => ({ lang, setLang, t }),
    [lang, setLang, t],
  )

  return createElement(
    LangContext.Provider,
    { value },
    children,
  )
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within a LangProvider')
  return ctx
}
