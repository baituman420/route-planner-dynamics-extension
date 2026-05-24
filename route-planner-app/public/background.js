// Background Service Worker for Route Planner Edge Extension

// Configura la extensión para que, al hacer clic en el icono, se abra automáticamente el panel lateral (Side Panel)
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error("Error setting panel behavior:", error));
  }
});

// Listener opcional para depuración o para recibir mensajes desde el Content Script y reenviarlos al Sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);
  // Reenviar mensajes del contentScript al panel lateral si es necesario
  if (message.type === "D365_DATA_EXTRACTED") {
    // Reenviar a todos los puertos abiertos (como la UI de nuestro panel lateral)
    chrome.runtime.sendMessage(message);
  }
  return true;
});
