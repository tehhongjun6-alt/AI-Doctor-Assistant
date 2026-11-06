import type { GuideTopic } from './guideTypes'

// 内容由 AI 根据权威来源用自己的话起草，需要用户逐张审核后才算定稿。
// 不写药物剂量，不做诊断性的说法。
const DRAFTED = '2026-11-06'

const NHS = 'NHS'

export const GUIDE_TOPICS: GuideTopic[] = [
  // ---------------- 传染病 ----------------
  {
    id: 'dengue',
    category: 'infection',
    title: { zh: '骨痛热症', en: 'Dengue', ms: 'Denggi' },
    summary: {
      zh: '由伊蚊传播的病毒感染，马来西亚全年都有，雨季更常见。',
      en: 'A viral infection spread by Aedes mosquitoes. It occurs all year in Malaysia, more so in the rainy season.',
      ms: 'Jangkitan virus yang disebarkan oleh nyamuk Aedes. Berlaku sepanjang tahun di Malaysia, lebih kerap pada musim hujan.',
    },
    symptoms: {
      zh: ['突然发高烧', '剧烈头痛、眼睛后面痛', '肌肉和关节痛', '恶心、呕吐', '身上出现红疹'],
      en: ['Sudden high fever', 'Severe headache and pain behind the eyes', 'Muscle and joint pain', 'Nausea or vomiting', 'Skin rash'],
      ms: ['Demam tinggi secara tiba-tiba', 'Sakit kepala teruk dan sakit di belakang mata', 'Sakit otot dan sendi', 'Loya atau muntah', 'Ruam pada kulit'],
    },
    care: {
      zh: ['多休息、多喝水', '退烧止痛用 paracetamol', '不要吃布洛芬（ibuprofen）或阿司匹林（aspirin）', '清除家里积水，防止蚊子繁殖', '穿长袖、用防蚊液'],
      en: ['Rest and drink plenty of fluids', 'Use paracetamol for fever and pain', 'Do not take ibuprofen or aspirin', 'Remove standing water to stop mosquitoes breeding', 'Wear long sleeves and use insect repellent'],
      ms: ['Rehat dan minum banyak air', 'Guna paracetamol untuk demam dan sakit', 'Jangan ambil ibuprofen atau aspirin', 'Buang air bertakung supaya nyamuk tidak membiak', 'Pakai baju lengan panjang dan guna penghalau serangga'],
    },
    seeDoctor: {
      zh: ['退烧后反而更不舒服', '肚子剧痛、一直呕吐', '牙龈或鼻子流血、吐血或黑便', '很累、烦躁或呼吸急促'],
      en: ['Feeling worse after the fever goes down', 'Severe stomach pain or vomiting that will not stop', 'Bleeding gums or nose, vomiting blood or black stools', 'Extreme tiredness, restlessness or fast breathing'],
      ms: ['Rasa lebih teruk selepas demam surut', 'Sakit perut teruk atau muntah berterusan', 'Gusi atau hidung berdarah, muntah darah atau najis hitam', 'Sangat letih, gelisah atau bernafas laju'],
    },
    askPrompt: {
      zh: '我想了解骨痛热症的危险信号，以及什么时候要去医院？',
      en: 'What are the warning signs of dengue, and when should I go to the hospital?',
      ms: 'Apakah tanda bahaya denggi, dan bilakah saya perlu ke hospital?',
    },
    sources: [{ name: 'WHO', url: 'https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue' }],
    reviewedAt: DRAFTED,
  },
  {
    id: 'influenza',
    category: 'infection',
    title: { zh: '流感', en: 'Influenza', ms: 'Influenza' },
    summary: {
      zh: '流感病毒引起的呼吸道感染，比感冒来得快、更难受。',
      en: 'A respiratory infection caused by the flu virus. It comes on faster and feels worse than a cold.',
      ms: 'Jangkitan saluran pernafasan oleh virus selesema. Ia datang lebih cepat dan lebih teruk daripada selsema biasa.',
    },
    symptoms: {
      zh: ['突然发烧', '全身酸痛', '很累、没力气', '干咳、喉咙痛', '头痛'],
      en: ['Sudden fever', 'Aching body', 'Feeling exhausted', 'Dry cough or sore throat', 'Headache'],
      ms: ['Demam secara tiba-tiba', 'Badan sakit-sakit', 'Rasa sangat letih', 'Batuk kering atau sakit tekak', 'Sakit kepala'],
    },
    care: {
      zh: ['在家休息，保暖', '多喝水', '需要时用 paracetamol 退烧', '咳嗽时遮住口鼻、勤洗手', '可以考虑每年打流感疫苗'],
      en: ['Rest at home and keep warm', 'Drink plenty of fluids', 'Use paracetamol for fever if needed', 'Cover coughs and wash hands often', 'Consider a yearly flu vaccine'],
      ms: ['Rehat di rumah dan pastikan badan hangat', 'Minum banyak air', 'Guna paracetamol untuk demam jika perlu', 'Tutup mulut ketika batuk dan kerap basuh tangan', 'Pertimbangkan suntikan vaksin influenza setiap tahun'],
    },
    seeDoctor: {
      zh: ['呼吸困难或胸痛', '一周后还没好转，或越来越严重', '老人、孕妇、小孩或有慢性病的人'],
      en: ['Difficulty breathing or chest pain', 'No better after a week, or getting worse', 'You are older, pregnant, a young child or have a long-term condition'],
      ms: ['Sukar bernafas atau sakit dada', 'Tidak pulih selepas seminggu atau semakin teruk', 'Warga emas, hamil, kanak-kanak kecil atau ada penyakit kronik'],
    },
    askPrompt: {
      zh: '流感和普通感冒有什么不同？什么情况要去看医生？',
      en: 'How is flu different from a common cold, and when should I see a doctor?',
      ms: 'Apakah beza influenza dengan selsema biasa, dan bilakah saya perlu jumpa doktor?',
    },
    sources: [{ name: NHS, url: 'https://www.nhs.uk/conditions/flu/' }],
    reviewedAt: DRAFTED,
  },
  {
    id: 'covid19',
    category: 'infection',
    title: { zh: '新冠', en: 'COVID-19', ms: 'COVID-19' },
    summary: {
      zh: '新冠病毒引起的呼吸道感染，多数人症状轻，少数会变严重。',
      en: 'A respiratory infection caused by the coronavirus. Most people have mild symptoms, but some become seriously ill.',
      ms: 'Jangkitan saluran pernafasan oleh virus korona. Kebanyakan orang bergejala ringan, tetapi sesetengahnya menjadi teruk.',
    },
    symptoms: {
      zh: ['发烧或发冷', '咳嗽、喉咙痛', '很累、全身酸痛', '失去嗅觉或味觉', '流鼻水或鼻塞'],
      en: ['Fever or chills', 'Cough or sore throat', 'Tiredness or aching body', 'Loss of smell or taste', 'Runny or blocked nose'],
      ms: ['Demam atau menggigil', 'Batuk atau sakit tekak', 'Letih atau badan sakit-sakit', 'Hilang deria bau atau rasa', 'Hidung berair atau tersumbat'],
    },
    care: {
      zh: ['在家休息，多喝水', '尽量避免接触别人', '和人接触时戴口罩', '勤洗手、保持通风', '按建议接种疫苗'],
      en: ['Rest at home and drink fluids', 'Avoid contact with other people where possible', 'Wear a mask around others', 'Wash hands often and keep rooms ventilated', 'Get vaccinated as recommended'],
      ms: ['Rehat di rumah dan minum air', 'Elakkan bersentuhan dengan orang lain jika boleh', 'Pakai pelitup muka apabila bersama orang lain', 'Kerap basuh tangan dan pastikan bilik berudara', 'Ambil vaksin seperti yang disyorkan'],
    },
    seeDoctor: {
      zh: ['呼吸困难或喘不过气', '胸口持续疼痛或有压迫感', '嘴唇或脸色发青', '意识混乱或很难叫醒'],
      en: ['Difficulty breathing or breathlessness', 'Ongoing chest pain or pressure', 'Lips or face turning blue', 'Confusion or very hard to wake'],
      ms: ['Sukar bernafas atau sesak nafas', 'Sakit atau rasa tertekan di dada yang berterusan', 'Bibir atau muka menjadi biru', 'Keliru atau sangat sukar dikejutkan'],
    },
    askPrompt: {
      zh: '确诊新冠后在家要怎么照顾自己？哪些情况要马上去医院？',
      en: 'How should I look after myself at home with COVID-19, and when should I go to the hospital?',
      ms: 'Bagaimana saya menjaga diri di rumah semasa COVID-19, dan bilakah saya perlu ke hospital?',
    },
    sources: [{ name: NHS, url: 'https://www.nhs.uk/conditions/covid-19/' }],
    reviewedAt: DRAFTED,
  },
  {
    id: 'hfmd',
    category: 'infection',
    title: { zh: '手足口病', en: 'Hand, Foot and Mouth Disease', ms: 'Penyakit Tangan, Kaki dan Mulut' },
    summary: {
      zh: '常见于小孩的病毒感染，嘴里长溃疡，手脚出现小疹子。',
      en: 'A common viral infection in young children, causing mouth ulcers and spots on the hands and feet.',
      ms: 'Jangkitan virus yang biasa dalam kalangan kanak-kanak, menyebabkan ulser mulut dan bintik pada tangan dan kaki.',
    },
    symptoms: {
      zh: ['发烧', '喉咙痛、不想吃东西', '嘴里有痛的溃疡', '手掌、脚底出现小疹子或水泡'],
      en: ['Fever', 'Sore throat and not wanting to eat', 'Painful mouth ulcers', 'Spots or blisters on the palms and soles'],
      ms: ['Demam', 'Sakit tekak dan tidak mahu makan', 'Ulser mulut yang sakit', 'Bintik atau lepuh pada tapak tangan dan tapak kaki'],
    },
    care: {
      zh: ['多喝凉开水，避免酸的饮料', '吃软的食物，例如粥', '需要时用 paracetamol 退烧止痛', '勤洗手，不要共用餐具毛巾', '生病期间不要去学校或托儿所'],
      en: ['Give cool drinks and avoid acidic drinks', 'Offer soft foods such as porridge', 'Use paracetamol for fever or pain if needed', 'Wash hands often; do not share cups or towels', 'Keep children home from school or nursery while unwell'],
      ms: ['Beri minuman sejuk dan elakkan minuman masam', 'Beri makanan lembut seperti bubur', 'Guna paracetamol untuk demam atau sakit jika perlu', 'Kerap basuh tangan; jangan berkongsi cawan atau tuala', 'Biar anak di rumah, jangan ke sekolah atau taska semasa sakit'],
    },
    seeDoctor: {
      zh: ['小孩尿量变少，可能脱水', '高烧不退或抽筋', '很没精神、一直想睡', '颈部僵硬或手脚无力'],
      en: ['Child is peeing less (may be dehydrated)', 'High fever that will not come down, or a fit', 'Very drowsy or floppy', 'Stiff neck or weak arms or legs'],
      ms: ['Anak kurang membuang air kecil (mungkin dehidrasi)', 'Demam tinggi yang tidak turun, atau sawan', 'Sangat mengantuk atau lemah longlai', 'Leher kaku atau tangan dan kaki lemah'],
    },
    askPrompt: {
      zh: '孩子得了手足口病，在家要怎么照顾？什么情况要马上看医生？',
      en: 'My child has hand, foot and mouth disease. How do I care for them at home, and when should we see a doctor?',
      ms: 'Anak saya ada penyakit tangan, kaki dan mulut. Bagaimana menjaganya di rumah, dan bilakah perlu jumpa doktor?',
    },
    sources: [{ name: NHS, url: 'https://www.nhs.uk/conditions/hand-foot-mouth-disease/' }],
    reviewedAt: DRAFTED,
  },
  {
    id: 'tuberculosis',
    category: 'infection',
    title: { zh: '结核病', en: 'Tuberculosis (TB)', ms: 'Tuberkulosis (TB)' },
    summary: {
      zh: '细菌感染，多数影响肺部，会通过咳嗽传染，可以治好。',
      en: 'A bacterial infection that mostly affects the lungs. It spreads through coughing and can be cured.',
      ms: 'Jangkitan bakteria yang kebanyakannya menjejaskan paru-paru. Ia merebak melalui batuk dan boleh diubati.',
    },
    symptoms: {
      zh: ['咳嗽超过 3 个星期', '咳出痰或带血', '晚上盗汗', '没胃口、体重下降', '一直很累、发烧'],
      en: ['A cough lasting more than 3 weeks', 'Coughing up mucus or blood', 'Night sweats', 'Loss of appetite and weight loss', 'Ongoing tiredness or fever'],
      ms: ['Batuk lebih daripada 3 minggu', 'Batuk berkahak atau berdarah', 'Berpeluh pada waktu malam', 'Hilang selera makan dan berat badan turun', 'Sentiasa letih atau demam'],
    },
    care: {
      zh: ['要按医生指示吃完整个疗程的药', '不要自己停药', '咳嗽时遮住口鼻', '保持房间通风', '家人可以请医生检查'],
      en: ['Take the full course of medicine as prescribed', 'Do not stop treatment on your own', 'Cover your mouth when coughing', 'Keep rooms well ventilated', 'Ask a doctor about checking close family members'],
      ms: ['Ambil ubat sehingga habis seperti yang diarahkan', 'Jangan berhenti rawatan sendiri', 'Tutup mulut ketika batuk', 'Pastikan bilik berudara', 'Tanya doktor tentang saringan untuk ahli keluarga'],
    },
    seeDoctor: {
      zh: ['咳嗽超过 3 个星期', '咳血', '不明原因体重下降、盗汗'],
      en: ['A cough lasting more than 3 weeks', 'Coughing up blood', 'Unexplained weight loss or night sweats'],
      ms: ['Batuk lebih daripada 3 minggu', 'Batuk berdarah', 'Berat badan turun atau berpeluh malam tanpa sebab'],
    },
    askPrompt: {
      zh: '咳嗽很久会不会是结核病？要做什么检查？',
      en: 'Could a long-lasting cough be TB, and what tests would I need?',
      ms: 'Adakah batuk berpanjangan mungkin TB, dan apakah ujian yang perlu dibuat?',
    },
    sources: [{ name: NHS, url: 'https://www.nhs.uk/conditions/tuberculosis-tb/' }],
    reviewedAt: DRAFTED,
  },
  {
    id: 'gastroenteritis',
    category: 'infection',
    title: { zh: '急性肠胃炎和食物中毒', en: 'Gastroenteritis & Food Poisoning', ms: 'Gastroenteritis & Keracunan Makanan' },
    summary: {
      zh: '吃了不干净的食物或感染病菌，引起腹泻和呕吐，多数几天会好。',
      en: 'Diarrhoea and vomiting caused by germs or contaminated food. It usually gets better within a few days.',
      ms: 'Cirit-birit dan muntah akibat kuman atau makanan tercemar. Biasanya pulih dalam beberapa hari.',
    },
    symptoms: {
      zh: ['腹泻', '恶心、呕吐', '肚子绞痛', '发烧', '没胃口'],
      en: ['Diarrhoea', 'Feeling sick or vomiting', 'Stomach cramps', 'Fever', 'Loss of appetite'],
      ms: ['Cirit-birit', 'Loya atau muntah', 'Kejang perut', 'Demam', 'Hilang selera makan'],
    },
    care: {
      zh: ['少量多次喝水，补充水分', '可以喝口服补液盐', '能吃时吃清淡的食物', '饭前便后洗手', '食物要煮熟，生熟分开'],
      en: ['Take small, frequent sips of water', 'Oral rehydration salts can help', 'Eat plain food when you feel able', 'Wash hands after the toilet and before eating', 'Cook food thoroughly and keep raw and cooked food apart'],
      ms: ['Minum air sedikit-sedikit tetapi kerap', 'Garam pemulihan oral boleh membantu', 'Makan makanan ringkas apabila mampu', 'Basuh tangan selepas ke tandas dan sebelum makan', 'Masak makanan sehingga masak dan asingkan makanan mentah'],
    },
    seeDoctor: {
      zh: ['有脱水迹象：很少小便、头晕', '大便有血或呕吐物有血', '呕吐超过 2 天或腹泻超过 7 天', '婴儿或老人症状明显'],
      en: ['Signs of dehydration: peeing little, feeling dizzy', 'Blood in stools or vomit', 'Vomiting for over 2 days or diarrhoea for over 7 days', 'A baby or older person with clear symptoms'],
      ms: ['Tanda dehidrasi: kurang kencing, pening', 'Darah dalam najis atau muntah', 'Muntah lebih 2 hari atau cirit-birit lebih 7 hari', 'Bayi atau warga emas dengan gejala yang jelas'],
    },
    askPrompt: {
      zh: '腹泻呕吐时要怎么补充水分？什么情况要去看医生？',
      en: 'How should I stay hydrated with diarrhoea and vomiting, and when should I see a doctor?',
      ms: 'Bagaimana saya mengelakkan dehidrasi semasa cirit-birit dan muntah, dan bilakah perlu jumpa doktor?',
    },
    sources: [
      { name: NHS, url: 'https://www.nhs.uk/symptoms/diarrhoea-and-vomiting/' },
      { name: NHS, url: 'https://www.nhs.uk/conditions/food-poisoning/' },
    ],
    reviewedAt: DRAFTED,
  },

  // ---------------- 慢性病 ----------------
  {
    id: 'diabetes',
    category: 'chronic',
    title: { zh: '糖尿病', en: 'Diabetes', ms: 'Diabetes' },
    summary: {
      zh: '血糖长期偏高的慢性病，控制不好会伤害眼睛、肾脏和神经。',
      en: 'A long-term condition where blood sugar stays too high. Poor control can damage the eyes, kidneys and nerves.',
      ms: 'Penyakit jangka panjang apabila gula dalam darah kekal tinggi. Kawalan yang lemah boleh merosakkan mata, buah pinggang dan saraf.',
    },
    symptoms: {
      zh: ['常常口渴', '小便次数多，尤其晚上', '很容易累', '体重莫名下降', '伤口好得慢、视力模糊'],
      en: ['Feeling very thirsty', 'Peeing more often, especially at night', 'Feeling tired', 'Losing weight without trying', 'Slow-healing cuts or blurred vision'],
      ms: ['Sangat dahaga', 'Kerap kencing, terutama waktu malam', 'Mudah letih', 'Berat badan turun tanpa sebab', 'Luka lambat sembuh atau penglihatan kabur'],
    },
    care: {
      zh: ['少吃甜食、少喝含糖饮料', '规律运动，控制体重', '按医生指示吃药，定期验血糖', '每天检查双脚有没有伤口', '定期检查眼睛和肾功能'],
      en: ['Cut down on sweets and sugary drinks', 'Exercise regularly and keep a healthy weight', 'Take medicine as prescribed and check blood sugar regularly', 'Check your feet daily for wounds', 'Have regular eye and kidney checks'],
      ms: ['Kurangkan makanan manis dan minuman bergula', 'Bersenam secara tetap dan jaga berat badan', 'Ambil ubat seperti diarahkan dan periksa gula darah secara berkala', 'Periksa kaki setiap hari untuk luka', 'Buat pemeriksaan mata dan buah pinggang secara berkala'],
    },
    seeDoctor: {
      zh: ['常口渴、多尿又容易累，要去验血糖', '一直呕吐、呼吸急促或意识不清', '脚上的伤口发红、化脓'],
      en: ['Thirst, peeing a lot and tiredness: get a blood sugar test', 'Constant vomiting, fast breathing or confusion', 'A foot wound that is red or has pus'],
      ms: ['Dahaga, kerap kencing dan letih: buat ujian gula darah', 'Muntah berterusan, bernafas laju atau keliru', 'Luka di kaki yang merah atau bernanah'],
    },
    askPrompt: {
      zh: '我想了解怎么通过饮食和运动控制血糖？',
      en: 'How can I control my blood sugar through diet and exercise?',
      ms: 'Bagaimana saya boleh mengawal gula darah melalui pemakanan dan senaman?',
    },
    sources: [{ name: NHS, url: 'https://www.nhs.uk/conditions/type-2-diabetes/' }],
    reviewedAt: DRAFTED,
  },
  {
    id: 'hypertension',
    category: 'chronic',
    title: { zh: '高血压', en: 'High Blood Pressure', ms: 'Tekanan Darah Tinggi' },
    summary: {
      zh: '血压长期偏高，通常没有感觉，但会增加中风和心脏病风险。',
      en: 'Blood pressure that stays too high. It usually has no symptoms but raises the risk of stroke and heart disease.',
      ms: 'Tekanan darah yang kekal tinggi. Biasanya tiada gejala tetapi meningkatkan risiko strok dan penyakit jantung.',
    },
    symptoms: {
      zh: ['大多数人没有任何症状', '只有量血压才知道', '血压很高时可能头痛、视力模糊'],
      en: ['Most people have no symptoms', 'Measuring is the only way to know', 'Very high readings may cause headache or blurred vision'],
      ms: ['Kebanyakan orang tiada gejala', 'Hanya boleh diketahui dengan mengukur', 'Bacaan sangat tinggi mungkin menyebabkan sakit kepala atau penglihatan kabur'],
    },
    care: {
      zh: ['少吃盐，少吃加工食品', '规律运动，控制体重', '戒烟、少喝酒', '按医生指示吃药，不要自己停', '定期量血压并记录'],
      en: ['Eat less salt and processed food', 'Exercise regularly and keep a healthy weight', 'Stop smoking and cut down on alcohol', 'Take medicine as prescribed; do not stop on your own', 'Check and record your blood pressure regularly'],
      ms: ['Kurangkan garam dan makanan diproses', 'Bersenam secara tetap dan jaga berat badan', 'Berhenti merokok dan kurangkan alkohol', 'Ambil ubat seperti diarahkan; jangan berhenti sendiri', 'Ukur dan catat tekanan darah secara berkala'],
    },
    seeDoctor: {
      zh: ['在家量到的血压一直偏高', '剧烈头痛、胸痛或呼吸困难', '突然脸歪、手脚无力或说话不清，立即拨打 999'],
      en: ['Home readings that stay high', 'Severe headache, chest pain or difficulty breathing', 'Sudden face drooping, weak limbs or slurred speech: call 999'],
      ms: ['Bacaan di rumah yang sentiasa tinggi', 'Sakit kepala teruk, sakit dada atau sukar bernafas', 'Muka tiba-tiba senget, anggota lemah atau pertuturan pelat: hubungi 999'],
    },
    askPrompt: {
      zh: '我的血压偏高，生活上要怎么调整？',
      en: 'My blood pressure is high. What lifestyle changes can help?',
      ms: 'Tekanan darah saya tinggi. Apakah perubahan gaya hidup yang boleh membantu?',
    },
    sources: [{ name: NHS, url: 'https://www.nhs.uk/conditions/high-blood-pressure/' }],
    reviewedAt: DRAFTED,
  },
  {
    id: 'cholesterol',
    category: 'chronic',
    title: { zh: '高胆固醇', en: 'High Cholesterol', ms: 'Kolesterol Tinggi' },
    summary: {
      zh: '血液里的胆固醇太多，会堵塞血管，增加心脏病和中风风险。',
      en: 'Too much cholesterol in the blood. It can clog blood vessels and raise the risk of heart attack and stroke.',
      ms: 'Terlalu banyak kolesterol dalam darah. Ia boleh menyumbat salur darah dan meningkatkan risiko serangan jantung dan strok.',
    },
    symptoms: {
      zh: ['通常没有症状', '要验血才知道', '有家族病史的人更要注意'],
      en: ['Usually causes no symptoms', 'A blood test is the only way to know', 'Take extra care if it runs in your family'],
      ms: ['Biasanya tiada gejala', 'Hanya ujian darah boleh mengesahkannya', 'Lebih berhati-hati jika ada sejarah keluarga'],
    },
    care: {
      zh: ['少吃油炸、肥肉和椰浆多的食物', '多吃蔬菜、水果和全谷类', '每周规律运动', '戒烟、少喝酒', '按医生指示吃药，定期验血'],
      en: ['Eat less fried food, fatty meat and santan-rich dishes', 'Eat more vegetables, fruit and whole grains', 'Exercise regularly each week', 'Stop smoking and cut down on alcohol', 'Take medicine as prescribed and have regular blood tests'],
      ms: ['Kurangkan makanan bergoreng, daging berlemak dan masakan bersantan', 'Makan lebih banyak sayur, buah dan bijirin penuh', 'Bersenam secara tetap setiap minggu', 'Berhenti merokok dan kurangkan alkohol', 'Ambil ubat seperti diarahkan dan buat ujian darah berkala'],
    },
    seeDoctor: {
      zh: ['40 岁以上或有家族病史，没验过血脂', '胸口痛或有压迫感，立即拨打 999'],
      en: ['Over 40 or with a family history and never had a cholesterol test', 'Chest pain or pressure: call 999'],
      ms: ['Berumur lebih 40 tahun atau ada sejarah keluarga dan belum pernah buat ujian kolesterol', 'Sakit atau rasa tertekan di dada: hubungi 999'],
    },
    askPrompt: {
      zh: '胆固醇偏高的话，饮食上要注意什么？',
      en: 'What should I watch in my diet if my cholesterol is high?',
      ms: 'Apakah yang perlu saya jaga dalam pemakanan jika kolesterol saya tinggi?',
    },
    sources: [{ name: NHS, url: 'https://www.nhs.uk/conditions/high-cholesterol/' }],
    reviewedAt: DRAFTED,
  },
  {
    id: 'asthma',
    category: 'chronic',
    title: { zh: '哮喘', en: 'Asthma', ms: 'Asma' },
    summary: {
      zh: '气管长期发炎、容易收窄，会突然喘不过气，可以控制得很好。',
      en: 'A long-term condition where the airways become inflamed and narrow. It can usually be well controlled.',
      ms: 'Penyakit jangka panjang apabila saluran pernafasan meradang dan menyempit. Biasanya boleh dikawal dengan baik.',
    },
    symptoms: {
      zh: ['呼吸有咻咻声', '喘不过气', '胸口发紧', '咳嗽，晚上更严重'],
      en: ['Wheezing', 'Breathlessness', 'A tight chest', 'Coughing, often worse at night'],
      ms: ['Berdehit ketika bernafas', 'Sesak nafas', 'Dada terasa ketat', 'Batuk, selalunya lebih teruk pada waktu malam'],
    },
    care: {
      zh: ['按医生指示使用吸入器', '随身带着缓解用的吸入器', '避开烟雾、灰尘等诱因', '定期复诊，检查吸入方法'],
      en: ['Use your inhalers as prescribed', 'Always carry your reliever inhaler', 'Avoid triggers like smoke and dust', 'Attend regular reviews and check your inhaler technique'],
      ms: ['Guna inhaler seperti yang diarahkan', 'Sentiasa bawa inhaler pelega', 'Elakkan pencetus seperti asap dan habuk', 'Hadir pemeriksaan berkala dan semak cara guna inhaler'],
    },
    seeDoctor: {
      zh: ['用了吸入器还是喘不过气，立即拨打 999', '喘到说不出话、嘴唇发青', '症状比平常频繁，或晚上常被喘醒'],
      en: ['Still breathless after using your inhaler: call 999', 'Too breathless to speak, or blue lips', 'Symptoms more often than usual, or waking at night'],
      ms: ['Masih sesak selepas guna inhaler: hubungi 999', 'Terlalu sesak untuk bercakap, atau bibir biru', 'Gejala lebih kerap daripada biasa, atau terjaga pada waktu malam'],
    },
    askPrompt: {
      zh: '哮喘发作时要怎么处理？平时怎样减少发作？',
      en: 'What should I do during an asthma attack, and how can I prevent attacks?',
      ms: 'Apa perlu saya buat semasa serangan asma, dan bagaimana mencegahnya?',
    },
    sources: [{ name: NHS, url: 'https://www.nhs.uk/conditions/asthma/' }],
    reviewedAt: DRAFTED,
  },
  {
    id: 'kidney',
    category: 'chronic',
    title: { zh: '慢性肾病', en: 'Chronic Kidney Disease', ms: 'Penyakit Buah Pinggang Kronik' },
    summary: {
      zh: '肾功能慢慢变差，早期没感觉，常和糖尿病、高血压有关。',
      en: 'The kidneys slowly stop working as well. Early stages have no symptoms, and it is often linked to diabetes and high blood pressure.',
      ms: 'Buah pinggang beransur-ansur kurang berfungsi. Peringkat awal tiada gejala dan sering berkait dengan diabetes dan tekanan darah tinggi.',
    },
    symptoms: {
      zh: ['早期通常没有症状', '脚踝或脸部水肿', '很累、没胃口', '小便有泡沫或带血', '皮肤痒、抽筋'],
      en: ['Usually no symptoms early on', 'Swollen ankles or face', 'Tiredness and poor appetite', 'Foamy or bloody urine', 'Itchy skin or muscle cramps'],
      ms: ['Biasanya tiada gejala pada peringkat awal', 'Buku lali atau muka bengkak', 'Letih dan kurang selera makan', 'Air kencing berbuih atau berdarah', 'Kulit gatal atau kekejangan otot'],
    },
    care: {
      zh: ['控制好血糖和血压', '少吃盐', '不要自己乱吃止痛药或偏方', '戒烟，保持健康体重', '定期验血、验尿'],
      en: ['Keep blood sugar and blood pressure under control', 'Eat less salt', 'Do not take painkillers or herbal remedies without advice', 'Stop smoking and keep a healthy weight', 'Have regular blood and urine tests'],
      ms: ['Kawal gula dan tekanan darah', 'Kurangkan garam', 'Jangan ambil ubat tahan sakit atau ubat herba tanpa nasihat', 'Berhenti merokok dan jaga berat badan', 'Buat ujian darah dan air kencing secara berkala'],
    },
    seeDoctor: {
      zh: ['有糖尿病或高血压，没检查过肾功能', '小便明显变少或带血', '水肿加重或喘不过气'],
      en: ['You have diabetes or high blood pressure and no kidney check', 'Much less urine, or blood in urine', 'Worsening swelling or breathlessness'],
      ms: ['Ada diabetes atau tekanan darah tinggi tetapi belum periksa buah pinggang', 'Air kencing sangat berkurang atau berdarah', 'Bengkak bertambah atau sesak nafas'],
    },
    askPrompt: {
      zh: '怎样保护肾脏？验肾功能要看哪些指标？',
      en: 'How can I protect my kidneys, and what kidney test results should I look at?',
      ms: 'Bagaimana melindungi buah pinggang, dan apakah keputusan ujian yang perlu diperhatikan?',
    },
    sources: [{ name: NHS, url: 'https://www.nhs.uk/conditions/kidney-disease/' }],
    reviewedAt: DRAFTED,
  },
  {
    id: 'gout',
    category: 'chronic',
    title: { zh: '痛风', en: 'Gout', ms: 'Gout' },
    summary: {
      zh: '尿酸太高形成结晶，让关节突然红肿剧痛，常见于大脚趾。',
      en: 'High uric acid forms crystals that cause sudden, severe joint pain and swelling, often in the big toe.',
      ms: 'Asid urik tinggi membentuk kristal yang menyebabkan sendi tiba-tiba bengkak dan sangat sakit, selalunya di ibu jari kaki.',
    },
    symptoms: {
      zh: ['关节突然剧痛', '关节红、肿、发热', '常在大脚趾', '痛到碰一下都受不了'],
      en: ['Sudden severe joint pain', 'Red, swollen, hot joint', 'Often the big toe', 'Too painful to touch'],
      ms: ['Sakit sendi teruk secara tiba-tiba', 'Sendi merah, bengkak dan panas', 'Selalunya di ibu jari kaki', 'Terlalu sakit untuk disentuh'],
    },
    care: {
      zh: ['发作时休息，把脚抬高、冰敷', '多喝水', '少吃内脏、海鲜和红肉', '少喝酒和含糖饮料', '按医生指示吃药'],
      en: ['During an attack, rest, raise the limb and use an ice pack', 'Drink plenty of water', 'Eat less offal, seafood and red meat', 'Cut down on alcohol and sugary drinks', 'Take medicine as prescribed'],
      ms: ['Semasa serangan, rehat, angkat anggota dan tuam dengan ais', 'Minum banyak air', 'Kurangkan makan organ dalaman, makanan laut dan daging merah', 'Kurangkan alkohol dan minuman bergula', 'Ambil ubat seperti diarahkan'],
    },
    seeDoctor: {
      zh: ['第一次关节突然红肿剧痛', '关节痛还伴随发烧', '一年发作好几次'],
      en: ['Sudden painful swollen joint for the first time', 'Joint pain with a fever', 'Several attacks in a year'],
      ms: ['Sendi tiba-tiba bengkak dan sakit buat kali pertama', 'Sakit sendi disertai demam', 'Beberapa kali serangan dalam setahun'],
    },
    askPrompt: {
      zh: '痛风发作时怎么办？平时饮食要注意什么？',
      en: 'What should I do during a gout attack, and what should I eat or avoid?',
      ms: 'Apa perlu dibuat semasa serangan gout, dan apa yang perlu dimakan atau dielakkan?',
    },
    sources: [{ name: NHS, url: 'https://www.nhs.uk/conditions/gout/' }],
    reviewedAt: DRAFTED,
  },

  // ---------------- 日常不适 ----------------
  {
    id: 'cold',
    category: 'everyday',
    title: { zh: '感冒和喉咙痛', en: 'Common Cold & Sore Throat', ms: 'Selsema & Sakit Tekak' },
    summary: {
      zh: '常见的病毒感染，通常一到两周自己会好，不需要抗生素。',
      en: 'A common viral infection that usually clears up on its own in 1 to 2 weeks. Antibiotics are not needed.',
      ms: 'Jangkitan virus biasa yang selalunya sembuh sendiri dalam 1 hingga 2 minggu. Antibiotik tidak diperlukan.',
    },
    symptoms: {
      zh: ['流鼻水、鼻塞', '喉咙痛', '打喷嚏、咳嗽', '轻微发烧或头痛'],
      en: ['Runny or blocked nose', 'Sore throat', 'Sneezing and coughing', 'Mild fever or headache'],
      ms: ['Hidung berair atau tersumbat', 'Sakit tekak', 'Bersin dan batuk', 'Demam ringan atau sakit kepala'],
    },
    care: {
      zh: ['多休息、多喝温水', '用温盐水漱口', '需要时用 paracetamol 止痛', '勤洗手，咳嗽时遮住口鼻'],
      en: ['Rest and drink warm fluids', 'Gargle with warm salty water', 'Use paracetamol for pain if needed', 'Wash hands often and cover coughs'],
      ms: ['Rehat dan minum air suam', 'Berkumur dengan air garam suam', 'Guna paracetamol untuk sakit jika perlu', 'Kerap basuh tangan dan tutup mulut ketika batuk'],
    },
    seeDoctor: {
      zh: ['呼吸困难或吞口水很困难', '高烧不退', '超过 3 个星期还没好'],
      en: ['Difficulty breathing or swallowing', 'High fever that will not come down', 'Not better after 3 weeks'],
      ms: ['Sukar bernafas atau menelan', 'Demam tinggi yang tidak turun', 'Tidak pulih selepas 3 minggu'],
    },
    askPrompt: {
      zh: '感冒喉咙痛在家怎么舒缓？需要吃抗生素吗？',
      en: 'How can I ease a cold and sore throat at home? Do I need antibiotics?',
      ms: 'Bagaimana melegakan selsema dan sakit tekak di rumah? Perlukah antibiotik?',
    },
    sources: [
      { name: NHS, url: 'https://www.nhs.uk/conditions/common-cold/' },
      { name: NHS, url: 'https://www.nhs.uk/symptoms/sore-throat/' },
    ],
    reviewedAt: DRAFTED,
  },
  {
    id: 'fever',
    category: 'everyday',
    title: { zh: '发烧（大人和小孩）', en: 'Fever (Adults & Children)', ms: 'Demam (Dewasa & Kanak-kanak)' },
    summary: {
      zh: '体温升高是身体对抗感染的反应，通常几天内会退。',
      en: 'A high temperature is the body fighting an infection. It usually goes away within a few days.',
      ms: 'Suhu badan tinggi ialah tindak balas badan melawan jangkitan. Biasanya hilang dalam beberapa hari.',
    },
    symptoms: {
      zh: ['摸起来额头或背部很烫', '发冷、发抖', '出汗、脸红', '没精神、没胃口'],
      en: ['Forehead or back feels hot', 'Chills or shivering', 'Sweating or flushed face', 'Low energy and poor appetite'],
      ms: ['Dahi atau belakang terasa panas', 'Menggigil', 'Berpeluh atau muka merah', 'Kurang bertenaga dan kurang selera makan'],
    },
    care: {
      zh: ['多喝水，预防脱水', '穿轻便衣服，不要包太紧', '需要时用 paracetamol 退烧', '多休息，留意精神状态'],
      en: ['Drink plenty of fluids to prevent dehydration', 'Wear light clothing; do not bundle up', 'Use paracetamol for fever if needed', 'Rest and watch how alert the person is'],
      ms: ['Minum banyak air untuk elak dehidrasi', 'Pakai pakaian nipis; jangan berbalut tebal', 'Guna paracetamol untuk demam jika perlu', 'Rehat dan perhatikan tahap kesedaran'],
    },
    seeDoctor: {
      zh: ['未满 3 个月的婴儿发烧', '抽筋、很难叫醒或颈部僵硬', '出现压了不会褪色的疹子', '发烧超过 3 天，或在骨痛热症流行区'],
      en: ['A baby under 3 months has a fever', 'A fit, very hard to wake, or a stiff neck', 'A rash that does not fade when pressed', 'Fever for more than 3 days, or in a dengue area'],
      ms: ['Bayi bawah 3 bulan demam', 'Sawan, sangat sukar dikejutkan atau leher kaku', 'Ruam yang tidak pudar apabila ditekan', 'Demam lebih 3 hari, atau di kawasan denggi'],
    },
    askPrompt: {
      zh: '孩子发烧时在家要怎么照顾？什么情况要马上去看医生？',
      en: 'How do I care for a fever at home, and when should I see a doctor right away?',
      ms: 'Bagaimana menjaga demam di rumah, dan bilakah perlu jumpa doktor segera?',
    },
    sources: [
      { name: NHS, url: 'https://www.nhs.uk/symptoms/fever-in-adults/' },
      { name: NHS, url: 'https://www.nhs.uk/symptoms/fever-in-children/' },
    ],
    reviewedAt: DRAFTED,
  },
  {
    id: 'gastritis',
    category: 'everyday',
    title: { zh: '胃痛和胃酸倒流', en: 'Stomach Pain & Acid Reflux', ms: 'Sakit Perut & Refluks Asid' },
    summary: {
      zh: '胃酸往上冲或胃部不适，常和饮食、压力有关。',
      en: 'Stomach discomfort or acid rising into the throat, often linked to eating habits and stress.',
      ms: 'Ketidakselesaan perut atau asid naik ke tekak, sering berkait dengan tabiat makan dan tekanan.',
    },
    symptoms: {
      zh: ['胸口有烧灼感', '嘴里有酸味', '上腹痛或胀气', '吃完饭更不舒服'],
      en: ['Burning feeling in the chest', 'Sour taste in the mouth', 'Upper stomach pain or bloating', 'Feeling worse after meals'],
      ms: ['Rasa pedih di dada', 'Rasa masam di mulut', 'Sakit perut bahagian atas atau kembung', 'Rasa lebih teruk selepas makan'],
    },
    care: {
      zh: ['少量多餐，不要吃太饱', '睡前 3 小时不要进食', '少吃辣、油腻和咖啡', '戒烟、少喝酒', '睡觉时把床头垫高'],
      en: ['Eat smaller meals; do not overeat', 'Avoid eating within 3 hours of bed', 'Cut down on spicy, fatty food and coffee', 'Stop smoking and cut down on alcohol', 'Raise the head of your bed'],
      ms: ['Makan sedikit tetapi kerap; jangan terlalu kenyang', 'Elak makan dalam 3 jam sebelum tidur', 'Kurangkan makanan pedas, berminyak dan kopi', 'Berhenti merokok dan kurangkan alkohol', 'Tinggikan bahagian kepala katil'],
    },
    seeDoctor: {
      zh: ['呕吐物有血或大便发黑', '吞东西困难', '体重莫名下降', '胸痛延伸到手臂或下巴，立即拨打 999'],
      en: ['Vomiting blood or black stools', 'Difficulty swallowing', 'Unexplained weight loss', 'Chest pain spreading to the arm or jaw: call 999'],
      ms: ['Muntah darah atau najis hitam', 'Sukar menelan', 'Berat badan turun tanpa sebab', 'Sakit dada merebak ke lengan atau rahang: hubungi 999'],
    },
    askPrompt: {
      zh: '常常胃酸倒流，生活和饮食上可以怎么改善？',
      en: 'I often get acid reflux. What lifestyle and diet changes can help?',
      ms: 'Saya kerap mengalami refluks asid. Apakah perubahan gaya hidup dan pemakanan yang boleh membantu?',
    },
    sources: [
      { name: NHS, url: 'https://www.nhs.uk/conditions/heartburn-and-acid-reflux/' },
      { name: NHS, url: 'https://www.nhs.uk/symptoms/stomach-ache/' },
    ],
    reviewedAt: DRAFTED,
  },
  {
    id: 'eczema',
    category: 'everyday',
    title: { zh: '湿疹和皮肤过敏', en: 'Eczema & Skin Allergy', ms: 'Ekzema & Alahan Kulit' },
    summary: {
      zh: '皮肤干、痒、发红的常见问题，时好时坏，可以控制。',
      en: 'A common condition that makes skin dry, itchy and red. It comes and goes but can be controlled.',
      ms: 'Masalah biasa yang menyebabkan kulit kering, gatal dan merah. Ia datang dan pergi tetapi boleh dikawal.',
    },
    symptoms: {
      zh: ['皮肤干燥、很痒', '发红或颜色变深', '皮肤粗糙、脱皮', '抓破后可能渗液'],
      en: ['Dry, very itchy skin', 'Red or darker patches', 'Rough or flaky skin', 'May weep fluid after scratching'],
      ms: ['Kulit kering dan sangat gatal', 'Tompok merah atau lebih gelap', 'Kulit kasar atau mengelupas', 'Mungkin berair selepas digaru'],
    },
    care: {
      zh: ['每天多次涂保湿霜', '用温水洗澡，不要太烫', '用温和、无香料的清洁用品', '找出并避开诱因', '剪短指甲，避免抓破'],
      en: ['Apply moisturiser several times a day', 'Bathe in warm, not hot, water', 'Use gentle, fragrance-free products', 'Find and avoid your triggers', 'Keep nails short to avoid scratching the skin open'],
      ms: ['Sapu pelembap beberapa kali sehari', 'Mandi dengan air suam, bukan panas', 'Guna produk lembut tanpa pewangi', 'Kenal pasti dan elakkan pencetus', 'Potong kuku pendek supaya kulit tidak luka'],
    },
    seeDoctor: {
      zh: ['皮肤红肿发热、流脓或结黄痂', '痒到影响睡眠', '嘴唇或脸肿、呼吸困难，立即拨打 999'],
      en: ['Skin is hot, swollen, oozing pus or crusting yellow', 'Itching is affecting sleep', 'Swollen lips or face, or difficulty breathing: call 999'],
      ms: ['Kulit panas, bengkak, bernanah atau berkerak kuning', 'Gatal sehingga mengganggu tidur', 'Bibir atau muka bengkak, atau sukar bernafas: hubungi 999'],
    },
    askPrompt: {
      zh: '湿疹一直反复，日常要怎么护理皮肤？',
      en: 'My eczema keeps coming back. How should I care for my skin day to day?',
      ms: 'Ekzema saya kerap berulang. Bagaimana menjaga kulit setiap hari?',
    },
    sources: [{ name: NHS, url: 'https://www.nhs.uk/conditions/atopic-eczema/' }],
    reviewedAt: DRAFTED,
  },
  {
    id: 'mental-health',
    category: 'everyday',
    title: { zh: '焦虑和抑郁', en: 'Anxiety & Depression', ms: 'Kebimbangan & Kemurungan' },
    summary: {
      zh: '长时间紧张、担心或情绪低落，是常见的问题，可以寻求帮助。',
      en: 'Feeling worried, tense or low for a long time is common, and help is available.',
      ms: 'Rasa bimbang, tegang atau sedih untuk tempoh lama adalah biasa, dan bantuan sedia ada.',
    },
    symptoms: {
      zh: ['长时间心情低落或空虚', '对以前喜欢的事没兴趣', '一直担心、坐立不安', '睡不好、很累', '心跳快、难以专心'],
      en: ['Feeling low or empty for a long time', 'Losing interest in things you used to enjoy', 'Constant worry or restlessness', 'Poor sleep and tiredness', 'Racing heart or trouble concentrating'],
      ms: ['Rasa sedih atau kosong untuk tempoh lama', 'Hilang minat terhadap perkara yang dahulu disukai', 'Sentiasa bimbang atau gelisah', 'Tidur tidak lena dan letih', 'Jantung berdebar atau sukar menumpukan perhatian'],
    },
    care: {
      zh: ['找信任的人聊一聊', '保持规律作息和运动', '少喝酒，不要用酒精解愁', '把心情记下来，留意变化', '可以向医生或辅导员求助'],
      en: ['Talk to someone you trust', 'Keep a regular routine and stay active', 'Cut down on alcohol; do not use it to cope', 'Write down your feelings and notice changes', 'Reach out to a doctor or counsellor'],
      ms: ['Berbual dengan orang yang dipercayai', 'Kekalkan rutin harian dan aktif bergerak', 'Kurangkan alkohol; jangan guna untuk mengatasi masalah', 'Catat perasaan dan perhatikan perubahan', 'Dapatkan bantuan doktor atau kaunselor'],
    },
    seeDoctor: {
      zh: ['有伤害自己的念头，立即拨打 999', '需要倾诉可打 Befrienders KL：03-7627 2929', '情绪问题超过两周，影响生活和工作'],
      en: ['Thoughts of harming yourself: call 999 now', 'To talk to someone, call Befrienders KL: 03-7627 2929', 'Low mood or worry for over 2 weeks affecting daily life'],
      ms: ['Ada fikiran untuk mencederakan diri: hubungi 999 segera', 'Untuk berbual, hubungi Befrienders KL: 03-7627 2929', 'Perasaan sedih atau bimbang lebih 2 minggu yang menjejaskan kehidupan'],
    },
    askPrompt: {
      zh: '最近常常焦虑、心情低落，我可以怎么帮助自己？',
      en: 'I have been feeling anxious and low lately. How can I help myself?',
      ms: 'Kebelakangan ini saya rasa bimbang dan sedih. Bagaimana saya boleh membantu diri sendiri?',
    },
    sources: [
      { name: NHS, url: 'https://www.nhs.uk/mental-health/conditions/generalised-anxiety-disorder-gad/' },
      { name: NHS, url: 'https://www.nhs.uk/mental-health/conditions/depression-in-adults/overview/' },
      { name: 'Befrienders KL', url: 'https://www.befrienders.org.my/' },
    ],
    reviewedAt: DRAFTED,
  },

  // ---------------- 认识急症 ----------------
  {
    id: 'stroke',
    category: 'emergency',
    title: { zh: '中风', en: 'Stroke', ms: 'Strok' },
    summary: {
      zh: '脑部血流突然中断，越快送医越能减少伤害，分秒必争。',
      en: 'Blood supply to part of the brain is suddenly cut off. The faster treatment starts, the less damage is done.',
      ms: 'Bekalan darah ke sebahagian otak terputus secara tiba-tiba. Lebih cepat dirawat, lebih kurang kerosakan.',
    },
    symptoms: {
      zh: ['脸部一边下垂，笑不起来', '一只手或脚突然无力、发麻', '说话含糊或听不懂别人说话', '突然看不清、头晕或剧烈头痛'],
      en: ['Face drooping on one side; cannot smile', 'Sudden weakness or numbness in one arm or leg', 'Slurred speech or trouble understanding', 'Sudden vision loss, dizziness or severe headache'],
      ms: ['Muka senget sebelah; tidak boleh senyum', 'Sebelah tangan atau kaki tiba-tiba lemah atau kebas', 'Pertuturan pelat atau sukar memahami', 'Hilang penglihatan, pening atau sakit kepala teruk secara tiba-tiba'],
    },
    care: {
      zh: ['记住：脸歪、手无力、说话不清，马上打 999', '记下症状开始的时间', '不要给病人吃东西或喝水', '控制血压、血糖，戒烟，降低风险'],
      en: ['Remember: face, arms, speech — call 999 at once', 'Note the time symptoms started', 'Do not give the person food or drink', 'Lower your risk: control blood pressure and sugar, stop smoking'],
      ms: ['Ingat: muka, lengan, pertuturan — hubungi 999 segera', 'Catat masa gejala bermula', 'Jangan beri pesakit makan atau minum', 'Kurangkan risiko: kawal tekanan darah dan gula, berhenti merokok'],
    },
    seeDoctor: {
      zh: ['立即拨打 999', '即使症状很快消失也要马上就医', '不要等看看会不会自己好'],
      en: ['Call 999 immediately', 'Get help even if symptoms go away quickly', 'Do not wait to see if it gets better'],
      ms: ['Hubungi 999 dengan segera', 'Dapatkan bantuan walaupun gejala cepat hilang', 'Jangan tunggu untuk lihat sama ada ia pulih'],
    },
    askPrompt: {
      zh: '怎样分辨中风的早期信号？家人中风时我该做什么？',
      en: 'How can I recognise early signs of stroke, and what should I do if a family member has one?',
      ms: 'Bagaimana mengenal pasti tanda awal strok, dan apa perlu dibuat jika ahli keluarga mengalaminya?',
    },
    sources: [{ name: NHS, url: 'https://www.nhs.uk/conditions/stroke/' }],
    reviewedAt: DRAFTED,
  },
  {
    id: 'heart-attack',
    category: 'emergency',
    title: { zh: '心脏病发作', en: 'Heart Attack', ms: 'Serangan Jantung' },
    summary: {
      zh: '心脏的血流被堵住，是会危及生命的急症，要立刻求救。',
      en: 'Blood flow to the heart is blocked. It is a life-threatening emergency that needs help right away.',
      ms: 'Aliran darah ke jantung tersumbat. Ia kecemasan yang mengancam nyawa dan perlukan bantuan segera.',
    },
    symptoms: {
      zh: ['胸口疼痛、闷或有压迫感', '痛感延伸到手臂、下巴、背部', '喘不过气', '冒冷汗、头晕或恶心'],
      en: ['Chest pain, tightness or pressure', 'Pain spreading to the arm, jaw or back', 'Shortness of breath', 'Cold sweat, dizziness or nausea'],
      ms: ['Sakit, rasa ketat atau tertekan di dada', 'Sakit merebak ke lengan, rahang atau belakang', 'Sesak nafas', 'Peluh sejuk, pening atau loya'],
    },
    care: {
      zh: ['马上打 999，不要自己开车去医院', '让病人坐下休息，保持冷静', '病人没反应、没呼吸时，开始 CPR', '平时控制血压、胆固醇，戒烟'],
      en: ['Call 999 at once; do not drive yourself to hospital', 'Help the person sit down, rest and stay calm', 'If they are unresponsive and not breathing, start CPR', 'Lower your risk: control blood pressure and cholesterol, stop smoking'],
      ms: ['Hubungi 999 segera; jangan memandu sendiri ke hospital', 'Bantu pesakit duduk, berehat dan bertenang', 'Jika tidak sedar dan tidak bernafas, mulakan CPR', 'Kurangkan risiko: kawal tekanan darah dan kolesterol, berhenti merokok'],
    },
    seeDoctor: {
      zh: ['立即拨打 999', '胸痛超过几分钟不缓解', '女性和糖尿病人症状可能不典型，也要重视'],
      en: ['Call 999 immediately', 'Chest pain that lasts more than a few minutes', 'Women and people with diabetes may have unusual symptoms — take them seriously'],
      ms: ['Hubungi 999 dengan segera', 'Sakit dada lebih daripada beberapa minit', 'Wanita dan pesakit diabetes mungkin ada gejala luar biasa — ambil serius'],
    },
    askPrompt: {
      zh: '心脏病发作有哪些信号？等救护车时可以做什么？',
      en: 'What are the signs of a heart attack, and what can I do while waiting for the ambulance?',
      ms: 'Apakah tanda serangan jantung, dan apa boleh dibuat sementara menunggu ambulans?',
    },
    sources: [{ name: NHS, url: 'https://www.nhs.uk/conditions/heart-attack/' }],
    reviewedAt: DRAFTED,
  },
  {
    id: 'heatstroke',
    category: 'emergency',
    title: { zh: '中暑', en: 'Heatstroke', ms: 'Strok Haba' },
    summary: {
      zh: '身体过热、无法自己降温，严重时会危及生命，要立刻降温求救。',
      en: 'The body overheats and cannot cool itself. It can be life-threatening and needs urgent cooling and help.',
      ms: 'Badan terlalu panas dan tidak dapat menyejukkan diri. Ia boleh mengancam nyawa dan perlu disejukkan serta dibantu segera.',
    },
    symptoms: {
      zh: ['体温很高，皮肤又热又干或大量出汗', '头痛、头晕、恶心', '意识混乱、站不稳', '抽筋或昏倒'],
      en: ['Very high temperature; hot dry skin or heavy sweating', 'Headache, dizziness or nausea', 'Confusion or unsteadiness', 'A fit or collapsing'],
      ms: ['Suhu sangat tinggi; kulit panas dan kering atau berpeluh banyak', 'Sakit kepala, pening atau loya', 'Keliru atau tidak stabil', 'Sawan atau rebah'],
    },
    care: {
      zh: ['马上移到阴凉处，躺下、把脚抬高', '用凉水擦身、扇风降温', '清醒的话给他小口喝水', '天热时多喝水，避开中午烈日'],
      en: ['Move to a cool place, lie down and raise the feet', 'Cool the skin with water and fan them', 'If awake, give small sips of water', 'In hot weather, drink plenty and avoid the midday sun'],
      ms: ['Pindahkan ke tempat sejuk, baringkan dan angkat kaki', 'Sejukkan kulit dengan air dan kipas', 'Jika sedar, beri minum air sedikit-sedikit', 'Semasa cuaca panas, minum banyak air dan elak matahari tengah hari'],
    },
    seeDoctor: {
      zh: ['立即拨打 999', '降温 30 分钟后还没好转', '意识不清、抽筋或没反应'],
      en: ['Call 999 immediately', 'No better after 30 minutes of cooling', 'Confused, having a fit or unresponsive'],
      ms: ['Hubungi 999 dengan segera', 'Tidak pulih selepas 30 minit disejukkan', 'Keliru, sawan atau tidak memberi respons'],
    },
    askPrompt: {
      zh: '天气很热时怎样预防中暑？有人中暑时要怎么急救？',
      en: 'How can I prevent heatstroke in hot weather, and what first aid should I give?',
      ms: 'Bagaimana mencegah strok haba semasa cuaca panas, dan apakah bantuan kecemasan yang perlu diberi?',
    },
    sources: [{ name: NHS, url: 'https://www.nhs.uk/conditions/heat-exhaustion-heatstroke/' }],
    reviewedAt: DRAFTED,
  },
]
