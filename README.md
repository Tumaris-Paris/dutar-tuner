# 🎵 Dutar Tuner — دۇتار تەڭشەگۈچ

A free, open-source, bilingual web-based chromatic tuner for the **Dutar** — a traditional two-stringed Uyghur instrument.

Built for the global Uyghur music community. Works on any device with a browser, no app store required.

**Live app:** [https://tumaris-paris.github.io/dutar-tuner](https://tumaris-paris.github.io/dutar-tuner)

---

## ✨ Features

- 🎙️ **Real-time pitch detection** using the Web Audio API and autocorrelation algorithm
- 🎛️ **Three tuning presets** — Standard (D–A), Low (G–D), High (E–B)
- ✏️ **Custom tuning** — enter any frequency in Hz for each string
- 🔊 **Reference tone** — plays the target note so you can tune by ear
- 📐 **Visual needle gauge** — clearly shows flat, sharp, or in tune
- 🌐 **Bilingual** — full English and Uyghur (ئۇيغۇرچە) interface
- 📱 **PWA-ready** — installable on iPhone and Android home screen
- ♿ **Accessible** — ARIA labels, keyboard navigation, reduced-motion support
- 🎨 **Traditional aesthetic** — warm Uyghur-inspired color palette and geometric ornaments

---

## 📁 Project structure

```
dutar-tuner/
├── index.html      # App shell and markup
├── style.css       # All styles (CSS variables, responsive, dark-mode ready)
├── tuner.js        # Pitch detection logic and UI controller
├── manifest.json   # PWA manifest (installable on mobile)
├── icons/          # App icons (192×192 and 512×512 PNG)
│   ├── icon-192.png
│   └── icon-512.png
└── README.md       # This file
```

---

## 🚀 Deployment (GitHub Pages)

This app is a static site — no backend, no build step needed.

### Step 1 — Create a GitHub repo

1. Go to [github.com/new](https://github.com/new)
2. Name it `dutar-tuner`
3. Set it to **Public**
4. Click **Create repository**

### Step 2 — Push the files

```bash
# In the dutar-tuner folder on your computer:
git init
git add .
git commit -m "Initial release: Dutar Tuner v1.0"
git branch -M main
git remote add origin https://github.com/Tumaris-Paris/dutar-tuner.git
git push -u origin main
```

### Step 3 — Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select `main` branch and `/ (root)` folder
3. Click **Save**

Your app will be live at:
```
https://tumaris-paris.github.io/dutar-tuner/
```

It usually takes 1–2 minutes to go live after the first push.

### Step 4 — Install as a mobile app (optional)

**iPhone:** Open the URL in Safari → Share button → "Add to Home Screen"  
**Android:** Open in Chrome → three-dot menu → "Add to Home Screen"

---

## 🎸 About the Dutar

The **Dutar** (دۇتار) is a traditional long-necked two-stringed lute originating from Central Asia, widely played across the Uyghur homeland of Xinjiang and throughout the Uyghur diaspora. The name comes from the Persian *du* (two) and *tar* (string).

### Common tunings

| Preset   | String 1 (thick) | String 2 (thin) | Notes                        |
|----------|------------------|-----------------|------------------------------|
| Standard | D3 (146.8 Hz)    | A3 (220.0 Hz)   | Most common tuning           |
| Low      | G2 (98.0 Hz)     | D3 (146.8 Hz)   | Lower regional variant       |
| High     | E3 (164.8 Hz)    | B3 (246.9 Hz)   | Higher variant               |
| Custom   | Any              | Any             | Enter your own Hz values     |

---

## 🛠️ Technical notes

### Pitch detection

The app uses the **autocorrelation method** to detect fundamental frequency:

1. Raw PCM samples are captured from the microphone at 44,100 Hz
2. Silent frames are skipped using an RMS energy gate
3. The autocorrelation function (ACF) is computed over the buffer
4. The lag T₀ at the maximum ACF peak gives the period of the signal
5. Parabolic interpolation gives sub-sample accuracy
6. Fundamental frequency = `sampleRate / T₀`

Accuracy is approximately **±1–2 cents** in a quiet environment, well within the **±5 cent** "in tune" threshold used in the UI.

### Browser support

| Feature             | Chrome | Firefox | Safari | Edge |
|---------------------|--------|---------|--------|------|
| Web Audio API       | ✅     | ✅      | ✅     | ✅   |
| getUserMedia (mic)  | ✅     | ✅      | ✅     | ✅   |
| PWA / install       | ✅     | ⚠️ partial | ✅ iOS | ✅ |

> **Note:** On iOS, microphone access requires Safari. Chrome on iOS does not support `getUserMedia`.

---

## 🤝 Contributing

Contributions are welcome! Ideas for future improvements:

- [ ] Additional regional Uyghur tunings (مۇقام tunings)
- [ ] Dark mode
- [ ] Uyghur script app icon
- [ ] Audio waveform visualizer
- [ ] Offline support via Service Worker

To contribute:

```bash
git clone https://github.com/Tumaris-Paris/dutar-tuner.git
cd dutar-tuner
# Open index.html in a browser — no build step needed
```

Please open an issue before submitting large changes.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 👩‍💻 Author

**Tumaris Paris**  
GitHub: [@Tumaris-Paris](https://github.com/Tumaris-Paris)

*Made with ♥ for the Uyghur music community — ئۇيغۇر مۇزىكا جەمئىيىتى ئۈچۈن*
