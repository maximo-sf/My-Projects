# 💬 Classroom LAN Chat & File Sharing

A lightweight, real-time web application designed for sharing messages and files over a Local Area Network (LAN) without requiring an active internet connection.

Built specifically for classroom environments where all devices share the same local IP subnet.

## 🧰 Tech Stack

* **Server Runtime:** Node.js
* **Web Framework:** Express.js
* **Real-Time Engine:** Socket.io (WebSockets)
* **File Handling:** Multer
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla)

---

## ⚡ Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v18.0.0 or higher)

### Installation & Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/maximo-sf/Class-LAN-Chat-File-Sharing.git
   cd Class-LAN-Chat-File-Sharing
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

---

## 🌐 Connecting Classmates from the Local Network (LAN)

Note that `http://localhost:3000` only works on the machine hosting the server. To allow classmates on the same Wi-Fi/LAN network to connect:

1. **Find your LAN IP address on the host machine:**
   * **Linux / macOS:** Run `hostname -I` in your terminal.
   * **Windows:** Run `ipconfig` in CMD and check **IPv4 Address**.

2. **Share the connection link:**
   Have everyone on the same network open their web browser and visit:
   ```text
   http://<YOUR-HOST-IP>:3000
   ```
   *(Example: `http://192.168.1.45:3000`)*

3. **Firewall Setup (Linux):**
   If incoming connections are blocked on Linux, allow traffic on port `3000`:
   ```bash
   sudo ufw allow 3000/tcp
   ```

---

## 📁 Project Structure

```text
Class-LAN-Chat-File-Sharing/
├── .github/
│   └── workflows/
│       └── ci.yml      # Continuous Integration workflow
├── public/             # Frontend assets
│   ├── index.html      # Main chat interface
│   └── style.css       # App styling
├── uploads/            # Storage folder for shared files
├── .gitignore          # Excluded files from Git tracking
├── LICENSE             # MIT License file
├── package.json        # Node.js project configuration
├── README.md           # Documentation
└── server.js           # Express + Socket.io backend server
```

---

## ❓ Troubleshooting

* **`Error: Cannot find module 'express'`:** Run `npm install` inside the project folder before running `npm start`.
* **Classmates cannot access the link:** Ensure all devices are connected to the exact same Wi-Fi/LAN network and verify your host machine's firewall permits inbound connections on port `3000`.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
