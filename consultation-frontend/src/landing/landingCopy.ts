import type { Language } from '../i18n'

const zh = {
  navChat: '对话',
  navMap: '附近诊所',
  navProduct: '产品',
  signIn: '登录',
  start: '开始使用',
  skipToContent: '跳到主要内容',
  heroTitleA: '把身体的不适说清楚，',
  heroTitleB: '再找到附近的诊所。',
  heroBody:
    'Medora 是 AI 健康助手。它帮你梳理症状、判断轻重和下一步，再在地图上找到附近可以联系的诊所。',
  heroPrimary: '开始一次对话',
  heroSecondary: '看看怎么用',
  previewLabel: '界面演示',

  chatTitle: '先把情况说出来，剩下的一起理清。',
  chatBody: 'Medora 会追问关键细节，再把建议整理成你能马上照着做的几步。',
  demoNote: '演示对话，不是真实用户数据。',
  steps: [
    { title: '描述症状', body: '用自己的话说就好，中文、英文都可以。' },
    { title: '补充关键细节', body: 'Medora 只问真正影响判断的问题，比如持续多久、有没有其他症状。' },
    { title: '得到下一步', body: '轻重程度、可以先做的事、什么情况要尽快就医，一目了然。' },
  ],
  demoUser1: '我发烧两天了，38.5 度，头也很痛。',
  demoAi1: '明白。想先确认两件事：有没有出疹子、或者牙龈出血？最近有没有被蚊子叮得比较多？',
  demoUser2: '没有出疹子，也没有出血。就是全身酸痛，没什么胃口。',
  demoAiLevel: '建议留意',
  demoAiSummary: '目前更像病毒性感冒引起的发烧和头痛，可以先在家休息观察。',
  demoAiDo: '现在可以先这样做',
  demoAiDoItems: ['多喝水、好好休息', '超过 38.5 度可按说明服用退烧药'],
  demoAiWatch: '出现以下情况请尽快就医',
  demoAiWatchItems: ['持续高烧超过 3 天', '出疹、牙龈或鼻子出血'],
  demoAiCta: '查看附近诊所',

  mapTitle: '下一步，就在附近。',
  mapBody: '列表和地图互相对应。选中一家诊所，地图上马上标出它的位置；电话和导航一点就到。',
  mapNote: '示例诊所和数据，仅作演示。',
  clinics: [
    { name: '示例诊所 A', address: '示例路 12 号', distance: '0.6 km', phone: '03-0000 0001' },
    { name: '示例诊所 B', address: '示例广场 3 楼', distance: '1.4 km', phone: '暂无资料' },
    { name: '示例药房 C', address: '示例街 88 号', distance: '2.1 km', phone: '03-0000 0003' },
  ],
  call: '拨打电话',
  navigate: '导航',

  closingTitle: '有点不舒服的时候，先问问 Medora。',
  closingCta: '登录开始使用',
  boundaries: [
    { icon: 'info', text: 'Medora 提供健康信息，不做诊断，也不开处方。' },
    { icon: 'alert', text: '紧急情况请立即拨打 999。' },
    { icon: 'history', text: '对话保存在你的账号，30 天没有新消息会自动删除。' },
  ],
  footer: '© 2026',
}

const en: typeof zh = {
  navChat: 'Chat',
  navMap: 'Nearby clinics',
  navProduct: 'Product',
  signIn: 'Sign in',
  start: 'Get started',
  skipToContent: 'Skip to content',
  heroTitleA: 'Talk through how you feel.',
  heroTitleB: 'Then find a clinic nearby.',
  heroBody:
    'Medora is an AI health assistant. It helps you sort out symptoms, how urgent they are, and what to do next, then finds clinics you can contact nearby.',
  heroPrimary: 'Start a conversation',
  heroSecondary: 'See how it works',
  previewLabel: 'Interface preview',

  chatTitle: 'Say what is going on. Medora helps you make sense of it.',
  chatBody: 'It asks for the details that matter, then turns the answer into a few steps you can follow right away.',
  demoNote: 'Demo conversation, not real user data.',
  steps: [
    { title: 'Describe your symptoms', body: 'Use your own words, in English or Chinese.' },
    { title: 'Add the key details', body: 'Medora only asks what changes the picture, like how long it has lasted.' },
    { title: 'Get your next step', body: 'How urgent it is, what to do now, and when to see a doctor soon.' },
  ],
  demoUser1: "I've had a 38.5°C fever for two days and a bad headache.",
  demoAi1: 'Got it. Two quick checks: any rash or bleeding gums? Have you had many mosquito bites lately?',
  demoUser2: 'No rash or bleeding. Just body aches and not much appetite.',
  demoAiLevel: 'Keep an eye on it',
  demoAiSummary: 'This looks more like a viral fever with headache. Resting at home and watching it is reasonable for now.',
  demoAiDo: 'What you can do for now',
  demoAiDoItems: ['Drink plenty of water and rest', 'Take fever medicine as directed if above 38.5°C'],
  demoAiWatch: 'Get medical care soon if you notice',
  demoAiWatchItems: ['High fever lasting over 3 days', 'Rash, or bleeding from gums or nose'],
  demoAiCta: 'View nearby clinics',

  mapTitle: 'Your next step is nearby.',
  mapBody: 'The list and the map stay in sync. Pick a clinic and the map shows exactly where it is, with call and directions one tap away.',
  mapNote: 'Sample clinics and data, for demonstration only.',
  clinics: [
    { name: 'Sample Clinic A', address: '12 Sample Road', distance: '0.6 km', phone: '03-0000 0001' },
    { name: 'Sample Clinic B', address: 'Level 3, Sample Plaza', distance: '1.4 km', phone: 'Not available' },
    { name: 'Sample Pharmacy C', address: '88 Sample Street', distance: '2.1 km', phone: '03-0000 0003' },
  ],
  call: 'Call',
  navigate: 'Directions',

  closingTitle: 'Not feeling right? Ask Medora first.',
  closingCta: 'Sign in to start',
  boundaries: [
    { icon: 'info', text: 'Medora gives health information. It does not diagnose or prescribe.' },
    { icon: 'alert', text: 'In an emergency, call 999 now.' },
    { icon: 'history', text: 'Chats are saved to your account and deleted after 30 days without new messages.' },
  ],
  footer: '© 2026',
}

const ms: typeof zh = {
  navChat: 'Perbualan',
  navMap: 'Klinik terdekat',
  navProduct: 'Produk',
  signIn: 'Log masuk',
  start: 'Mula sekarang',
  skipToContent: 'Langkau ke kandungan',
  heroTitleA: 'Luahkan ketidakselesaan anda dengan jelas,',
  heroTitleB: 'kemudian cari klinik berdekatan.',
  heroBody:
    'Medora ialah pembantu kesihatan AI. Ia membantu anda menyusun simptom, menilai tahap kecemasan dan langkah seterusnya, serta mencari klinik berdekatan yang boleh dihubungi pada peta.',
  heroPrimary: 'Mulakan perbualan',
  heroSecondary: 'Lihat cara ia berfungsi',
  previewLabel: 'Pratonton antara muka',

  chatTitle: 'Nyatakan apa yang berlaku, selebihnya kami selesaikan bersama.',
  chatBody: 'Medora akan bertanyakan butiran penting, kemudian menyusun cadangan menjadi langkah yang boleh anda ikuti dengan segera.',
  demoNote: 'Perbualan demo, bukan data pengguna sebenar.',
  steps: [
    { title: 'Huraikan simptom', body: 'Gunakan ayat anda sendiri, dalam Bahasa Melayu, Inggeris atau Cina.' },
    { title: 'Tambah butiran utama', body: 'Medora hanya bertanya perkara yang mempengaruhi pertimbangan, seperti berapa lama ia berlarutan.' },
    { title: 'Dapatkan langkah seterusnya', body: 'Tahap kecemasan, perkara yang boleh dilakukan sekarang, dan tanda bahaya untuk ke hospital.' },
  ],
  demoUser1: 'Saya demam dua hari, 38.5°C, kepala pun sakit sangat.',
  demoAi1: 'Faham. Ingin pastikan dua perkara: adakah timbul ruam atau pendarahan gusi? Ada banyak digigit nyamuk kebelakangan ini?',
  demoUser2: 'Tiada ruam atau pendarahan. Cuma badan sakit-sakit dan tiada selera makan.',
  demoAiLevel: 'Perlu diperhatikan',
  demoAiSummary: 'Kini kelihatan seperti demam jangkitan virus dan sakit kepala. Berehat di rumah dan pantau keadaan adalah wajar buat masa ini.',
  demoAiDo: 'Langkah yang boleh diambil sekarang',
  demoAiDoItems: ['Banyakkan minum air dan rehat secukupnya', 'Boleh ambil ubat demam mengikut arahan jika melebihi 38.5°C'],
  demoAiWatch: 'Dapatkan rawatan segera jika terdapat tanda berikut',
  demoAiWatchItems: ['Demam panas berlarutan lebih 3 hari', 'Ruam, atau pendarahan gusi atau hidung'],
  demoAiCta: 'Lihat klinik terdekat',

  mapTitle: 'Langkah seterusnya, tepat di kawasan anda.',
  mapBody: 'Senarai dan peta segerak sepenuhnya. Pilih klinik dan peta akan menunjukkan lokasinya serta-merta, dengan panggilan dan navigasi hanya satu ketukan.',
  mapNote: 'Contoh klinik dan data, untuk tujuan demonstrasi sahaja.',
  clinics: [
    { name: 'Klinik Contoh A', address: '12 Jalan Contoh', distance: '0.6 km', phone: '03-0000 0001' },
    { name: 'Klinik Contoh B', address: 'Tingkat 3, Plaza Contoh', distance: '1.4 km', phone: 'Tiada maklumat' },
    { name: 'Farmasi Contoh C', address: '88 Jalan Pasar', distance: '2.1 km', phone: '03-0000 0003' },
  ],
  call: 'Panggil',
  navigate: 'Navigasi',

  closingTitle: 'Berasa kurang sihat? Tanya Medora dahulu.',
  closingCta: 'Log masuk untuk mula',
  boundaries: [
    { icon: 'info', text: 'Medora menyediakan maklumat kesihatan umum, tidak memberi diagnosis atau preskripsi ubat.' },
    { icon: 'alert', text: 'Dalam situasi kecemasan, sila hubungi 999 sekarang.' },
    { icon: 'history', text: 'Perbualan disimpan dalam akaun anda dan dipadam selepas 30 hari tanpa mesej baharu.' },
  ],
  footer: '© 2026',
}

export const landingCopy = {
  zh,
  en,
  ms,
} as const satisfies Record<Language, unknown>
