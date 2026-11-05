<div align="center">

# 🧪 CampusBoard — Local XSS Training Lab

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Security](https://img.shields.io/badge/Security-XSS_Lab-red?style=for-the-badge&logo=imperva&logoColor=white)

<p align="center">
  <b>A local, interactive training environment to understand and prevent Cross-Site Scripting (Reflected/DOM-based XSS) vulnerabilities.</b>
</p>

</div>

---

## 📌 What is this lab about?

**CampusBoard** is an educational web security demonstration. It allows you to observe in real-time the key difference between rendering user input **insecurely** (`innerHTML`) versus processing it **securely** (`textContent`).

> 🔒 **100% Safe & Local:** This lab runs exclusively in your browser. It makes no network requests, uses no cookies, stores no data on servers, and does not persist information.

---

## 🎓 How the Lab Works

When testing user input in web applications, the method used to insert text into the Document Object Model (DOM) determines whether code executes or displays safely:

1. **Unsafe Button (`innerHTML`):** 
   * Treats user input as HTML markup. 
   * If a user submits executable code (such as `<script>` tags or inline event handlers), the browser parses and executes it as live code.
2. **Safe Button (`textContent`):** 
   * Treats user input purely as plain text. 
   * Special characters like `<` and `>` are escaped automatically, ensuring scripts are displayed literally and never executed.

---

## 🧪 Injection Payloads & Test Scripts

You can copy and paste any of the following payload examples into the comment box to test how the browser reacts with both buttons:

### 1. Basic Script Tag Injection
```html
<script>alert('XSS Demo Triggered!');</script>