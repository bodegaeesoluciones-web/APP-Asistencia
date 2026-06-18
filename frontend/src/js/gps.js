export const getGPSLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalización no soportada por el navegador."));
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        let msg = "Error al obtener ubicación.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = "Permiso de ubicación denegado por el usuario.";
            break;
          case error.POSITION_UNAVAILABLE:
            msg = "Información de ubicación no disponible.";
            break;
          case error.TIMEOUT:
            msg = "Tiempo de espera agotado al obtener ubicación.";
            break;
        }
        reject(new Error(msg));
      },
      options
    );
  });
};

export const getWiFiSSID = async () => {
  // Nota: En navegadores web estándar, no es posible obtener el SSID del WiFi por razones de seguridad/privacidad.
  // La Network Information API (`navigator.connection`) solo da info genérica (tipo de red: wifi, cellular).
  // Por lo tanto, en un entorno web, confiaremos en un checkbox de confirmación + validación de IP en el backend.
  
  if (navigator.connection) {
    const type = navigator.connection.type || navigator.connection.effectiveType;
    if (type !== 'wifi' && type !== '4g' && type !== '3g') {
      // It's just generic info, not strictly reliable for "must be on wifi"
    }
  }

  // Devolvemos null para indicar que el cliente web no puede leer el SSID, 
  // obligando a la lógica de la UI a mostrar el checkbox de confirmación manual.
  return null;
};
