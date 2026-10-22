(() => {
  const originalText = new WeakMap(), originalAttrs = new WeakMap();
  const dictionaryRows = [
    ["Ish topish", "Поиск работы", "Find work", "Жұмыс іздеу", "Жумуш издөө", "Ҷустуҷӯи кор"],
    ["Ish beruvchilar", "Работодателям", "For employers", "Жұмыс берушілер", "Иш берүүчүлөр", "Корфармоён"],
    ["Biz haqimizda", "О нас", "About us", "Біз туралы", "Биз жөнүндө", "Дар бораи мо"],
    ["Kirish", "Войти", "Sign in", "Кіру", "Кирүү", "Ворид шудан"],
    ["Ro‘yxatdan o‘tish", "Регистрация", "Sign up", "Тіркелу", "Катталуу", "Сабти ном"],
    ["Bosh sahifa", "Главная", "Home", "Басты бет", "Башкы бет", "Асосӣ"],
    ["Chiqish", "Выйти", "Sign out", "Шығу", "Чыгуу", "Баромадан"],
    ["Ish e’lon qilish", "Разместить вакансию", "Post a job", "Жұмыс жариялау", "Жумуш жарыялоо", "Эълони кор"],
    ["Shaxsiy ma’lumotlar", "Личные данные", "Personal information", "Жеке мәліметтер", "Жеке маалымат", "Маълумоти шахсӣ"],
    ["Ish tajribasi", "Опыт работы", "Work experience", "Жұмыс тәжірибесі", "Иш тажрыйбасы", "Таҷрибаи корӣ"],
    ["Arizalar", "Заявки", "Applications", "Өтінімдер", "Арыздар", "Дархостҳо"],
    ["Chatlar", "Чаты", "Chats", "Чаттар", "Чаттар", "Чатҳо"],
    ["To‘lovlar", "Платежи", "Payments", "Төлемдер", "Төлөмдөр", "Пардохтҳо"],
    ["Promokodlar", "Промокоды", "Promo codes", "Промокодтар", "Промокоддор", "Рамзҳои тахфиф"],
    ["Do‘stingizni taklif qilish", "Пригласить друга", "Invite a friend", "Досыңызды шақыру", "Досуңузду чакыруу", "Дӯстро даъват кунед"],
    ["Arxivlar", "Архив", "Archive", "Мұрағат", "Архив", "Бойгонӣ"],
    ["Sozlamalar", "Настройки", "Settings", "Баптаулар", "Жөндөөлөр", "Танзимот"],
    ["Bog‘lanish", "Связаться", "Contact", "Байланыс", "Байланыш", "Тамос"],
    ["Maxfiylik", "Конфиденциальность", "Privacy", "Құпиялылық", "Купуялык", "Махфият"],
    ["Xavfsizlik", "Безопасность", "Security", "Қауіпсіздік", "Коопсуздук", "Амният"],
    ["Bildirishnomalar", "Уведомления", "Notifications", "Хабарландырулар", "Билдирмелер", "Огоҳиномаҳо"],
    ["Til", "Язык", "Language", "Тіл", "Тил", "Забон"],
    ["Interfeys", "Интерфейс", "Interface", "Интерфейс", "Интерфейс", "Интерфейс"],
    ["Dastur haqida", "О приложении", "About the app", "Қолданба туралы", "Тиркеме жөнүндө", "Дар бораи барнома"],
    ["Hisob", "Аккаунт", "Account", "Есептік жазба", "Аккаунт", "Ҳисоб"],
    ["Shaxsiy kabinetingiz", "Личный кабинет", "Your account", "Жеке кабинетіңіз", "Жеке кабинетиңиз", "Ҳуҷраи шахсӣ"],
    ["Ish izlovchi", "Соискатель", "Job seeker", "Жұмыс іздеуші", "Жумуш издөөчү", "Ҷӯяндаи кор"],
    ["Ish beruvchi", "Работодатель", "Employer", "Жұмыс беруші", "Иш берүүчү", "Корфармо"],
    ["Ishlarni ko‘rish →", "Смотреть вакансии →", "Browse jobs →", "Жұмыстарды көру →", "Жумуштарды көрүү →", "Дидани ҷойҳои кор →"],
    ["Saqlangan ishlar", "Сохранённые вакансии", "Saved jobs", "Сақталған жұмыстар", "Сакталган жумуштар", "Корҳои захирашуда"],
    ["Saqlanganlar", "Сохранённое", "Saved", "Сақталғандар", "Сакталгандар", "Захирашуда"],
    ["Bugungi rejangiz", "Ваш план на сегодня", "Your plan for today", "Бүгінгі жоспарыңыз", "Бүгүнкү планыңыз", "Нақшаи имрӯзаи шумо"],
    ["Siz uchun tavsiyalar", "Рекомендации для вас", "Recommended for you", "Сізге ұсыныстар", "Сиз үчүн сунуштар", "Тавсияҳо барои шумо"],
    ["Mos vakansiyalar", "Подходящие вакансии", "Matching jobs", "Сәйкес вакансиялар", "Ылайыктуу жумуштар", "Ҷойҳои кори мувофиқ"],
    ["Barchasini ko‘rish →", "Посмотреть все →", "View all →", "Барлығын көру →", "Баарын көрүү →", "Ҳамаро дидан →"],
    ["Shahar", "Город", "City", "Қала", "Шаар", "Шаҳр"],
    ["Barcha hududlar", "Все регионы", "All regions", "Барлық өңірлер", "Бардык аймактар", "Ҳама минтақаҳо"],
    ["Barcha shaharlar", "Все города", "All cities", "Барлық қалалар", "Бардык шаарлар", "Ҳама шаҳрҳо"],
    ["Kunlik", "Ежедневно", "Daily", "Күндік", "Күнүмдүк", "Ҳаррӯза"],
    ["Soatbay", "Почасово", "Hourly", "Сағаттық", "Сааттык", "Соатбай"],
    ["Masofaviy", "Удалённо", "Remote", "Қашықтан", "Алыстан", "Фосилавӣ"],
    ["Barchasi", "Все", "All", "Барлығы", "Баары", "Ҳама"],
    ["Yangi", "Новые", "New", "Жаңа", "Жаңы", "Нав"],
    ["Ariza berish →", "Откликнуться →", "Apply →", "Өтінім беру →", "Арыз берүү →", "Дархост додан →"],
    ["Ma’lumotlarni saqlash", "Сохранить данные", "Save information", "Мәліметтерді сақтау", "Маалыматты сактоо", "Маълумотро нигоҳ доштан"],
    ["O‘zbekcha", "Узбекский", "Uzbek", "Қазақша", "Кыргызча", "Тоҷикӣ"],
    ["Kunduzgi", "Дневная", "Light", "Күндізгі", "Күндүзгү", "Рӯзона"],
    ["Tungi", "Ночная", "Dark", "Түнгі", "Түнкү", "Шабона"],
    ["Tizim bo‘yicha", "Системная", "System", "Жүйе бойынша", "Тутум боюнча", "Мувофиқи низом"],
    ["Ish qidirish", "Поиск работы", "Job search", "Жұмыс іздеу", "Жумуш издөө", "Ҷустуҷӯи кор"],
    ["Qanday ish qidiryapsiz?", "Какую работу ищете?", "What work are you looking for?", "Қандай жұмыс іздейсіз?", "Кандай жумуш издеп жатасыз?", "Чӣ гуна кор меҷӯед?"],
    ["Masalan, kuryer, kassir...", "Например, курьер, кассир...", "For example, courier, cashier...", "Мысалы, курьер, кассир...", "Мисалы, курьер, кассир...", "Масалан, хаткашон, хазинадор..."],
    ["Ishlarni qidirish →", "Найти работу →", "Search jobs →", "Жұмыс іздеу →", "Жумуш издөө →", "Ҷустуҷӯи кор →"],
    ["Kirish", "Вход", "Sign in", "Кіру", "Кирүү", "Воридшавӣ"],
    ["Parol", "Пароль", "Password", "Құпиясөз", "Сырсөз", "Рамз"],
    ["Ism-familiya", "Имя и фамилия", "Full name", "Аты-жөні", "Аты-жөнү", "Ному насаб"],
    ["Email yoki telefon raqam", "Email или номер телефона", "Email or phone number", "Email немесе телефон нөмірі", "Email же телефон номери", "Email ё рақами телефон"],
    ["Arizangiz yuborildi! Ish beruvchi siz bilan bog‘lanadi.", "Заявка отправлена! Работодатель свяжется с вами.", "Application sent! The employer will contact you.", "Өтінім жіберілді! Жұмыс беруші сізбен байланысады.", "Арызыңыз жөнөтүлдү! Иш берүүчү сиз менен байланышат.", "Дархост фиристода шуд! Корфармо бо шумо тамос мегирад."],
    ["Profil va chat maxfiyligi", "Конфиденциальность профиля и чатов", "Profile and chat privacy", "Профиль мен чат құпиялылығы", "Профиль жана чат купуялыгы", "Махфияти профил ва чат"],
    ["Profilim ommaviy ko‘rinsin", "Показывать мой профиль", "Make my profile public", "Профилім ашық болсын", "Профилим ачык болсун", "Профили ман намоён бошад"],
    ["Ism-familiyam ko‘rinsin", "Показывать имя и фамилию", "Show my full name", "Аты-жөнім көрінсін", "Аты-жөнүм көрүнсүн", "Ному насабам намоён бошад"],
    ["Telefon raqamim ko‘rinsin", "Показывать номер телефона", "Show my phone number", "Телефон нөмірім көрінсін", "Телефон номерим көрүнсүн", "Рақами телефонам намоён бошад"],
    ["Email manzilim ko‘rinsin", "Показывать email", "Show my email", "Email мекенжайым көрінсін", "Email дарегим көрүнсүн", "Email-и ман намоён бошад"],
    ["Yoshim ko‘rinsin", "Показывать мой возраст", "Show my age", "Жасым көрінсін", "Жашым көрүнсүн", "Синни ман намоён бошад"],
    ["Jinsim ko‘rinsin", "Показывать мой пол", "Show my gender", "Жынысым көрінсін", "Жынысым көрүнсүн", "Ҷинси ман намоён бошад"],
    ["Profil maxfiyligini saqlash", "Сохранить настройки приватности", "Save privacy settings", "Құпиялылықты сақтау", "Купуялыкты сактоо", "Захира кардани махфият"],
    ["Parolni o‘zgartirish", "Изменить пароль", "Change password", "Құпиясөзді өзгерту", "Сырсөздү өзгөртүү", "Иваз кардани рамз"],
    ["Akkauntdan chiqish", "Выйти из аккаунта", "Sign out of account", "Аккаунттан шығу", "Аккаунттан чыгуу", "Баромадан аз ҳисоб"],
    ["Akkauntni vaqtincha muzlatish", "Временно заморозить аккаунт", "Temporarily freeze account", "Аккаунтты уақытша тоқтату", "Аккаунтту убактылуу тоңдуруу", "Муваққатан боздоштани ҳисоб"],
    ["Akkauntni butunlay o‘chirish", "Удалить аккаунт навсегда", "Delete account permanently", "Аккаунтты біржола жою", "Аккаунтту биротоло өчүрүү", "Доимӣ нест кардани ҳисоб"],
    ["Tavsiya etilganlar", "Рекомендации", "Recommendations", "Ұсыныстар", "Сунуштар", "Тавсияҳо"],
    ["Siz uchun ishlar", "Работа для вас", "Jobs for you", "Сізге арналған жұмыстар", "Сиз үчүн жумуштар", "Корҳо барои шумо"],
    ["E’lon joylandi", "Вакансия опубликована", "Job posted", "Жұмыс жарияланды", "Жумуш жарыяланды", "Эълон нашр шуд"],
    ["Kompaniya", "Компания", "Company", "Компания", "Компания", "Ширкат"],
    ["Maosh", "Зарплата", "Pay", "Жалақы", "Айлык", "Музд"],
    ["Yosh", "Возраст", "Age", "Жас", "Жаш", "Синну сол"],
    ["Jins", "Пол", "Gender", "Жыныс", "Жыныс", "Ҷинс"],
    ["Aloqa usullari", "Способы связи", "Contact methods", "Байланыс тәсілдері", "Байланыш жолдору", "Роҳҳои тамос"],
    ["Arizalarim", "Мои заявки", "My applications", "Өтінімдерім", "Арыздарым", "Дархостҳои ман"],
    ["Mening e’lonlarim", "Мои вакансии", "My job posts", "Менің вакансияларым", "Менин вакансияларым", "Эълонҳои ман"],
    ["Barcha vakansiyalar", "Все вакансии", "All jobs", "Барлық вакансиялар", "Бардык вакансиялар", "Ҳамаи ҷойҳои кор"],
    ["Ro‘yxatdan o‘ting", "Зарегистрируйтесь", "Create an account", "Тіркеліңіз", "Катталыңыз", "Сабти ном кунед"],
    ["O‘zbekistonda moslashuvchan ishlar", "Гибкая работа в Узбекистане", "Flexible jobs in Uzbekistan", "Өзбекстандағы икемді жұмыстар", "Өзбекстандагы ийкемдүү жумуштар", "Кори чандир дар Ӯзбекистон"],
    ["Mehnatingizga", "Ваш труд", "Your work", "Еңбегіңізге", "Эмгегиңизге", "Меҳнати шумо"],
    ["munosib", "достойный", "deserving", "лайықты", "татыктуу", "сазовори"],
    ["daromad.", "доход.", "income.", "табыс.", "киреше.", "даромад."],
    ["Kunlik va soatbay ishlarni toping. O‘zingizga qulay vaqtda ishlang, daromadni bugundan boshlang.", "Найдите подённую и почасовую работу. Работайте в удобное время и начните зарабатывать сегодня.", "Find daily and hourly jobs. Work when it suits you and start earning today.", "Күндік және сағаттық жұмыстарды табыңыз. Өзіңізге ыңғайлы уақытта жұмыс істеп, бүгін табыс таба бастаңыз.", "Күндүк жана сааттык жумуштарды табыңыз. Ыңгайлуу убакта иштеп, бүгүн киреше таба баштаңыз.", "Кори рӯзона ва соатбай ёбед. Дар вақти мувофиқ кор карда, имрӯз ба даромад оғоз кунед."],
    ["Bugun joylangan yangi takliflar bilan tanishing", "Посмотрите новые предложения, опубликованные сегодня", "Explore new jobs posted today", "Бүгін жарияланған жаңа ұсыныстарды қараңыз", "Бүгүн жарыяланган жаңы сунуштарды көрүңүз", "Пешниҳодҳои нави имрӯзаро бинед"],
    ["Yaxshi haq, tanlangan profillar va foydali yo‘riqnomalar", "Хорошая оплата, профили и полезные инструкции", "Good pay, featured profiles and useful guides", "Жақсы ақы, таңдаулы профильдер және пайдалы нұсқаулықтар", "Жакшы акы, тандалган профилдер жана пайдалуу нускамалар", "Маоши хуб, профилҳои интихобшуда ва дастурҳои муфид"],
    ["Sanani tanlang, mos ishlarni va foydali takliflarni ko‘ring.", "Выберите дату, чтобы увидеть подходящие вакансии и предложения.", "Choose a date to see matching jobs and useful offers.", "Күнді таңдап, сәйкес жұмыстар мен ұсыныстарды көріңіз.", "Күндү тандап, ылайыктуу жумуштар менен сунуштарды көрүңүз.", "Санаро интихоб кунед, то ҷойҳои кор ва пешниҳодҳои мувофиқро бинед."],
    ["Yangi va tanlangan ishlar", "Новые и выбранные вакансии", "New and selected jobs", "Жаңа және таңдалған жұмыстар", "Жаңы жана тандалган жумуштар", "Корҳои нав ва интихобшуда"],
    ["Siz uchun tavsiyalar", "Рекомендации для вас", "Recommendations for you", "Сізге ұсыныстар", "Сиз үчүн сунуштар", "Тавсияҳо барои шумо"],
    ["To‘lovlar tarixi", "История платежей", "Payment history", "Төлемдер тарихы", "Төлөмдөр тарыхы", "Таърихи пардохтҳо"],
    ["Hisob va xavfsizlik", "Аккаунт и безопасность", "Account and security", "Есептік жазба және қауіпсіздік", "Аккаунт жана коопсуздук", "Ҳисоб ва амният"],
    ["Akkaunt boshqaruvi", "Управление аккаунтом", "Account management", "Есептік жазбаны басқару", "Аккаунтту башкаруу", "Идоракунии ҳисоб"],
    ["Til", "Язык", "Language", "Тіл", "Тил", "Забон"],
    ["Interfeys ko‘rinishi", "Вид интерфейса", "Appearance", "Интерфейс көрінісі", "Интерфейстин көрүнүшү", "Намуди интерфейс"],
    ["Ilova tili", "Язык приложения", "App language", "Қолданба тілі", "Тиркеме тили", "Забони барнома"],
    ["Ilova menyusi va interfeys tilini tanlang.", "Выберите язык меню и интерфейса приложения.", "Choose the app menu and interface language.", "Қолданба мәзірі мен интерфейс тілін таңдаңыз.", "Колдонмонун меню жана интерфейс тилин тандаңыз.", "Забони меню ва интерфейси барномаро интихоб кунед."],
    ["Hozircha to‘lovlar yo‘q. To‘lov tizimi ulangach, ish haqi tushumlari shu yerda ko‘rinadi.", "Платежей пока нет. После подключения платёжной системы здесь будут отображаться выплаты.", "No payments yet. Earnings will appear here once payments are connected.", "Әзірге төлемдер жоқ. Төлем жүйесі қосылғанда, табыс осында көрсетіледі.", "Азырынча төлөмдөр жок. Төлөм системасы кошулганда кирешелер бул жерде көрүнөт.", "Ҳоло пардохт нест. Пас аз пайваст шудани низоми пардохт даромадҳо ин ҷо нишон дода мешаванд."],
    ["Yaxshi ish — yangi imkoniyatlar sari qadam.", "Хорошая работа — шаг к новым возможностям.", "Good work opens new opportunities.", "Жақсы жұмыс — жаңа мүмкіндіктерге қадам.", "Жакшы жумуш — жаңы мүмкүнчүлүктөргө кадам.", "Кори хуб қадам ба сӯи имкониятҳои нав аст."],
    ["Loyiha tarixi", "История проекта", "Project history", "Жоба тарихы", "Долбоор тарыхы", "Таърихи лоиҳа"],
    ["Jamoa yo‘nalishlari", "Направления команды", "Team areas", "Команда бағыттары", "Команданын багыттары", "Самтҳои гурӯҳ"],
    ["Dastlabki natijalar", "Первые результаты", "Early results", "Алғашқы нәтижелер", "Алгачкы жыйынтыктар", "Натиҷаҳои аввал"],
    ["14 hudud bo‘yicha ishlar", "Работа в 14 регионах", "Jobs across 14 regions", "14 өңірдегі жұмыстар", "14 аймактагы жумуштар", "Кор дар 14 минтақа"],
    ["Yangi xabarlar", "Новые сообщения", "New messages", "Жаңа хабарламалар", "Жаңы билдирүүлөр", "Паёмҳои нав"],
    ["Barchasi", "Все", "All", "Барлығы", "Баары", "Ҳама"],
    ["Ish beruvchiman", "Я работодатель", "I am an employer", "Мен жұмыс берушімін", "Мен иш берүүчүмүн", "Ман корфармо ҳастам"],
    ["Ish izlayman", "Я ищу работу", "I am looking for work", "Жұмыс іздеймін", "Жумуш издейм", "Ман кор меҷӯям"],
    ["Google orqali kirish", "Войти через Google", "Continue with Google", "Google арқылы кіру", "Google аркылуу кирүү", "Ворид шудан бо Google"],
    ["Ish e’lonini joylash", "Разместить вакансию", "Post a job", "Жұмыс вакансиясын жариялау", "Жумуш жарыясын жайгаштыруу", "Ҷойгир кардани эълони кор"],
    ["Ish nomi *", "Название вакансии *", "Job title *", "Жұмыс атауы *", "Жумуш аталышы *", "Номи вазифа *"],
    ["Kompaniya *", "Компания *", "Company *", "Компания *", "Компания *", "Ширкат *"],
    ["Ish turi", "Тип работы", "Job type", "Жұмыс түрі", "Жумуш түрү", "Навъи кор"],
    ["Maosh (so‘m)", "Зарплата (сум)", "Pay (UZS)", "Жалақы (сум)", "Айлык (сум)", "Музд (сӯм)"],
    ["Qisqacha tavsif", "Краткое описание", "Brief description", "Қысқаша сипаттама", "Кыскача сүрөттөмө", "Тавсифи кӯтоҳ"],
    ["Ishga ariza berish", "Отклик на вакансию", "Apply for a job", "Жұмысқа өтінім беру", "Жумушка арыз берүү", "Дархост ба кор"],
    ["Arizani yuborish", "Отправить заявку", "Submit application", "Өтінімді жіберу", "Арызды жөнөтүү", "Фиристодани дархост"],
    ["Telefon raqamingiz *", "Номер телефона *", "Phone number *", "Телефон нөміріңіз *", "Телефон номериңиз *", "Рақами телефон *"],
    ["O‘zingiz haqingizda", "О себе", "About you", "Өзіңіз туралы", "Өзүңүз жөнүндө", "Дар бораи худ"],
    ["Kamida 6 ta belgi", "Не менее 6 символов", "At least 6 characters", "Кемінде 6 таңба", "Кеминде 6 белги", "Ҳадди ақал 6 аломат"],
    ["Ish beruvchi bilan suhbat", "Чат с работодателем", "Chat with employer", "Жұмыс берушімен чат", "Иш берүүчү менен баарлашуу", "Суҳбат бо корфармо"],
    ["Suhbatni tanlang", "Выберите переписку", "Select a conversation", "Чатты таңдаңыз", "Маекти тандаңыз", "Суҳбатро интихоб кунед"],
    ["Hali ariza yubormagansiz.", "Вы ещё не отправляли заявки.", "You have not applied yet.", "Әлі өтінім жібермедіңіз.", "Азырынча арыз жөнөткөн жоксуз.", "Шумо ҳанӯз дархост нафиристодаед."],
    ["Profilingizni ko‘rish va tahrirlash", "Посмотреть и изменить профиль", "View and edit your profile", "Профильді көру және өңдеу", "Профилди көрүү жана өзгөртүү", "Дидан ва таҳрири профил"],
    ["Maxfiylikni saqlash", "Сохранить настройки приватности", "Save privacy settings", "Құпиялылықты сақтау", "Купуялыкты сактоо", "Захира кардани махфият"],
    ["Bildirishnomalarni saqlash", "Сохранить уведомления", "Save notifications", "Хабарландыруларды сақтау", "Билдирмелерди сактоо", "Нигоҳ доштани огоҳиномаҳо"],
    ["Yangi chat xabarlari", "Новые сообщения в чате", "New chat messages", "Чаттағы жаңа хабарламалар", "Чаттагы жаңы билдирүүлөр", "Паёмҳои нави чат"],
    ["Ariza holati o‘zgarganda", "При изменении статуса заявки", "When application status changes", "Өтінім күйі өзгергенде", "Арыздын абалы өзгөргөндө", "Ҳангоми тағйири ҳолати дархост"],
    ["Yangi mos vakansiyalar", "Новые подходящие вакансии", "New matching jobs", "Жаңа сәйкес вакансиялар", "Жаңы ылайыктуу жумуштар", "Ҷойҳои нави мувофиқ"],
    ["Email orqali bildirishnomalar", "Уведомления по email", "Email notifications", "Email арқылы хабарландырулар", "Email аркылуу билдирмелер", "Огоҳиномаҳо тавассути email"],
    ["Amaldagi parol", "Текущий пароль", "Current password", "Қазіргі құпиясөз", "Учурдагы сырсөз", "Рамзи ҷорӣ"],
    ["Yangi parol", "Новый пароль", "New password", "Жаңа құпиясөз", "Жаңы сырсөз", "Рамзи нав"],
    ["Yangi parolni takrorlang", "Повторите новый пароль", "Repeat new password", "Жаңа құпиясөзді қайталаңыз", "Жаңы сырсөздү кайталаңыз", "Рамзи навро такрор кунед"],
    ["Parolni yangilash", "Обновить пароль", "Update password", "Құпиясөзді жаңарту", "Сырсөздү жаңыртуу", "Нав кардани рамз"],
    ["Saqlash", "Сохранить", "Save", "Сақтау", "Сактоо", "Нигоҳ доштан"],
    ["Ko‘rish", "Посмотреть", "View", "Көру", "Көрүү", "Дидан"],
    ["Yopish", "Закрыть", "Close", "Жабу", "Жабуу", "Пӯшидан"],
    ["Mening arizalarim", "Мои заявки", "My applications", "Өтінімдерім", "Арыздарым", "Дархостҳои ман"],
    ["Ish beruvchi siz bilan bog‘lanadi.", "Работодатель свяжется с вами.", "The employer will contact you.", "Жұмыс беруші сізбен байланысады.", "Иш берүүчү сиз менен байланышат.", "Корфармо бо шумо тамос мегирад."],
    ["O‘zbekistonning 14 hududi", "14 регионов Узбекистана", "14 regions of Uzbekistan", "Өзбекстанның 14 өңірі", "Өзбекстандын 14 аймагы", "14 минтақаи Ӯзбекистон"],
    ["Xush kelibsiz,", "Добро пожаловать,", "Welcome,", "Қош келдіңіз,", "Кош келиңиз,", "Хуш омадед,"],
    ["ISH IZLOVCHI KABINETI", "КАБИНЕТ СОИСКАТЕЛЯ", "JOB SEEKER DASHBOARD", "ЖҰМЫС ІЗДЕУШІ КАБИНЕТІ", "ЖУМУШ ИЗДӨӨЧҮ КАБИНЕТИ", "КАБИНЕТИ ҶӮЯНДАИ КОР"],
    ["Ishlar", "Вакансии", "Jobs", "Жұмыстар", "Жумуштар", "Корҳо"],
    ["Kuniga", "В день", "Per day", "Күніне", "Күнүнө", "Дар як рӯз"],
    ["soatiga", "в час", "per hour", "сағатына", "саатына", "дар як соат"],
    ["so‘m", "сум", "UZS", "сум", "сом", "сӯм"],
    ["Ariza holati", "Статус заявки", "Application status", "Өтінім күйі", "Арыздын абалы", "Ҳолати дархост"],
    ["Yangi ariza", "Новая заявка", "New application", "Жаңа өтінім", "Жаңы арыз", "Дархости нав"],
    ["Ko‘rib chiqilmoqda", "На рассмотрении", "Under review", "Қаралуда", "Каралууда", "Дар баррасӣ"],
    ["Arxiv", "Архив", "Archive", "Мұрағат", "Архив", "Бойгонӣ"],
    ["Faol arizalar", "Активные заявки", "Active applications", "Белсенді өтінімдер", "Активдүү арыздар", "Дархостҳои фаъол"],
    ["Saqlangan ishlar", "Сохранённые вакансии", "Saved jobs", "Сақталған жұмыстар", "Сакталган жумуштар", "Корҳои захирашуда"],
    ["Mening e’lonlarim", "Мои вакансии", "My job posts", "Менің вакансияларым", "Менин вакансияларым", "Эълонҳои ман"],
    ["Hisobni muzlatish", "Заморозить аккаунт", "Freeze account", "Аккаунтты тоқтату", "Аккаунтту тоңдуруу", "Боздоштани ҳисоб"],
    ["Muzlatish", "Заморозить", "Freeze", "Тоқтату", "Тоңдуруу", "Боздоштан"],
    ["Butunlay o‘chirish", "Удалить навсегда", "Delete permanently", "Біржола жою", "Биротоло өчүрүү", "Доимӣ нест кардан"],
    ["Chiqish", "Выйти", "Sign out", "Шығу", "Чыгуу", "Баромадан"],
    ["Kunduzgi", "Дневная", "Light", "Күндізгі", "Күндүзгү", "Рӯзона"],
    ["Tungi", "Ночная", "Dark", "Түнгі", "Түнкү", "Шабона"],
    ["Tizim bo‘yicha", "Системная", "System", "Жүйе бойынша", "Тутум боюнча", "Мувофиқи низом"]
  ];
  const languages = ["uz", "ru", "en", "kk", "ky", "tj"], dictionaries = Object.fromEntries(languages.map(lang => [lang, {}]));
  for (const row of dictionaryRows) languages.forEach((lang, i) => { if (row[i]) dictionaries[lang][row[0]] = row[i]; });
  function translateTree(root, lang) {
    if (lang === "uz") {
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) { const node = walk.currentNode; if (originalText.has(node) && node.nodeValue !== originalText.get(node)) node.nodeValue = originalText.get(node); }
      root.querySelectorAll?.("[placeholder],[aria-label],[title]").forEach(el => { const originals = originalAttrs.get(el); if (originals) for (const attr of Object.keys(originals)) if (el.getAttribute(attr) !== originals[attr]) el.setAttribute(attr, originals[attr]); });
      return;
    }
    const map = dictionaries[lang] || dictionaries.uz;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test(node.parentElement?.tagName || "")) continue;
      if (!originalText.has(node)) originalText.set(node, node.nodeValue);
      const source = originalText.get(node), trimmed = source.trim(), value = map[trimmed];
      if (value) { const translated = source.replace(trimmed, value); if (node.nodeValue !== translated) node.nodeValue = translated; }
    }
    root.querySelectorAll?.("[placeholder],[aria-label],[title]").forEach(el => {
      let originals = originalAttrs.get(el); if (!originals) { originals = {}; originalAttrs.set(el, originals); }
      for (const attr of ["placeholder", "aria-label", "title"]) if (el.hasAttribute(attr)) { if (!(attr in originals)) originals[attr] = el.getAttribute(attr); const value = map[originals[attr]]; if (value && el.getAttribute(attr) !== value) el.setAttribute(attr, value); }
    });
  }
  window.applyPayworkLanguage = lang => {
    if (!languages.includes(lang)) lang = "uz";
    localStorage.setItem("paywork_language", lang); document.documentElement.lang = lang; translateTree(document.body, lang);
  };
  window.setPayworkLanguage = lang => window.applyPayworkLanguage(lang);
  window.applyPayworkTheme = () => {
    const mode = localStorage.getItem("paywork_theme") || "system", dark = mode === "night" || (mode === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    document.body.classList.toggle("theme-night", !!dark);
    document.querySelectorAll("[data-theme-choice]").forEach(button => button.classList.toggle("active", button.dataset.themeChoice === mode));
  };
  const themeMedia = window.matchMedia?.("(prefers-color-scheme: dark)"); themeMedia?.addEventListener?.("change", () => { if ((localStorage.getItem("paywork_theme") || "system") === "system") window.applyPayworkTheme(); });
  window.payworkOriginalText = originalText;
  document.addEventListener("DOMContentLoaded", () => {});
  translateTree(document.body, localStorage.getItem("paywork_language") || "uz"); window.applyPayworkTheme();
  new MutationObserver(records => {
    const lang = localStorage.getItem("paywork_language") || "uz"; if (lang === "uz") return;
    for (const record of records) {
      if (record.type === "characterData") translateTree(record.target.parentElement, lang);
      else for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) translateTree(node, lang); else if (node.nodeType === Node.TEXT_NODE && node.parentElement && !/^(SCRIPT|STYLE)$/.test(node.parentElement.tagName)) translateTree(node.parentElement, lang);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
