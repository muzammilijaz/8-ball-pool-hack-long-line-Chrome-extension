# 🎱 8 Ball Pool Helper — Long Aim Line Chrome Extension

<p align="center">
  <img src="8ball%20-1.png" alt="8 Ball Pool Helper Preview" width="650" style="border-radius: 10px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);" />
</p>

A modern, high-precision Google Chrome extension that provides a real-time aim-guideline overlay for [8ballpool.com](https://8ballpool.com/game). Completely redesigned from the ground up, built on **Manifest V3**, utilizing direct **WebGL frame buffer pixel detection** for automatic cue ball tracking, and featuring custom screen boundary calibration.

<p align="center">
  <a href="https://muzammilijaz.gumroad.com/coffee" target="_blank">
    <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Donate-yellow.svg?style=for-the-badge&logo=buy-me-a-coffee" alt="Buy Me A Coffee" />
  </a>
  &nbsp;&nbsp;
  <a href="https://github.com/muzammilijaz/8-ball-pool-hack-long-line-Chrome-extension.git">
    <img src="https://img.shields.io/badge/GitHub-Repository-blue.svg?style=for-the-badge&logo=github" alt="GitHub Repository" />
  </a>
</p>

---

## 🚀 Key Features

* **Auto Cue Ball Detection**: Injects a custom requestAnimationFrame hook that scans the active WebGL rendering context (`gl.readPixels`) of `canvas#engine`. It automatically identifies the precise 2D screen coordinates of the cue ball cluster in real-time, centering guidelines with sub-pixel accuracy.
* **Extended Aim Guidelines**: Draws a continuous vector trajectory originating from the auto-detected cue ball coordinates, through the current aiming cursor, extending all the way to the table boundaries.
* **Multiple Guide Modes**:
  * 🎯 **Cue Line**: A clean, single aim line projecting from the cue ball toward the pointer.
  * 🕳️ **Pockets**: Draws guide lines connecting all six pockets of the table to your mouse cursor for perfect bank/kick shots.
  * ✨ **Both**: Enables both overlay modes simultaneously for ultimate precision.
* **Dynamic Table Calibration**: Contains built-in sliders in the extension popup (Top, Bottom, Left, Right margins) allowing you to align the virtual overlay borders perfectly with the visible 8 Ball Pool table on any screen resolution.
* **Pointer-Lock Aim Tracking**: Handles instances where the game locks the mouse pointer during aiming. It tracks cursor movements using relative delta signals (`movementX` and `movementY`) to ensure the guideline remains active and responsive.
* **Self-Healing Overlay Canvas**: Watches the DOM structure using `MutationObserver`. If the game reloads, changes tables, or destroys the canvas overlay, the extension seamlessly self-heals and recreates the overlay instantly.
* **Keyboard Toggle Shortcut**: Press the `Shift` key at any point while in-game to instantly toggle the guide lines overlay visibility without opening the popup UI.
* **High-Performance MV3 Architecture**: Dropped the bulky ~1MB `p5.js` dependencies. It's written in clean, optimized Vanilla JS and Web APIs, featuring a lightweight Canvas2D context overlaid with a maximum z-index (`2147483647`).
* **Extension Context Protection**: Implements connection-port heartbeats. Properly tears down canvas overlays, event listeners, and script injections if the extension is reloaded or updated, avoiding runtime context invalidation crashes.

---

## 🛠️ Chrome Extension Installation Guide

Follow these simple steps to install the extension in your Google Chrome browser:

### Step 1: Download the Extension Files
* **Option A (Git)**: Clone the repository to your computer:
  ```bash
  git clone https://github.com/muzammilijaz/8-ball-pool-hack-long-line-Chrome-extension.git
  ```
* **Option B (ZIP)**: Download the repository as a ZIP file from GitHub, extract the contents, and locate the root folder containing `manifest.json`.

### Step 2: Open Extensions Management Page
* Open your Google Chrome browser.
* In the address bar, type **`chrome://extensions/`** and press **Enter** (or go to `Settings` -> `Extensions`).

### Step 3: Enable Developer Mode
* Toggle the **"Developer mode"** switch located in the **top-right corner** of the Extensions page to **ON**.

### Step 4: Load the Unpacked Extension
* Click the **"Load unpacked"** button in the **top-left corner**.
* Select the folder containing `manifest.json` (usually named `8ballhack-master` or `8-ball-pool-hack-long-line-Chrome-extension`).
* The extension **"8 Ball Pool Helper"** will immediately appear in your list of loaded extensions!

---

## 🎮 How to Use & Calibrate

Make the most out of your helper guidelines with these instructions:

### 1. Pin the Extension
* Click the **puzzle piece icon** (Extensions) in the top-right corner of Chrome.
* Click the pin icon next to **8 Ball Pool Helper** to keep it visible on your toolbar.

### 2. Launch the Game
* Go to the official game page: [8ballpool.com/game](https://8ballpool.com/game) (or [8ball.io](https://8ball.io)).
* Click the 🎱 icon on your toolbar. You should see a green dot next to **"Game detected — overlay ready"**.

### 3. Toggle Guide Lines
* Press the **`Shift`** key at any point during gameplay to toggle the aim lines on or off instantly.

### 4. Table Calibration (Crucial for Precision)
If the guide lines or the dashed outline do not align perfectly with your table boundaries:
1. Open the extension popup from your toolbar.
2. Click to expand the **Table Calibration** card.
3. Move the sliders (**Top edge**, **Bottom edge**, **Left edge**, **Right edge**) to position the overlay boundaries directly onto the inner cushions of the pool table.
4. Set your preferred **Line Color** and **Line Opacity** using the customization controls.

---

## ☕ Support the Developer

If this helper helped you win games and level up, consider supporting the development and maintenance of this project!

<p align="left">
  <a href="https://muzammilijaz.gumroad.com/coffee" target="_blank">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="180" style="height: 50px !important;width: 180px !important;" >
  </a>
</p>

---

## 📄 License & Disclaimer

This project is licensed under the MIT License.

**Disclaimer**: This extension is developed for educational, analysis, and helper purposes only. Continuous use of aim helpers in online matchmaking might violate the game's terms of service. Use responsibly.
