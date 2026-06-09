/**
 * UI string dictionaries for Malee — English (source of truth), Sinhala, Tamil.
 *
 * The English object defines the shape; `si` and `ta` are typed as `Messages`,
 * so TypeScript flags any missing/extra key or mismatched function signature.
 * Interpolated strings are small functions rather than a template mini-language.
 *
 * Proper nouns (Malee, Kapruka, Avurudu, Ayubowan, "Rs") and live catalogue
 * data (product names, categories, cities) are intentionally left as-is — the
 * Kapruka catalogue is English, so we never machine-translate its content.
 */

import type { Locale } from "./config";

const en = {
  header: {
    tagline: "Kapruka Shopping Concierge",
    liveCatalogue: "Live catalogue",
  },
  controls: {
    changeTheme: "Change theme",
    changeLanguage: "Change language",
    newChat: "New chat",
    send: "Send",
    openCart: "Open your cart",
    close: "Close",
    decreaseQty: "Decrease quantity",
    increaseQty: "Increase quantity",
    remove: "Remove",
  },
  themes: {
    light: "Light",
    dark: "Dark",
    warm: "Warm",
  },
  welcome: {
    // Rendered as: {greetingPre}<i>Malee</i>{greetingPost}
    greetingPre: "Ayubowan! I'm ",
    greetingPost: " 🌸",
    subtitle:
      "Your Kapruka shopping concierge — groceries, gadgets, home, beauty, or the perfect gift to send. Tell me what you need and where it's going; I'll find it and get it delivered anywhere in Sri Lanka.",
    // Shopping modes shown as quick-start chips. Everyday self-shopping leads;
    // gifting is one mode among many.
    modes: {
      groceries: "Groceries",
      electronics: "Electronics",
      home: "Home & kitchen",
      beauty: "Health & beauty",
      fashion: "Fashion",
      baby: "Baby & kids",
      gift: "Send a gift",
    },
    examples: [
      "Restock my kitchen — rice, dhal, tea and coconut milk",
      "A good blender under Rs 15,000",
      "My girlfriend just broke up with me — I want to send her flowers",
    ],
  },
  composer: {
    placeholder: "Message Malee… (e.g. restock my kitchen, or flowers for amma)",
    footer:
      "Malee searches the live Kapruka catalogue, quotes delivery, and can place your order.",
  },
  tools: {
    searchProducts: "Searching the Kapruka catalogue…",
    getProduct: "Fetching the details…",
    listCategories: "Browsing categories…",
    listDeliveryCities: "Looking up delivery areas…",
    checkDelivery: "Checking delivery…",
    createOrder: "Preparing your order…",
    trackOrder: "Tracking your order…",
    working: "Working…",
  },
  // The tool loop is presented as a little team of specialists at work, so the
  // experience feels like more than one search box. Labels are localized; the
  // tool→specialist mapping + emoji live in components/chat.tsx.
  specialists: {
    shopper: "Shopper",
    logistics: "Logistics",
  },
  cart: {
    title: "Your cart",
    label: "Cart",
    emptyPre: "Your cart is empty. Ask Malee for ideas, then tap ",
    emptyPost: ".",
    clear: "Clear cart",
    subtotal: "Subtotal",
    checkout: "Continue to delivery",
    deliveryNote: "+ delivery, calculated next",
    suggestAddons: "What goes well with this?",
  },
  // Order history + saved buyer details (the account drawer). Stored only in
  // the browser; powers one-tap reordering and faster repeat checkout.
  account: {
    title: "Your orders & details",
    open: "Orders",
    detailsTitle: "Your details",
    detailsHint: "Saved on this device only, to speed up your next checkout.",
    namePh: "Name",
    phonePh: "Phone",
    addressPh: "Address",
    cityPh: "City",
    save: "Save details",
    edit: "Edit",
    clearDetails: "Clear",
    ordersTitle: "Past orders",
    noOrders: "No orders yet — once you order with Malee, it lands here to reorder in a tap.",
    reorder: "Reorder",
    pay: "Pay now",
    payExpired: "Link expired",
    track: "Track",
    orderedOn: (date: string) => `Ordered ${date}`,
    clearOrders: "Clear history",
  },
  errors: {
    generic: "Something went wrong.",
    tryAgain: "Try again",
    toolStep: "Something went wrong with that step.",
    toolPrefix: "I couldn't complete that — ",
  },
  cards: {
    outOfStock: "Out of stock",
    lowStock: "Only a few left",
    inStock: "In stock",
    shipsWorldwide: "Ships worldwide",
    addToCart: "Add to cart",
    added: "Added",
    details: "Details",
    viewOnKapruka: "View on Kapruka",
    deliveryTo: (city: string) => `Delivery to ${city}`,
    available: "available",
    notAvailable: "not available",
    deliveryFee: "Delivery fee",
    nextAvailable: "Next available:",
    orderReady: "Your order is ready",
    items: "Items",
    delivery: "Delivery",
    addons: "Add-ons",
    total: "Total",
    paySecurely: "Pay securely on Kapruka",
    linkExpired: "Payment link expired",
    priceLocked: (time: string) => `Price locked — link expires in ${time}`,
    freshLink: "Ask Malee to create a fresh link.",
    guestCheckoutNote: "Guest checkout — no account needed, paid securely on Kapruka.",
  },
  // Quick-action templates — these are sent to Malee as if the shopper typed them,
  // and shown as user bubbles, so they're localized too. Interpolated values
  // (product id/name, city, category) come from the live catalogue and stay as-is.
  prompts: {
    mode: {
      groceries: "I want to do a grocery run — help me stock up on essentials.",
      electronics: "Show me some electronics and gadgets.",
      home: "I'm shopping for my home and kitchen.",
      beauty: "Show me some health and beauty picks.",
      fashion: "I'm looking for some fashion and clothing.",
      baby: "I need a few baby and kids items.",
      gift: "I'd like to send a gift to someone special.",
    },
    productDetails: (id: string, name: string) =>
      `Tell me more about product ${id} ("${name}").`,
    deliverTo: (city: string) => `Can you deliver to ${city}?`,
    categoryIdeas: (name: string) => `Show me some ${name}.`,
    checkout: "I'm ready to check out — let's do it.",
    track: "I'd like to track an order.",
    pairWithCart: "What goes well with what's in my cart? Suggest a couple of add-ons.",
  },
};

export type Messages = typeof en;

const si: Messages = {
  header: {
    tagline: "Kapruka සාප්පු උපදේශක",
    liveCatalogue: "සජීවී නාමාවලිය",
  },
  controls: {
    changeTheme: "තේමාව වෙනස් කරන්න",
    changeLanguage: "භාෂාව වෙනස් කරන්න",
    newChat: "අලුත් කතාබහක්",
    send: "යවන්න",
    openCart: "ඔබේ කරත්තය විවෘත කරන්න",
    close: "වසන්න",
    decreaseQty: "ප්‍රමාණය අඩු කරන්න",
    increaseQty: "ප්‍රමාණය වැඩි කරන්න",
    remove: "ඉවත් කරන්න",
  },
  themes: {
    light: "එළිය",
    dark: "අඳුර",
    warm: "උණුසුම්",
  },
  welcome: {
    greetingPre: "ආයුබෝවන්! මම ",
    greetingPost: " 🌸",
    subtitle:
      "ඔබේ Kapruka සාප්පු උපදේශක — සිල්ලර බඩු, උපකරණ, ගේදොර, රූපලාවණ්‍ය, නැත්නම් යවන්න ලස්සන තෑග්ගක්. ඔබට ඕන මොකක්ද කොහේටද කියන්න; මම හොයලා ශ්‍රී ලංකාවේ ඕනෑම තැනකට ගෙන්වා දෙන්නම්.",
    modes: {
      groceries: "සිල්ලර බඩු",
      electronics: "ඉලෙක්ට්‍රොනික්",
      home: "නිවස හා කුස්සිය",
      beauty: "සෞඛ්‍ය හා රූපලාවණ්‍ය",
      fashion: "විලාසිතා",
      baby: "ළදරු හා ළමා",
      gift: "තෑග්ගක් යවන්න",
    },
    examples: [
      "මගේ කුස්සිය නැවත පුරවන්න — හාල්, පරිප්පු, තේ සහ පොල් කිරි",
      "රු. 15,000ට අඩු හොඳ බ්ලෙන්ඩරයක්",
      "මගේ ගර්ල්ෆ්‍රෙන්ඩ් මාත් එක්ක බිඳිලා — එයාට මල් යවන්න ඕන",
    ],
  },
  composer: {
    placeholder: "Malee හට පණිවිඩයක්… (උදා: කුස්සිය පුරවන්න, නැත්නම් අම්මට මල්)",
    footer:
      "Malee සජීවී Kapruka නාමාවලිය සොයා, බෙදාහැරීම් ගාස්තු ගණනය කර, ඔබේ ඇණවුමද ලබා දෙයි.",
  },
  tools: {
    searchProducts: "Kapruka නාමාවලිය සොයමින්…",
    getProduct: "විස්තර ලබා ගනිමින්…",
    listCategories: "කාණ්ඩ බලමින්…",
    listDeliveryCities: "බෙදාහැරීම් ප්‍රදේශ සොයමින්…",
    checkDelivery: "බෙදාහැරීම පරීක්ෂා කරමින්…",
    createOrder: "ඔබේ ඇණවුම සූදානම් කරමින්…",
    trackOrder: "ඔබේ ඇණවුම සොයමින්…",
    working: "වැඩ කරමින්…",
  },
  specialists: {
    shopper: "සාප්පුකරු",
    logistics: "බෙදාහැරීම",
  },
  cart: {
    title: "ඔබේ කරත්තය",
    label: "කරත්තය",
    emptyPre: "ඔබේ කරත්තය හිස්. Malee ගෙන් අදහස් අහලා, ",
    emptyPost: " ඔබන්න.",
    clear: "කරත්තය හිස් කරන්න",
    subtotal: "උප එකතුව",
    checkout: "බෙදාහැරීමට යමු",
    deliveryNote: "+ බෙදාහැරීම, මීළඟට ගණනය වේ",
    suggestAddons: "මේවාට ගැලපෙන්නේ මොනවද?",
  },
  account: {
    title: "ඔබේ ඇණවුම් සහ විස්තර",
    open: "ඇණවුම්",
    detailsTitle: "ඔබේ විස්තර",
    detailsHint: "මෙම උපාංගයේ පමණක් සුරැකේ — ඊළඟ ඇණවුම ඉක්මන් කිරීමට.",
    namePh: "නම",
    phonePh: "දුරකථනය",
    addressPh: "ලිපිනය",
    cityPh: "නගරය",
    save: "විස්තර සුරකින්න",
    edit: "සංස්කරණය",
    clearDetails: "ඉවත් කරන්න",
    ordersTitle: "පෙර ඇණවුම්",
    noOrders: "තවම ඇණවුම් නැත — Malee සමඟ ඇණවුමක් කළ පසු, එය මෙහි පෙනී එක් ස්පර්ශයකින් නැවත ඇණවුම් කළ හැක.",
    reorder: "නැවත ඇණවුම්",
    pay: "දැන් ගෙවන්න",
    payExpired: "සබැඳිය කල් ඉකුත්",
    track: "සොයන්න",
    orderedOn: (date: string) => `ඇණවුම් කළේ ${date}`,
    clearOrders: "ඉතිහාසය හිස් කරන්න",
  },
  errors: {
    generic: "මොකක් හරි වැරදුණා.",
    tryAgain: "නැවත උත්සාහ කරන්න",
    toolStep: "එම පියවරේදී මොකක් හරි වැරදුණා.",
    toolPrefix: "මට ඒක සම්පූර්ණ කරන්න බැරි වුණා — ",
  },
  cards: {
    outOfStock: "තොගයේ නැත",
    lowStock: "ඉතුරු ටිකයි",
    inStock: "තොගයේ ඇත",
    shipsWorldwide: "ලොව පුරා බෙදා හරී",
    addToCart: "කරත්තයට එක් කරන්න",
    added: "එක් කළා",
    details: "විස්තර",
    viewOnKapruka: "Kapruka හි බලන්න",
    deliveryTo: (city: string) => `${city} වෙත බෙදාහැරීම`,
    available: "තිබේ",
    notAvailable: "නැත",
    deliveryFee: "බෙදාහැරීම් ගාස්තුව",
    nextAvailable: "ඊළඟට තිබෙන දිනය:",
    orderReady: "ඔබේ ඇණවුම සූදානම්",
    items: "භාණ්ඩ",
    delivery: "බෙදාහැරීම",
    addons: "අමතර",
    total: "එකතුව",
    paySecurely: "Kapruka හි ආරක්ෂිතව ගෙවන්න",
    linkExpired: "ගෙවීම් සබැඳිය කල් ඉකුත් විය",
    priceLocked: (time: string) => `මිල සුරක්ෂිතයි — සබැඳිය ${time} කින් කල් ඉකුත් වේ`,
    freshLink: "අලුත් සබැඳියක් සඳහා Malee ගෙන් අසන්න.",
    guestCheckoutNote: "ආගන්තුක ගෙවීම — ගිණුමක් අවශ්‍ය නැත, Kapruka හි ආරක්ෂිතව ගෙවේ.",
  },
  prompts: {
    mode: {
      groceries: "මට සිල්ලර බඩු ටිකක් ඕන — අත්‍යවශ්‍ය දේවල් ටික පුරවගන්න උදව් කරන්න.",
      electronics: "ඉලෙක්ට්‍රොනික් උපකරණ ටිකක් පෙන්වන්න.",
      home: "මම ගෙදරට සහ කුස්සියට බඩු ගන්නවා.",
      beauty: "සෞඛ්‍ය හා රූපලාවණ්‍ය නිෂ්පාදන ටිකක් පෙන්වන්න.",
      fashion: "මට විලාසිතා ඇඳුම් ටිකක් ඕන.",
      baby: "මට බබාට හා ළමයින්ට බඩු ටිකක් ඕන.",
      gift: "මට කෙනෙකුට විශේෂ තෑග්ගක් යවන්න ඕන.",
    },
    productDetails: (id: string, name: string) =>
      `${id} නිෂ්පාදනය ("${name}") ගැන විස්තර කියන්න.`,
    deliverTo: (city: string) => `${city} වෙත බෙදාහැරිය හැකිද?`,
    categoryIdeas: (name: string) => `${name} ටිකක් පෙන්වන්න.`,
    checkout: "මම ඇණවුම සම්පූර්ණ කරන්න සූදානම් — අපි කරමු.",
    track: "මට ඇණවුමක් සොයන්න ඕන.",
    pairWithCart: "මගේ කරත්තයේ තියෙන දේවලට ගැලපෙන දේවල් මොනවද? එකතු කරන්න දේවල් කීපයක් යෝජනා කරන්න.",
  },
};

const ta: Messages = {
  header: {
    tagline: "Kapruka ஷாப்பிங் உதவியாளர்",
    liveCatalogue: "நேரடி பட்டியல்",
  },
  controls: {
    changeTheme: "தீம் மாற்று",
    changeLanguage: "மொழியை மாற்று",
    newChat: "புதிய அரட்டை",
    send: "அனுப்பு",
    openCart: "உங்கள் வண்டியைத் திற",
    close: "மூடு",
    decreaseQty: "அளவைக் குறை",
    increaseQty: "அளவை அதிகரி",
    remove: "அகற்று",
  },
  themes: {
    light: "ஒளி",
    dark: "இருள்",
    warm: "சூடு",
  },
  welcome: {
    greetingPre: "ஆயுபோவன்! நான் ",
    greetingPost: " 🌸",
    subtitle:
      "உங்கள் Kapruka ஷாப்பிங் உதவியாளர் — மளிகை, சாதனங்கள், வீட்டுப் பொருட்கள், அழகு, அல்லது அனுப்ப ஒரு அழகான பரிசு. உங்களுக்கு என்ன வேண்டும், எங்கே என்று சொல்லுங்கள்; நான் கண்டுபிடித்து இலங்கையில் எங்கும் வழங்குகிறேன்.",
    modes: {
      groceries: "மளிகை",
      electronics: "எலெக்ட்ரானிக்ஸ்",
      home: "வீடு & சமையல்",
      beauty: "சுகாதாரம் & அழகு",
      fashion: "ஆடை & ஃபேஷன்",
      baby: "குழந்தை & சிறுவர்",
      gift: "பரிசு அனுப்பு",
    },
    examples: [
      "என் சமையலறையை நிரப்ப — அரிசி, பருப்பு, தேயிலை, தேங்காய் பால்",
      "ரூ. 15,000க்கு கீழ் ஒரு நல்ல பிளெண்டர்",
      "என் காதலியுடன் பிரிந்துவிட்டேன் — அவளுக்கு மலர்கள் அனுப்ப விரும்புகிறேன்",
    ],
  },
  composer: {
    placeholder: "Malee க்கு செய்தி… (எ.கா: சமையலறையை நிரப்பு, அல்லது அம்மாவுக்கு மலர்கள்)",
    footer:
      "Malee நேரடி Kapruka பட்டியலில் தேடி, விநியோகக் கட்டணத்தைக் கணித்து, உங்கள் ஆர்டரையும் வழங்க முடியும்.",
  },
  tools: {
    searchProducts: "Kapruka பட்டியலில் தேடுகிறேன்…",
    getProduct: "விவரங்களைப் பெறுகிறேன்…",
    listCategories: "வகைகளைப் பார்க்கிறேன்…",
    listDeliveryCities: "விநியோகப் பகுதிகளைத் தேடுகிறேன்…",
    checkDelivery: "விநியோகத்தைச் சரிபார்க்கிறேன்…",
    createOrder: "உங்கள் ஆர்டரைத் தயாரிக்கிறேன்…",
    trackOrder: "உங்கள் ஆர்டரைக் கண்காணிக்கிறேன்…",
    working: "வேலை செய்கிறேன்…",
  },
  specialists: {
    shopper: "ஷாப்பர்",
    logistics: "விநியோகம்",
  },
  cart: {
    title: "உங்கள் வண்டி",
    label: "வண்டி",
    emptyPre: "உங்கள் வண்டி காலியாக உள்ளது. Malee இடம் யோசனைகளைக் கேட்டு, ",
    emptyPost: " என்பதைத் தட்டுங்கள்.",
    clear: "வண்டியை அழி",
    subtotal: "கூட்டுத்தொகை",
    checkout: "விநியோகத்திற்கு தொடரவும்",
    deliveryNote: "+ விநியோகம், அடுத்து கணக்கிடப்படும்",
    suggestAddons: "இதனுடன் எது பொருந்தும்?",
  },
  account: {
    title: "உங்கள் ஆர்டர்கள் & விவரங்கள்",
    open: "ஆர்டர்கள்",
    detailsTitle: "உங்கள் விவரங்கள்",
    detailsHint: "இந்த சாதனத்தில் மட்டும் சேமிக்கப்படும் — அடுத்த செக்அவுட்டை வேகப்படுத்த.",
    namePh: "பெயர்",
    phonePh: "தொலைபேசி",
    addressPh: "முகவரி",
    cityPh: "நகரம்",
    save: "விவரங்களைச் சேமி",
    edit: "திருத்து",
    clearDetails: "அழி",
    ordersTitle: "முந்தைய ஆர்டர்கள்",
    noOrders: "இன்னும் ஆர்டர்கள் இல்லை — Malee உடன் ஆர்டர் செய்தவுடன், அது இங்கே வந்து ஒரு தட்டலில் மீண்டும் ஆர்டர் செய்யலாம்.",
    reorder: "மீண்டும் ஆர்டர்",
    pay: "இப்போது செலுத்து",
    payExpired: "இணைப்பு காலாவதி",
    track: "கண்காணி",
    orderedOn: (date: string) => `ஆர்டர் செய்தது ${date}`,
    clearOrders: "வரலாற்றை அழி",
  },
  errors: {
    generic: "ஏதோ தவறு நடந்தது.",
    tryAgain: "மீண்டும் முயற்சி செய்",
    toolStep: "அந்தப் படியில் ஏதோ தவறு நடந்தது.",
    toolPrefix: "என்னால் அதை முடிக்க முடியவில்லை — ",
  },
  cards: {
    outOfStock: "கையிருப்பில் இல்லை",
    lowStock: "சில மட்டுமே மீதம்",
    inStock: "கையிருப்பில் உள்ளது",
    shipsWorldwide: "உலகம் முழுவதும் அனுப்பப்படும்",
    addToCart: "வண்டியில் சேர்",
    added: "சேர்க்கப்பட்டது",
    details: "விவரங்கள்",
    viewOnKapruka: "Kapruka இல் பார்",
    deliveryTo: (city: string) => `${city}க்கு விநியோகம்`,
    available: "கிடைக்கும்",
    notAvailable: "கிடைக்காது",
    deliveryFee: "விநியோகக் கட்டணம்",
    nextAvailable: "அடுத்து கிடைக்கும் நாள்:",
    orderReady: "உங்கள் ஆர்டர் தயார்",
    items: "பொருட்கள்",
    delivery: "விநியோகம்",
    addons: "கூடுதல்",
    total: "மொத்தம்",
    paySecurely: "Kapruka இல் பாதுகாப்பாக செலுத்து",
    linkExpired: "கட்டண இணைப்பு காலாவதியானது",
    priceLocked: (time: string) => `விலை பூட்டப்பட்டது — இணைப்பு ${time} இல் காலாவதியாகும்`,
    freshLink: "புதிய இணைப்புக்கு Malee இடம் கேளுங்கள்.",
    guestCheckoutNote: "விருந்தினர் செக்அவுட் — கணக்கு தேவையில்லை, Kapruka இல் பாதுகாப்பாக செலுத்தப்படும்.",
  },
  prompts: {
    mode: {
      groceries: "எனக்கு மளிகை சாமான்கள் வேண்டும் — அத்தியாவசியப் பொருட்களை நிரப்ப உதவுங்கள்.",
      electronics: "சில எலெக்ட்ரானிக் சாதனங்களைக் காட்டுங்கள்.",
      home: "நான் வீட்டுக்கும் சமையலறைக்கும் பொருட்கள் வாங்குகிறேன்.",
      beauty: "சில சுகாதார மற்றும் அழகு பொருட்களைக் காட்டுங்கள்.",
      fashion: "எனக்கு சில ஆடை மற்றும் ஃபேஷன் பொருட்கள் வேண்டும்.",
      baby: "எனக்கு சில குழந்தை மற்றும் சிறுவர் பொருட்கள் வேண்டும்.",
      gift: "நான் ஒருவருக்கு சிறப்பு பரிசு அனுப்ப விரும்புகிறேன்.",
    },
    productDetails: (id: string, name: string) =>
      `${id} தயாரிப்பு ("${name}") பற்றி மேலும் சொல்லுங்கள்.`,
    deliverTo: (city: string) => `${city}க்கு விநியோகிக்க முடியுமா?`,
    categoryIdeas: (name: string) => `சில ${name} காட்டுங்கள்.`,
    checkout: "நான் செக் அவுட் செய்யத் தயார் — செய்வோம்.",
    track: "நான் ஒரு ஆர்டரைக் கண்காணிக்க விரும்புகிறேன்.",
    pairWithCart: "என் வண்டியில் உள்ளவற்றுடன் எது பொருந்தும்? சேர்க்க சில பொருட்களைப் பரிந்துரைக்கவும்.",
  },
};

export const MESSAGES: Record<Locale, Messages> = { en, si, ta };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
