const DICT = {
  en: {
    nav_app: 'Open editor', nav_pricing: 'Pricing',
    hero_title: 'Screen recordings that zoom themselves.',
    hero_sub: 'Record any screen, window or tab right in your browser. AutoZoom finds where the action is, glides the camera there, and frames it on a beautiful background. No install, works on Windows, Linux, ChromeOS and Mac.',
    hero_cta: 'Start recording — free', hero_cta2: 'See pricing',
    f1_t: 'Automatic smooth zoom', f1_d: 'Motion detection finds activity and adds eased zoom-ins. Fine-tune every keyframe on the timeline.',
    f2_t: 'Studio framing', f2_d: 'Gradient or solid backgrounds, padding, rounded corners and soft shadows in one click.',
    f3_t: '100% in your browser', f3_d: 'Nothing is uploaded. Export WebM or MP4 directly from the page.',
    pr_title: 'Pricing', pr_free: 'Free', pr_pro: 'Pro', pr_mo: '/month',
    pr_free_1: 'Unlimited recordings', pr_free_2: 'Auto-zoom & editor', pr_free_3: '720p export', pr_free_4: 'Small watermark',
    pr_pro_1: 'Everything in Free', pr_pro_2: '1080p & 4K export', pr_pro_3: 'No watermark', pr_pro_4: 'Custom background images',
    pr_get: 'Get Pro', pr_start: 'Start free', pr_have: 'I have a license key',
    rec: 'Record screen', stop: 'Stop', open: 'Open video file', mic: 'Microphone', sysaudio: 'Tab/system audio',
    empty: 'Record your screen or open a video to start editing.',
    auto: 'Auto-zoom', analyzing: 'Analyzing…', add_zoom: 'Add zoom at playhead', clear: 'Clear zooms',
    tl_hint: 'Double-click the track to add a zoom · drag to move · drag edges to resize · click the preview to set the focus point',
    seg: 'Selected zoom', zoom: 'Zoom', del: 'Delete', none_sel: 'Select a zoom segment on the timeline.',
    style: 'Style', bg: 'Background', solid: 'Solid', custom: 'Custom image', padding: 'Padding', radius: 'Corners', shadow: 'Shadow',
    export: 'Export', res: 'Resolution', format: 'Format', exporting: 'Exporting… keep this tab visible', export_btn: 'Export video', cancel: 'Cancel',
    lic_title: 'Activate Pro', lic_ph: 'License key', lic_act: 'Activate', lic_bad: 'That key is not valid.', lic_ok: 'Pro activated — thank you!', lic_out: 'Remove key', close: 'Close',
    pro_only: 'Pro feature', pro_badge: 'PRO', footer: 'Your recordings never leave your device.',
  },
  zh: {
    nav_app: '打开编辑器', nav_pricing: '价格',
    hero_title: '会自己放大的录屏。',
    hero_sub: '直接在浏览器里录制屏幕、窗口或标签页。AutoZoom 自动找到操作区域，平滑推近镜头，并放在精美背景上。无需安装，Windows、Linux、ChromeOS、Mac 都能用。',
    hero_cta: '免费开始录制', hero_cta2: '查看价格',
    f1_t: '自动平滑缩放', f1_d: '运动检测识别操作区域并加入缓动放大，可在时间轴上精细调整每个关键帧。',
    f2_t: '一键精美构图', f2_d: '渐变或纯色背景、边距、圆角和柔和阴影。',
    f3_t: '完全在浏览器内', f3_d: '不上传任何内容，直接导出 WebM 或 MP4。',
    pr_title: '价格', pr_free: '免费版', pr_pro: '专业版', pr_mo: '/月',
    pr_free_1: '无限录制', pr_free_2: '自动缩放与编辑器', pr_free_3: '720p 导出', pr_free_4: '小水印',
    pr_pro_1: '包含免费版全部功能', pr_pro_2: '1080p 与 4K 导出', pr_pro_3: '无水印', pr_pro_4: '自定义背景图片',
    pr_get: '获取专业版', pr_start: '免费开始', pr_have: '我有许可证密钥',
    rec: '录制屏幕', stop: '停止', open: '打开视频文件', mic: '麦克风', sysaudio: '标签页/系统声音',
    empty: '录制屏幕或打开一个视频开始编辑。',
    auto: '自动缩放', analyzing: '分析中…', add_zoom: '在播放头处添加缩放', clear: '清除缩放',
    tl_hint: '双击轨道添加缩放 · 拖动移动 · 拖动边缘调整长度 · 点击预览设置焦点',
    seg: '选中的缩放', zoom: '缩放', del: '删除', none_sel: '在时间轴上选择一个缩放片段。',
    style: '样式', bg: '背景', solid: '纯色', custom: '自定义图片', padding: '边距', radius: '圆角', shadow: '阴影',
    export: '导出', res: '分辨率', format: '格式', exporting: '导出中…请保持此标签页可见', export_btn: '导出视频', cancel: '取消',
    lic_title: '激活专业版', lic_ph: '许可证密钥', lic_act: '激活', lic_bad: '密钥无效。', lic_ok: '专业版已激活，感谢支持！', lic_out: '移除密钥', close: '关闭',
    pro_only: '专业版功能', pro_badge: 'PRO', footer: '你的录像始终留在你的设备上。',
  },
};
let lang = localStorage.getItem('az.lang') || (navigator.language?.startsWith('zh') ? 'zh' : 'en');
export const t = k => DICT[lang][k] ?? DICT.en[k] ?? k;
export const getLang = () => lang;
export function applyI18n(root = document) {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  root.querySelectorAll('[data-i18n]').forEach(el => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-ph]').forEach(el => (el.placeholder = t(el.dataset.i18nPh)));
}
export function setLang(l) { lang = l; localStorage.setItem('az.lang', l); applyI18n(); }
