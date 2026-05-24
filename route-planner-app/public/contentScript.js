// Content Script for Dynamics 365 Integration - Route Planner

console.log("Route Planner Content Script loaded on Dynamics 365 page.");

// --- METODO A: INYECCIÓN DE SCRIPT EN EL CONTEXTO GLOBAL DE LA PÁGINA (Para acceder a la API Xrm) ---
function injectPageScript() {
  const scriptContent = `
    (function() {
      console.log("Route Planner Page Script injected into D365 context.");

      window.addEventListener("message", (event) => {
        if (event.data && event.data.type === "REQUEST_D365_EXTRACTION") {
          try {
            // Dynamics 365 aloja la API Xrm en parent.Xrm o en window.Xrm
            const d365Context = window.Xrm || parent.Xrm;
            if (!d365Context || !d365Context.Page) {
              window.postMessage({ 
                type: "D365_EXTRACTION_RESPONSE", 
                success: false, 
                error: "D365 Xrm API not available in window or parent." 
              }, "*");
              return;
            }

            const page = d365Context.Page;
            const entity = page.data.entity;
            const entityName = entity.getEntityName();

            // Verificamos si estamos en un Pedido de Venta ("salesorder")
            if (entityName !== "salesorder" && entityName !== "order") {
              window.postMessage({ 
                type: "D365_EXTRACTION_RESPONSE", 
                success: false, 
                error: "El registro activo no es un Pedido de Venta. Entidad: " + entityName
              }, "*");
              return;
            }

            // Extraer campos del Pedido de Venta (salesorder)
            // Dynamics 365 guarda el cliente en 'customerid', la dirección en 'shipto_composite' o 'shipto_line1'
            const orderNumber = page.getAttribute("ordernumber")?.getValue() || "";
            const customerAttr = page.getAttribute("customerid")?.getValue();
            const customerName = customerAttr && customerAttr[0] ? customerAttr[0].name : "Cliente Dynamics";
            const customerCode = customerAttr && customerAttr[0] ? customerAttr[0].id : "";

            const addressLine1 = page.getAttribute("shipto_line1")?.getValue() || "";
            const addressLine2 = page.getAttribute("shipto_line2")?.getValue() || "";
            const city = page.getAttribute("shipto_city")?.getValue() || "";
            const postalCode = page.getAttribute("shipto_postalcode")?.getValue() || "";
            
            // Peso y Cajas/Paquetes (Campos estándar o personalizados frecuentes)
            const weight = page.getAttribute("totalweight")?.getValue() || 0;
            // totalpackages es un entero en Dynamics 365 Sales Order
            const boxCount = page.getAttribute("totalpackages")?.getValue() || page.getAttribute("shipto_freighttermscode")?.getValue() || 0;

            const fullAddress = [addressLine1, addressLine2].filter(Boolean).join(" ");

            const extractedData = {
              id: entity.getId() || Date.now().toString(),
              customerName: customerName,
              customerCode: orderNumber || customerCode.substring(0, 8) || "D365",
              address: fullAddress || "Sin Dirección",
              city: city || "BILBAO",
              postalCode: postalCode || "",
              weight: parseFloat(weight) || 0,
              boxCount: parseInt(boxCount, 10) || 1,
              deliveryStart: "08:00:00",
              deliveryEnd: "18:00:00"
            };

            window.postMessage({ 
              type: "D365_EXTRACTION_RESPONSE", 
              success: true, 
              data: extractedData 
            }, "*");

          } catch (e) {
            window.postMessage({ 
              type: "D365_EXTRACTION_RESPONSE", 
              success: false, 
              error: e.message 
            }, "*");
          }
        }
      });
    })();
  `;

  const script = document.createElement("script");
  script.textContent = scriptContent;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// Inyectamos el script apenas el DOM esté listo
injectPageScript();

// --- METODO B: ESCUCHAR LA RESPUESTA DEL SCRIPT INYECTADO Y ENVIAR AL SIDEPANEL ---
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "D365_EXTRACTION_RESPONSE") {
    if (event.data.success) {
      console.log("Data successfully extracted from D365 API:", event.data.data);
      // Enviar datos al panel lateral
      chrome.runtime.sendMessage({
        type: "D365_DATA_EXTRACTED",
        stop: event.data.data
      });
    } else {
      console.warn("D365 API Extraction failed, running DOM Scraping fallback...", event.data.error);
      runDOMScrapingFallback();
    }
  }
});

// Escuchamos peticiones del Side Panel para iniciar la extracción
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TRIGGER_EXTRACTION") {
    console.log("Trigger extraction requested by Sidepanel");
    // Intentar primero con la API de Dynamics 365 (inyección)
    window.postMessage({ type: "REQUEST_D365_EXTRACTION" }, "*");
  }
  return true;
});

// --- METODO C: RASPADO DEL DOM COMO CONEXION DE RESPALDO (DOM Scraping Fallback) ---
function runDOMScrapingFallback() {
  console.log("Running DOM Scraping Fallback for Dynamics 365...");
  try {
    // Buscar los inputs o divs que contienen datos clave en los formularios unificados (UCI) de D365
    // Los controles UCI tienen atributos data-id="..."
    
    const customerEl = document.querySelector('[data-id="customerid.fieldControl-LookupResultsDropdown_customerid_selected_tag_text"]') 
      || document.querySelector('[data-id="customerid"] input')
      || document.querySelector('div[data-id="customerid"]');
      
    const orderNumberEl = document.querySelector('[data-id="ordernumber"] input') 
      || document.querySelector('[data-id="ordernumber"]');

    const streetEl = document.querySelector('[data-id="shipto_line1"] input') 
      || document.querySelector('[data-id="shipto_line1"]');
      
    const cityEl = document.querySelector('[data-id="shipto_city"] input') 
      || document.querySelector('[data-id="shipto_city"]');
      
    const pcEl = document.querySelector('[data-id="shipto_postalcode"] input') 
      || document.querySelector('[data-id="shipto_postalcode"]');
      
    const weightEl = document.querySelector('[data-id="totalweight"] input') 
      || document.querySelector('[data-id="totalweight"]');
      
    const packagesEl = document.querySelector('[data-id="totalpackages"] input') 
      || document.querySelector('[data-id="totalpackages"]');

    // Auxiliar para leer valor de controles (ya sean inputs o texto plano en divs de solo lectura)
    const getVal = (el) => {
      if (!el) return "";
      if (el.value) return el.value;
      if (el.getAttribute("value")) return el.getAttribute("value");
      return el.innerText || el.textContent || "";
    };

    const customerName = getVal(customerEl).trim() || "Cliente Dynamics (DOM)";
    const orderNumber = getVal(orderNumberEl).trim() || "D365-" + Math.floor(Math.random() * 10000);
    const address = getVal(streetEl).trim() || "Calle Principal D365";
    const city = getVal(cityEl).trim() || "BILBAO";
    const postalCode = getVal(pcEl).trim() || "";
    const weightVal = parseFloat(getVal(weightEl)) || 0;
    const boxCountVal = parseInt(getVal(packagesEl), 10) || 1;

    const fallbackData = {
      id: "dom_" + Date.now(),
      customerName: customerName,
      customerCode: orderNumber,
      address: address,
      city: city,
      postalCode: postalCode,
      weight: weightVal,
      boxCount: boxCountVal,
      deliveryStart: "08:00:00",
      deliveryEnd: "18:00:00"
    };

    console.log("Fallback DOM Scraping successful:", fallbackData);

    chrome.runtime.sendMessage({
      type: "D365_DATA_EXTRACTED",
      stop: fallbackData
    });

  } catch (err) {
    console.error("DOM Scraping Fallback failed:", err);
    // Notificar al Side Panel que no pudimos raspar nada
    chrome.runtime.sendMessage({
      type: "D365_EXTRACTION_ERROR",
      message: "No se pudieron extraer datos del pedido. Asegúrate de estar en la vista de un Pedido de Venta activo en Dynamics 365."
    });
  }
}
