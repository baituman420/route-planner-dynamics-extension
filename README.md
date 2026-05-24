# Route Planner & Dynamics 365 Extension 🚚📍

Una solución integral y autónoma para la planificación y optimización de rutas de reparto. Este sistema está compuesto por una **aplicación web/móvil** y una **extensión para Microsoft Edge** compatible con **Microsoft Dynamics 365**.

---

> [!IMPORTANT]
> ### 🚀 CÓMO USAR Y EVALUAR LA APLICACIÓN AL INSTANTE (Sin Consola ni Comandos)
> Si estás revisando el sistema (¡especialmente pensado para el Jefe!), **no necesitas instalar Node, NPM ni ejecutar comandos de terminal**. Todo el ecosistema ha sido compilado y preparado para utilizarse con un solo click:
>
> 1. 🌐 **[PROBAR APLICACIÓN EN VIVO (Click Aquí)](https://baituman420.github.io/route-planner-dynamics-extension/)**
>    * Abre la aplicación directamente en tu navegador. **Precargará automáticamente una ruta de demostración de Bilbao** (5 paradas de reparto geolocalizadas y optimizadas, listas para simular la entrega). ¡Ideal para ver el mapa interactivo y los gráficos de rendimiento al instante!
>
> 2. 📦 **[DESCARGAR EXTENSIÓN PARA EDGE (ZIP Directo)](https://raw.githubusercontent.com/baituman420/route-planner-dynamics-extension/main/extension.zip)**
>    * Descarga la extensión lista para conectar con **Microsoft Dynamics 365**.
>    * **Cómo instalarla en Edge:**
>      1. Descarga el archivo [extension.zip](https://raw.githubusercontent.com/baituman420/route-planner-dynamics-extension/main/extension.zip) y descomprímelo en tu ordenador (click derecho > *Extraer todo*).
>      2. Abre Microsoft Edge y navega a: `edge://extensions`
>      3. Activa el interruptor **"Modo de desarrollador"** (abajo a la izquierda).
>      4. Haz click en el botón **"Cargar extensión descomprimida"** (arriba a la izquierda) y selecciona la carpeta que acabas de descomprimir.
>      5. ¡Listo! Al abrir Dynamics 365 tendrás el panel lateral inteligente activo y listo para extraer pedidos de venta.
>
> 3. 🤖 **[DESCARGAR APLICACIÓN PARA ANDROID (APK Directo)](https://raw.githubusercontent.com/baituman420/route-planner-dynamics-extension/main/route-planner.apk)**
>    * Descarga e instala la app en tu teléfono o tablet de reparto.
>    * Abre el enlace desde tu Android, descarga el archivo `route-planner.apk` e instálalo para probar el lector OCR de albaranes mediante la cámara y la sincronización con Google Maps.

---



## 🌟 Características Clave

### 1. Integración en Tiempo Real con Dynamics 365 (Extensión Edge)
* **Panel Lateral Integrado**: Trabaja en pantalla dividida en Microsoft Edge. La extensión corre de forma nativa a la derecha mientras navegas por Dynamics 365 a la izquierda.
* **Extracción de Datos de Doble Capa (Híbrida)**:
  * **Capa API (Fidelidad Alta)**: Accede directamente al contexto `Xrm.Page` (Client API) del portal UCI de Dynamics 365 para obtener campos estructurados como nombre del cliente, dirección exacta de envío, peso neto, unidades de caja y número de pedido.
  * **Capa DOM Scraper (Respaldo)**: Si la API de Dynamics está limitada, realiza un análisis del árbol DOM identificando los selectores `data-id` estándares de la interfaz web para extraer la información.
* **Flujo Libre de Errores**: Si la parada ya ha sido importada, la extensión te alerta visualmente para evitar duplicados. Si es nueva, la añade a la cola en tiempo real.
* **Modo Simulación (Pruebas)**: Permite probar toda la lógica de importación en entornos de desarrollo tradicionales (`localhost`) inyectando datos de prueba controlados sin necesidad de conectarse a Dynamics.

### 2. Planificador y Optimizador de Rutas (App React)
* **Importación Inteligente de PDFs**: Procesa hojas de expedición logística (archivos PDF) localmente usando `pdfjs-dist` y heurísticas de proximidad espacial de textos. Todo en el dispositivo, 100% privado.
* **Escáner OCR Incorporado**: Permite utilizar la cámara de tu dispositivo móvil para escanear albaranes o notas de entrega físicas, convirtiéndolos en paradas de ruta de inmediato.
* **Base de Datos Persistente (Dexie.js / IndexedDB)**: Guarda el historial completo de tus sesiones de ruta y el índice de clientes de forma persistente. Puedes recuperar cualquier sesión anterior al instante si la aplicación o el navegador se cierran.
* **Editor Multiuso**: Interfaz con botones táctiles de gran tamaño ideales para su uso en cabina. Permite ajustar datos del cliente, definir prioridades (ir primero, ir al final), cambiar tiempos estimados de descarga y excluir paradas específicas.
* **Optimización Inteligente**: Algoritmo heurístico de vecino más cercano para el problema del viajante (TSP) usando distancias de Haversine. Respeta dinámicamente las prioridades fijadas por el conductor.
* **Visualización y Navegación**:
  * Mapa dinámico con trazado de la ruta optimizada por conductor.
  * Botones de navegación directa que lanzan intents de Google Maps (`google.navigation:q=lat,lng`), asegurando una navegación fluida en cabina.
* **Panel de Estadísticas**: Gráficos e indicadores de rendimiento que calculan tiempos totales de trayecto, kilometraje estimado, peso y cantidad de paquetes distribuidos por conductor.

---

## 🛠️ Estructura del Repositorio

```tree
.
├── route-planner-app/          # Directorio principal de la aplicación web y móvil (Vite + TS)
│   ├── android/                # Proyecto nativo de Android (Capacitor)
│   ├── dist/                   # Compilación de producción (cargable en Microsoft Edge)
│   ├── public/                 # Assets públicos y scripts de la extensión (manifest.json, background.js, etc.)
│   ├── src/                    # Código fuente React (Componentes, DB, utilidades, etc.)
│   │   ├── components/         # Componentes UI (Mapa, Editor, Estadísticas, OCR, etc.)
│   │   ├── db/                 # Configuración de base de datos local Dexie.js
│   │   └── utils/              # Parsers de PDF, OCR, Geolocalización y Optimización
│   ├── vite.config.ts          # Configuración del empaquetado Vite (base paths relativos)
│   └── package.json            # Dependencias del proyecto
├── README.md                   # Esta documentación
└── .gitignore                  # Reglas de exclusión de Git (optimizado para no subir node_modules, APKs ni PDFs de prueba)
```

---

## 🛠️ Guía de Desarrollo (Solo para Programadores)

### 1. Requisitos Previos
* **Node.js** (Versión 18 o superior).
* **npm** (o yarn).

### 2. Configuración Inicial e Inicio Local
Accede a la carpeta de la aplicación e instala las dependencias:
```bash
cd route-planner-app
npm install
```

Para iniciar el servidor de desarrollo local:
```bash
npm run dev
```
*(Visita la URL de localhost provista en la consola para interactuar con la interfaz en modo web)*.

### 3. Compilación y Despliegue de la Extensión en Microsoft Edge
Para compilar la aplicación y la extensión en su formato de distribución seguro:
```bash
npm run build
```

Una vez finalizado el proceso de build, verás que se ha creado la carpeta `route-planner-app/dist/`. Para instalarla en Edge:
1. Abre Microsoft Edge y navega a la barra de direcciones: `edge://extensions`.
2. Habilita el **Modo de desarrollador** (Developer mode) usando el interruptor situado en el panel izquierdo o superior.
3. Haz clic en el botón **Cargar extensión descomprimida** (Load unpacked extension).
4. Selecciona la carpeta **`dist`** que acabas de generar (`route-planner-app/dist/`).
5. ¡Listo! Abre cualquier portal de Dynamics 365, haz clic en el icono de la extensión en Edge y disfruta de la automatización en el panel lateral.

### 4. Compilación del APK para Dispositivos Android (Capacitor)
Si deseas generar la app nativa de Android:
1. Asegúrate de sincronizar los cambios de Vite con Capacitor:
   ```bash
   npm run build
   npx cap sync android
   ```
2. Abre el proyecto de Android en Android Studio:
   ```bash
   npx cap open android
   ```
3. Desde Android Studio, selecciona **Build > Build Bundle(s) / APK(s) > Build APK(s)** para compilar tu ejecutable de pruebas nativo.

---

## 🔒 Privacidad y Seguridad
Este software ha sido diseñado con el concepto de **Privacidad en el Diseño**:
* No requiere servidores intermedios de almacenamiento.
* Los PDFs importados se leen en la sandbox local de tu dispositivo.
* La base de datosIndexedDB (Dexie) se aloja única y exclusivamente en tu ordenador o teléfono.
* La comunicación entre Dynamics 365 y el panel lateral de la extensión se realiza de forma local mediante paso de mensajes cifrados en el entorno seguro de extensiones de Chromium.

---

Desarrollado con ❤️ para agilizar la logística de última milla.
