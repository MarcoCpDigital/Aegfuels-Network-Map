(function() {
    "use strict";
  
    // Función debounce para agrupar eventos rápidos
    function debounce(func, wait) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
  
    // Carga dinámica de la API de Google Maps (retorna una promesa)
    function loadGoogleMaps(apiKey) {
      return new Promise((resolve, reject) => {
        if (typeof google !== "undefined" && google.maps) {
          resolve(google.maps);
          return;
        }
        window.initMap = function() {
          resolve(google.maps);
        };
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`;
        script.async = true;
        script.defer = true;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
  
    // Objeto principal de la aplicación
    const App = {
      map: null,
      markers: {}, // Almacenará los marcadores indexados por el id
      data: [],
      mapContainer: null,
  
      // Inicializa la aplicación
      init: function() {
        // Buscar o crear el contenedor del mapa
        this.mapContainer = document.getElementById("google-map");
        if (!this.mapContainer) {
          this.mapContainer = document.createElement("div");
          this.mapContainer.id = "google-map";
          this.mapContainer.style.width = "100%";
          this.mapContainer.style.height = "500px";
          document.body.appendChild(this.mapContainer);
        }
  
        // Cargar la API de Google Maps y luego inicializar el mapa
        loadGoogleMaps("AIzaSyASINxzCUQB9-Sk_nMvyjYXwpf77kSBx7o")
          .then((maps) => {
            // Inicializa el mapa con un centro por defecto
            this.map = new maps.Map(this.mapContainer, {
              center: { lat: 0, lng: 0 },
              zoom: 2,
            });
            // Extrae los datos iniciales y actualiza los marcadores
            this.updateDataAndMarkers();
            // Configura el observador de cambios en la lista
            this.setupObserver();
          })
          .catch((err) => {
            console.error("Error al cargar la API de Google Maps:", err);
          });
      },
  
      // Extrae datos de cada elemento en la lista .aeg-maps_list
      extractData: function() {
        const items = document.querySelectorAll(".aeg-maps_list-item");
        const dataArray = [];
        items.forEach((item) => {
          // Título (dentro de .filter-title)
          const titleEl = item.querySelector(".filter-title");
          const title = titleEl ? titleEl.textContent.trim() : "";
  
          // Imagen (dentro de .aeg-maps_card-cover-img)
          const imageEl = item.querySelector(".aeg-maps_card-cover-img");
          const image = imageEl ? imageEl.src : "";
  
          // Latitud y longitud (campo fs-cmsfilter-field="latlong")
          const latlongEl = item.querySelector('[fs-cmsfilter-field="latlong"]');
          const latlongStr = latlongEl ? latlongEl.textContent.trim() : "";
          let lat = null,
            lng = null;
          if (latlongStr && latlongStr.indexOf(",") > -1) {
            const parts = latlongStr.split(",");
            lat = parseFloat(parts[0].trim());
            lng = parseFloat(parts[1].trim());
            if (isNaN(lat) || isNaN(lng)) {
              lat = null;
              lng = null;
            }
          }
  
          // ID (campo fs-cmsfilter-field="id")
          const idEl = item.querySelector('[fs-cmsfilter-field="id"]');
          const idVal = idEl ? idEl.textContent.trim() : "";
  
          // Premium (campo fs-cmsfilter-field="premium")
          const premiumEl = item.querySelector('[fs-cmsfilter-field="premium"]');
          const premiumStr = premiumEl ? premiumEl.textContent.trim() : "false";
          const premium = premiumStr.toLowerCase() === "true";
  
          // Datos de dirección (country, state, city)
          const countryEl = item.querySelector('[fs-cmsfilter-field="country"]');
          const country = countryEl ? countryEl.textContent.trim() : "";
          const stateEl = item.querySelector('[fs-cmsfilter-field="state"]');
          const state = stateEl ? stateEl.textContent.trim() : "";
          const cityEl = item.querySelector('[fs-cmsfilter-field="city"]');
          const city = cityEl ? cityEl.textContent.trim() : "";
  
          dataArray.push({
            id: idVal,
            title: title,
            image: image,
            latlong: (lat !== null && lng !== null) ? { lat: lat, lng: lng } : null,
            premium: premium,
            address: { country, state, city },
          });
        });
        return dataArray;
      },
  
      // Actualiza o crea marcadores en el mapa según los nuevos datos
      updateMarkers: function(newData) {
        if (!this.map) return;
        const maps = google.maps;
        // Obtiene los IDs de los elementos con coordenadas válidas
        const newIds = newData
          .filter((item) => item.latlong !== null && item.id)
          .map((item) => item.id);
  
        // Elimina marcadores que ya no existen en la lista
        for (let id in this.markers) {
          if (!newIds.includes(id)) {
            this.markers[id].setMap(null);
            delete this.markers[id];
          }
        }
  
        // Agrega o actualiza marcadores según la información extraída
        newData.forEach((item) => {
          if (!item.latlong || !item.id) return;
          if (this.markers[item.id]) {
            // Actualiza la posición del marcador existente (si es necesario)
            this.markers[item.id].setPosition(item.latlong);
          } else {
            // Crea un nuevo marcador
            const marker = new maps.Marker({
              position: item.latlong,
              map: this.map,
              title: item.title,
              // Puedes personalizar el icono según el estado premium:
              icon: item.premium ? "URL_TO_PREMIUM_ICON" : null,
            });
            // InfoWindow opcional para mostrar detalles al hacer click
            const infoWindow = new maps.InfoWindow({
              content: `<div style="max-width:200px;">
                          <strong>${item.title}</strong><br>
                          ${item.address.city ? item.address.city + ", " : ""}${item.address.state ? item.address.state + ", " : ""}${item.address.country}
                        </div>`,
            });
            marker.addListener("click", function() {
              infoWindow.open(App.map, marker);
            });
            this.markers[item.id] = marker;
          }
        });
  
        // Ajusta los límites del mapa para que se muestren todos los marcadores
        const bounds = new maps.LatLngBounds();
        let hasMarkers = false;
        for (let id in this.markers) {
          hasMarkers = true;
          bounds.extend(this.markers[id].getPosition());
        }
        if (hasMarkers) {
          this.map.fitBounds(bounds);
        }
      },
  
      // Extrae datos y actualiza los marcadores
      updateDataAndMarkers: function() {
        const newData = this.extractData();
        this.data = newData;
        this.updateMarkers(newData);
      },
  
      // Configura el MutationObserver para detectar cambios en .aeg-maps_list
      setupObserver: function() {
        const listEl = document.querySelector(".aeg-maps_list");
        if (!listEl) return;
        const observer = new MutationObserver(
          debounce(() => {
            this.updateDataAndMarkers();
          }, 300)
        );
        observer.observe(listEl, { childList: true, subtree: true });
      },
    };
  
    // Inicializa la aplicación cuando el DOM esté listo
    document.addEventListener("DOMContentLoaded", function() {
      App.init();
    });
  })();
  