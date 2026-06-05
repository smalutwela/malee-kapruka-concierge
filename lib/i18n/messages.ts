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
    tagline: "Kapruka Gift Concierge",
    liveCatalogue: "Live catalogue",
  },
  controls: {
    changeTheme: "Change theme",
    changeLanguage: "Change language",
    send: "Send",
    openCart: "Open your gift cart",
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
      "Your Kapruka gift concierge. Tell me who you're spoiling and where it's going — I'll find something lovely and get it delivered anywhere in Sri Lanka.",
    occasions: {
      birthday: "Birthday",
      anniversary: "Anniversary",
      avurudu: "Avurudu",
      getWell: "Get well soon",
      love: "Love & romance",
      newBaby: "New baby",
      justBecause: "Just because",
    },
    examples: [
      "Birthday flowers for my amma in Colombo, under Rs 6,000",
      "A cake delivered to Kandy this Friday",
      "A romantic anniversary gift with chocolates",
    ],
  },
  composer: {
    placeholder: "Message Malee… (e.g. flowers for my amma in Galle)",
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
  cart: {
    title: "Your gift",
    label: "Gift",
    emptyPre: "Your gift is empty. Ask Malee for ideas, then tap ",
    emptyPost: ".",
    clear: "Clear gift",
    subtotal: "Subtotal",
    checkout: "Check out with Malee",
    deliveryNote: "+ delivery, calculated at checkout",
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
    addToGift: "Add to gift",
    added: "Added",
    details: "Details",
    viewOnKapruka: "View on Kapruka",
    deliveryTo: (city: string) => `Delivery to ${city}`,
    available: "available",
    notAvailable: "not available",
    deliveryFee: "Delivery fee",
    nextAvailable: "Next available:",
    orderReady: "Your gift is ready to send",
    items: "Items",
    delivery: "Delivery",
    addons: "Add-ons",
    total: "Total",
    paySecurely: "Pay securely on Kapruka",
    linkExpired: "Payment link expired",
    priceLocked: (time: string) => `Price locked — link expires in ${time}`,
    freshLink: "Ask Malee to create a fresh link.",
  },
  // Quick-action templates — these are sent to Malee as if the shopper typed them,
  // and shown as user bubbles, so they're localized too. Interpolated values
  // (product id/name, city, category) come from the live catalogue and stay as-is.
  prompts: {
    occasion: (occasion: string) => `I'm looking for a ${occasion.toLowerCase()} gift.`,
    productDetails: (id: string, name: string) =>
      `Tell me more about product ${id} ("${name}").`,
    deliverTo: (city: string) => `Can you deliver to ${city}?`,
    categoryIdeas: (name: string) => `Show me some ${name} gift ideas.`,
    checkout: "I'm ready to check out and send these gifts — let's do it.",
  },
};

export type Messages = typeof en;

const si: Messages = {
  header: {
    tagline: "Kapruka තෑගි උපදේශක",
    liveCatalogue: "සජීවී නාමාවලිය",
  },
  controls: {
    changeTheme: "තේමාව වෙනස් කරන්න",
    changeLanguage: "භාෂාව වෙනස් කරන්න",
    send: "යවන්න",
    openCart: "ඔබේ තෑගි කරත්තය විවෘත කරන්න",
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
      "ඔබේ Kapruka තෑගි උපදේශක. ඔබ සතුටු කරන්නේ කාවද, තෑග්ග යන්නේ කොහේටද කියන්න — මම ලස්සන දෙයක් හොයලා ශ්‍රී ලංකාවේ ඕනෑම තැනකට ගෙන්වා දෙන්නම්.",
    occasions: {
      birthday: "උපන්දිනය",
      anniversary: "සංවත්සරය",
      avurudu: "අවුරුද්ද",
      getWell: "ඉක්මනින් සුව වෙන්න",
      love: "ආදරය",
      newBaby: "අලුත් බබා",
      justBecause: "නිකම්ම",
    },
    examples: [
      "කොළඹ ඉන්න මගේ අම්මට උපන්දින මල්, රු. 6,000ට අඩුවෙන්",
      "මේ සිකුරාදා මහනුවරට කේක් එකක්",
      "චොකලට් එක්ක රොමෑන්ටික් සංවත්සර තෑග්ගක්",
    ],
  },
  composer: {
    placeholder: "Malee හට පණිවිඩයක්… (උදා: ගාල්ලේ අම්මට මල්)",
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
  cart: {
    title: "ඔබේ තෑග්ග",
    label: "තෑග්ග",
    emptyPre: "ඔබේ තෑග්ග හිස්. Malee ගෙන් අදහස් අහලා, ",
    emptyPost: " ඔබන්න.",
    clear: "තෑග්ග හිස් කරන්න",
    subtotal: "උප එකතුව",
    checkout: "Malee සමඟ ඇණවුම සම්පූර්ණ කරන්න",
    deliveryNote: "+ බෙදාහැරීම, ඇණවුමේදී ගණනය වේ",
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
    addToGift: "තෑග්ගට එක් කරන්න",
    added: "එක් කළා",
    details: "විස්තර",
    viewOnKapruka: "Kapruka හි බලන්න",
    deliveryTo: (city: string) => `${city} වෙත බෙදාහැරීම`,
    available: "තිබේ",
    notAvailable: "නැත",
    deliveryFee: "බෙදාහැරීම් ගාස්තුව",
    nextAvailable: "ඊළඟට තිබෙන දිනය:",
    orderReady: "ඔබේ තෑග්ග යැවීමට සූදානම්",
    items: "භාණ්ඩ",
    delivery: "බෙදාහැරීම",
    addons: "අමතර",
    total: "එකතුව",
    paySecurely: "Kapruka හි ආරක්ෂිතව ගෙවන්න",
    linkExpired: "ගෙවීම් සබැඳිය කල් ඉකුත් විය",
    priceLocked: (time: string) => `මිල සුරක්ෂිතයි — සබැඳිය ${time} කින් කල් ඉකුත් වේ`,
    freshLink: "අලුත් සබැඳියක් සඳහා Malee ගෙන් අසන්න.",
  },
  prompts: {
    occasion: (occasion: string) => `මට ${occasion} තෑග්ගක් ඕන.`,
    productDetails: (id: string, name: string) =>
      `${id} නිෂ්පාදනය ("${name}") ගැන විස්තර කියන්න.`,
    deliverTo: (city: string) => `${city} වෙත බෙදාහැරිය හැකිද?`,
    categoryIdeas: (name: string) => `${name} තෑගි අදහස් කිහිපයක් පෙන්වන්න.`,
    checkout: "මම ඇණවුම සම්පූර්ණ කර මේ තෑගි යවන්න සූදානම් — අපි කරමු.",
  },
};

const ta: Messages = {
  header: {
    tagline: "Kapruka பரிசு உதவியாளர்",
    liveCatalogue: "நேரடி பட்டியல்",
  },
  controls: {
    changeTheme: "தீம் மாற்று",
    changeLanguage: "மொழியை மாற்று",
    send: "அனுப்பு",
    openCart: "உங்கள் பரிசு வண்டியைத் திற",
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
      "உங்கள் Kapruka பரிசு உதவியாளர். யாரை மகிழ்விக்கிறீர்கள், எங்கே அனுப்ப வேண்டும் என்று சொல்லுங்கள் — நான் அழகான ஒன்றைக் கண்டுபிடித்து இலங்கையில் எங்கும் வழங்குகிறேன்.",
    occasions: {
      birthday: "பிறந்தநாள்",
      anniversary: "ஆண்டுவிழா",
      avurudu: "புத்தாண்டு",
      getWell: "விரைவில் குணமடைய",
      love: "காதல்",
      newBaby: "புதிய குழந்தை",
      justBecause: "சும்மா",
    },
    examples: [
      "கொழும்பில் இருக்கும் என் அம்மாவுக்கு பிறந்தநாள் மலர்கள், ரூ. 6,000க்கு கீழ்",
      "இந்த வெள்ளிக்கிழமை கண்டிக்கு ஒரு கேக்",
      "சாக்லேட்டுடன் ஒரு காதல் ஆண்டுவிழா பரிசு",
    ],
  },
  composer: {
    placeholder: "Malee க்கு செய்தி… (எ.கா: காலியில் அம்மாவுக்கு மலர்கள்)",
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
  cart: {
    title: "உங்கள் பரிசு",
    label: "பரிசு",
    emptyPre: "உங்கள் பரிசு காலியாக உள்ளது. Malee இடம் யோசனைகளைக் கேட்டு, ",
    emptyPost: " என்பதைத் தட்டுங்கள்.",
    clear: "பரிசை அழி",
    subtotal: "கூட்டுத்தொகை",
    checkout: "Malee உடன் செக் அவுட் செய்",
    deliveryNote: "+ விநியோகம், செக்அவுட்டில் கணக்கிடப்படும்",
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
    addToGift: "பரிசில் சேர்",
    added: "சேர்க்கப்பட்டது",
    details: "விவரங்கள்",
    viewOnKapruka: "Kapruka இல் பார்",
    deliveryTo: (city: string) => `${city}க்கு விநியோகம்`,
    available: "கிடைக்கும்",
    notAvailable: "கிடைக்காது",
    deliveryFee: "விநியோகக் கட்டணம்",
    nextAvailable: "அடுத்து கிடைக்கும் நாள்:",
    orderReady: "உங்கள் பரிசு அனுப்பத் தயார்",
    items: "பொருட்கள்",
    delivery: "விநியோகம்",
    addons: "கூடுதல்",
    total: "மொத்தம்",
    paySecurely: "Kapruka இல் பாதுகாப்பாக செலுத்து",
    linkExpired: "கட்டண இணைப்பு காலாவதியானது",
    priceLocked: (time: string) => `விலை பூட்டப்பட்டது — இணைப்பு ${time} இல் காலாவதியாகும்`,
    freshLink: "புதிய இணைப்புக்கு Malee இடம் கேளுங்கள்.",
  },
  prompts: {
    occasion: (occasion: string) => `எனக்கு ஒரு ${occasion} பரிசு வேண்டும்.`,
    productDetails: (id: string, name: string) =>
      `${id} தயாரிப்பு ("${name}") பற்றி மேலும் சொல்லுங்கள்.`,
    deliverTo: (city: string) => `${city}க்கு விநியோகிக்க முடியுமா?`,
    categoryIdeas: (name: string) => `சில ${name} பரிசு யோசனைகளைக் காட்டுங்கள்.`,
    checkout: "நான் செக் அவுட் செய்து இந்தப் பரிசுகளை அனுப்பத் தயார் — செய்வோம்.",
  },
};

export const MESSAGES: Record<Locale, Messages> = { en, si, ta };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
