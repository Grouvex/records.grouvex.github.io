// ============================================
// CONFIGURACIÓN DE LA API (vía POST text/plain para evitar CORS)
// ============================================
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyx2ZKEOGThYPBLjDeavIn1EYF9tmcYieT-6mfvAZAeiR0-nO__NKiJTejXxjJGJCBaBA/exec';

// ============================================
// POLYFILL DE GOOGLE.SCRIPT.RUN (OPTIMIZADO E INMUTABLE)
// ============================================
(function(global) {
    global.google = global.google || {};

    // Función encargada de realizar la petición HTTP
    function executeRequest(functionName, args, handlers) {
        console.log(`📤 Llamando a ${functionName} con:`, args);

        fetch(GAS_API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'text/plain' // Evita el Preflight CORS (OPTIONS)
            },
            body: JSON.stringify({
                endpoint: functionName,
                payload: args // Enviamos siempre 'args' como Array directo
            })
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
            return response.json();
        })
        .then(result => {
            console.log(`📥 Respuesta de ${functionName}:`, !!result);
            if (result.success) {
                if (handlers.success) handlers.success(result.data, handlers.userObj);
            } else {
                const errorMsg = result.error || "Error desconocido en el servidor";
                if (handlers.failure) handlers.failure(errorMsg, handlers.userObj);
            }
        })
        .catch(error => {
            console.error(`❌ Error de red/petición en ${functionName}:`, error);
            if (handlers.failure) handlers.failure(error.message, handlers.userObj);
        });
    }

    // Fábrica recursiva e inmutable de Proxies
    function makeRunner(handlers = {}) {
        return new Proxy({}, {
            get(target, prop) {
                if (prop === 'withSuccessHandler') {
                    return fn => makeRunner({ ...handlers, success: fn });
                }
                if (prop === 'withFailureHandler') {
                    return fn => makeRunner({ ...handlers, failure: fn });
                }
                if (prop === 'withUserObject') {
                    return obj => makeRunner({ ...handlers, userObj: obj });
                }
                
                // Si se llama a cualquier otro nombre de función (ej. google.script.run.guardarDatos(...))
                return (...args) => executeRequest(prop, args, handlers);
            }
        });
    }

    // Exponer el objeto google.script.run
    global.google.script = {
        run: makeRunner()
    };
})(window);
