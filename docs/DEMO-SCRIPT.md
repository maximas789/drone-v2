# Ajniha demo video — script, shot list, and how to record it

A ~2-minute screen recording of the **real app**, with an Arabic voice-over and
English subtitles. Aimed at GACA and at drone-community people.

**Rule for this video: every screen is the real product.** No AI-generated app
footage — a viewer will open the link and compare. An AI-made cinematic opener
(optional, ≤ 8 s, labelled "illustrative") is fine as a separate clip.

> **Have a native Arabic reader check the Arabic lines below before you record.**
> They were written by an AI assistant, not by an Arabic speaker. Change any
> wording that does not sound like you — you are the one saying it.

---

## Before you record (10 minutes)

- [ ] Use a **private/incognito browser window**, so no bookmarks, extensions or saved emails show.
- [ ] Switch the app to **العربية**. Sign in as the pilot for segments 1–3 and 5 (`/ar/drones`, etc.).
- [ ] **Never show** the Profile page, the Settings pages, or the admin "Pilot" section of a drone page — they show your name, phone and ID number. The shot list below avoids them.
- [ ] Turn on **Focus assist / Do not disturb** (Windows 11: `Win + N`, bell icon), so no notification pops up mid-take.
- [ ] Close every other window and browser tab. Zoom the browser to about **125%** (`Ctrl` + `+`) so text is readable on a phone.
- [ ] Quiet room, the microphone about a hand's width from your mouth.
- [ ] Have **one fresh drone to register live** ready: a name (e.g. `FPV Falcon 2`), a photo, weight under 250 g. It will stay in the system as demo data — submitted drones cannot be deleted.

## OBS setup (first time, about 10 minutes)

1. Open OBS. **Settings → Video**: Base and Output resolution `1920x1080`, FPS `30`.
2. **Settings → Output → Recording**: format `mp4` (or `mkv`, then File → Remux), a folder you can find, e.g. `Videos\ajniha-demo`.
3. **Settings → Audio**: set **Mic/Auxiliary Audio** to your microphone.
4. In the **Sources** box press **+** → **Display Capture** (your screen) → OK. (If you only want the browser: **Window Capture**.)
5. Watch the **Audio Mixer**: when you speak, the mic bar must move and stay in the green/yellow, never hit the red.
6. **Record a 10-second test**, stop, open the file, and check you can hear yourself and read the screen. Only then start the real takes.
7. Start / Stop recording: the button at the bottom right of OBS.

**Record one segment per take** (15–25 seconds each, mic on, reading the line as you click). Five short clips are easy to retake; one long clip is not. Join them afterwards in **Clipchamp** (built into Windows 11, free).

---

## Script and shot list

Times are targets. Read at a calm pace; it is fine if a segment runs 5 seconds long.

### 1. The problem — 0:00–0:20 · screen: landing page `/ar`, then scroll to the steps

| | |
|---|---|
| **العربية** | «تسجيل طائرة الدرون يبدأ عادةً برقم تسلسلي من المصنّع. لكنّ طائرات FPV المصنوعة يدوياً ليس لها رقم تسلسلي. فكيف يسجّل طيّاروها طائراتهم؟» |
| **English (subtitle)** | "Registering a drone usually starts with a manufacturer's serial number. A self-built FPV drone has none. So how do its pilots register?" |

### 2. The idea — 0:20–0:35 · screen: `/ar/docs/remote-id` (or the "How Remote ID works" link on the landing page)

| | |
|---|---|
| **العربية** | «أجنحة تحلّ ذلك: بدلاً من الرقم التسلسلي، تحصل الطائرة على هوية عن بُعد، وهو الاتجاه الذي تسير إليه اللوائح.» |
| **English** | "Ajniha fixes that: instead of a serial number, the aircraft gets a Remote ID — the direction the regulations are moving in." |

### 3. Register a drone — 0:35–0:55 · screen: `/ar/drones` → **Add a drone**, fill it live, submit

| | |
|---|---|
| **العربية** | «يسجّل الطيّار طائرته: النوع والوزن والصور. حقل الرقم التسلسلي غير موجود أصلاً للطائرة المصنوعة يدوياً.» |
| **English** | "The pilot enters the aircraft: type, weight, photos. For a self-built drone, the serial number field isn't even shown." |

*Tip: type quickly and pre-choose the photo; cut the waiting in the editor.*

### 4. Human review — 0:55–1:10 · screen: the admin queue `/ar/admin`, open the drone, click **Approve** (do not scroll to the Pilot section)

| | |
|---|---|
| **العربية** | «يراجع مراجعٌ بشري الطلب ويقرّر. لا يوجد تحقق آلي ولا رسائل نصية، وكل قرار يُسجَّل في سجلٍّ لا يمكن تعديله.» |
| **English** | "A human reviewer decides. There is no automatic verification and no SMS, and every decision is written to a log that cannot be edited." |

### 5. The Remote ID and the QR — 1:10–1:30 · screen: `/ar/drones` → the drone → **Remote ID card** (wait for the QR)

| | |
|---|---|
| **العربية** | «عند الموافقة تحصل الطائرة على رقم هوية عن بُعد ورمز QR يُطبع ويُلصق على الهيكل. والرمز يبقى نفسه حتى بعد التجديد.» |
| **English** | "On approval the aircraft gets a Remote ID and a QR code to print and stick on the airframe. The code stays the same even after renewal." |

### 6. The scan — 1:30–1:50 · screen: open the public page for the drone in a **new private window** (`/ar/rid/<the code>`), signed out

| | |
|---|---|
| **العربية** | «أي شخص يمسح الرمز يرى أن التسجيل ساري، دون أن يرى اسم المالك. المراجع المخوَّل وحده يستطيع كشف الهوية، بسببٍ مكتوب، وكل كشف يُسجَّل.» |
| **English** | "Anyone who scans the code sees the registration is valid, without seeing who the owner is. Only an authorised reviewer can reveal identity, with a written reason, and every reveal is logged." |

*Optional, stronger: film your phone scanning the QR off the laptop screen, then cut to the page.*

### 7. Zones and the honest close — 1:50–2:10 · screen: `/ar/zones` (the map), hold on the disclaimer under it

| | |
|---|---|
| **العربية** | «ويستطيع الطيّار حجز منطقة وموعد. والمناطق الظاهرة هنا مؤلَّفة للعرض، وليست مجالاً جوياً رسمياً. أجنحة مقترح مستقل، وليست نظاماً معتمداً من الهيئة العامة للطيران المدني.» |
| **English** | "The pilot can also book an area and a time. The zones shown are authored for the demo, not official airspace. Ajniha is an independent proposal, not a system adopted by the General Authority of Civil Aviation." |

**Last frame (3 seconds):** the address `drone-v2.vercel.app` on a plain background, or the landing page header.

---

## After recording

1. **Clipchamp** (Start menu): import the clips, drop them on the timeline in order, trim the pauses, export **1080p**.
2. **Subtitles:** the English column above is the subtitle text. Either use Clipchamp's **Text** tool per segment, or send me the final video's segment lengths and I will write a `.srt` file to import.
3. Watch it once **on your phone, with the sound off**, to confirm the subtitles are readable.
4. Optional opener (≤ 8 s, clearly "illustrative"): an AI-generated FPV drone flight over a city at dusk. Put it **before** segment 1 and never mix it into the app footage.

## Checklist

- [ ] Native Arabic reader checked the script
- [ ] OBS test clip recorded and checked (sound + picture)
- [ ] Segments 1–7 recorded
- [ ] Edited and exported at 1080p
- [ ] English subtitles added
- [ ] Watched once on a phone, sound off
