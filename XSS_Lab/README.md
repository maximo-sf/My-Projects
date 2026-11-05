<div align="center">

# 🧪 CampusBoard — Local XSS Training Lab

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Security](https://img.shields.io/badge/Security-XSS_Lab-red?style=for-the-badge&logo=imperva&logoColor=white)

<p align="center">
  <b>Un entorno de entrenamiento local e interactivo para comprender y prevenir vulnerabilidades de tipo Cross-Site Scripting (XSS Reflejado/DOM-based).</b>
</p>

</div>

---

## 📌 ¿De qué trata este laboratorio?

**CampusBoard** es una demostración didáctica orientada a la ciberseguridad web. Permite observar en tiempo real la diferencia fundamental entre renderizar entradas de usuario de forma **insegura** (`innerHTML`) frente a procesarlas de forma **segura** (`textContent`).

> 🔒 **100% Seguro & Local:** Este laboratorio corre exclusivamente en el navegador. No realiza peticiones de red, no utiliza cookies, no guarda datos en servidores ni persiste información.

---

## 🛠️ Tecnologías y Estructura

El proyecto ha sido refactorizado para seguir las mejores prácticas de desarrollo web, separando la capa de estructura, diseño y lógica:

```text
├── index.html     # Estructura semántica de la aplicación
├── styles.css     # Estilos en modo oscuro con variables CSS
└── script.js      # Lógica interactiva y manipulaciones del DOM