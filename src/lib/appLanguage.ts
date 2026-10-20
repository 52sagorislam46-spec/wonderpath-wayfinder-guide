/** Whole-app translation via the Google Translate website widget. */
export const LANGUAGES: { code: string; label: string }[] = [
  ["en","English"],["bn","বাংলা"],["hi","हिन्दी"],["ur","اردو"],["ar","العربية"],["es","Español"],["fr","Français"],
  ["de","Deutsch"],["pt","Português"],["ru","Русский"],["zh-CN","中文 (简体)"],["zh-TW","中文 (繁體)"],["ja","日本語"],
  ["ko","한국어"],["it","Italiano"],["tr","Türkçe"],["fa","فارسی"],["id","Bahasa Indonesia"],["ms","Bahasa Melayu"],
  ["th","ไทย"],["vi","Tiếng Việt"],["nl","Nederlands"],["pl","Polski"],["uk","Українська"],["ro","Română"],
  ["el","Ελληνικά"],["cs","Čeština"],["sv","Svenska"],["hu","Magyar"],["fi","Suomi"],["da","Dansk"],["no","Norsk"],
  ["he","עברית"],["sk","Slovenčina"],["bg","Български"],["hr","Hrvatski"],["sr","Српски"],["sl","Slovenščina"],
  ["lt","Lietuvių"],["lv","Latviešu"],["et","Eesti"],["is","Íslenska"],["ga","Gaeilge"],["cy","Cymraeg"],
  ["sq","Shqip"],["mk","Македонски"],["bs","Bosanski"],["be","Беларуская"],["ka","ქართული"],["hy","Հայերեն"],
  ["az","Azərbaycan"],["kk","Қазақ"],["uz","Oʻzbek"],["ky","Кыргызча"],["tg","Тоҷикӣ"],["tk","Türkmen"],["mn","Монгол"],
  ["ne","नेपाली"],["si","සිංහල"],["ta","தமிழ்"],["te","తెలుగు"],["ml","മലയാളം"],["kn","ಕನ್ನಡ"],["mr","मराठी"],
  ["gu","ગુજરાતી"],["pa","ਪੰਜਾਬੀ"],["or","ଓଡ଼ିଆ"],["as","অসমীয়া"],["sd","سنڌي"],["ps","پښتو"],["my","မြန်မာ"],
  ["km","ខ្មែរ"],["lo","ລາວ"],["tl","Filipino"],["jw","Basa Jawa"],["su","Basa Sunda"],["sw","Kiswahili"],
  ["am","አማርኛ"],["so","Soomaali"],["ha","Hausa"],["yo","Yorùbá"],["ig","Igbo"],["zu","isiZulu"],["xh","isiXhosa"],
  ["af","Afrikaans"],["mg","Malagasy"],["rw","Kinyarwanda"],["ny","Chichewa"],["sn","Shona"],["st","Sesotho"],
  ["ca","Català"],["eu","Euskara"],["gl","Galego"],["mt","Malti"],["lb","Lëtzebuergesch"],["fy","Frysk"],
  ["co","Corsu"],["la","Latina"],["eo","Esperanto"],["ku","Kurdî"],["ug","ئۇيغۇرچە"],["yi","ייִדיש"],
  ["haw","ʻŌlelo Hawaiʻi"],["sm","Samoan"],["mi","Māori"],["ht","Kreyòl Ayisyen"],["hmn","Hmong"],["ceb","Cebuano"],
].map(([code, label]) => ({ code: code as string, label: label as string }));

export function languageLabel(code: string) {
  return LANGUAGES.find((l) => l.code === code)?.label ?? "English";
}

function setCookie(value: string, expire = false) {
  const exp = expire ? ";expires=Thu, 01 Jan 1970 00:00:00 GMT" : "";
  const host = window.location.hostname;
  document.cookie = `googtrans=${value};path=/${exp}`;
  document.cookie = `googtrans=${value};path=/;domain=${host}${exp}`;
  document.cookie = `googtrans=${value};path=/;domain=.${host.split(".").slice(-2).join(".")}${exp}`;
}

/** Save the chosen language and reload so the whole app switches. */
export function changeLanguage(code: string) {
  try { localStorage.setItem("app_language", code); } catch { /* ignore */ }
  if (code === "en") setCookie("", true);
  else setCookie(`/en/${code}`);
  window.location.reload();
}

/** Call once from useEffect on app start. */
export function initAppLanguage() {
  if (typeof window === "undefined") return;
  let code = "en";
  try { code = localStorage.getItem("app_language") || "en"; } catch { /* ignore */ }
  if (code === "en") return;
  setCookie(`/en/${code}`);
  document.documentElement.lang = code;
  if (document.getElementById("google-translate-script")) return;
  const holder = document.createElement("div");
  holder.id = "google_translate_element";
  holder.style.display = "none";
  document.body.appendChild(holder);
  (window as unknown as Record<string, unknown>)["googleTranslateElementInit"] = () => {
    const g = (window as unknown as { google?: { translate?: { TranslateElement: new (o: object, id: string) => unknown } } }).google;
    if (g?.translate) new g.translate.TranslateElement({ pageLanguage: "en", autoDisplay: false }, "google_translate_element");
  };
  const s = document.createElement("script");
  s.id = "google-translate-script";
  s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  document.body.appendChild(s);
}
