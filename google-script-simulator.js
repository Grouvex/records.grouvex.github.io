// ============================================
// CONFIGURACIÓN DE LA API (usa GET directo)
// ============================================
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyx2ZKEOGThYPBLjDeavIn1EYF9tmcYieT-6mfvAZAeiR0-nO__NKiJTejXxjJGJCBaBA/exec';

// ============================================
// SIMULADOR DEFINITIVO (JSON-SAFE & RACE-CONDITION PROOF)
// ============================================
(function(global) {
    global.google = global.google || {};
    global.google.script = (function() {
        
        // Helper para crear un "Runner" independiente por cada llamada
        const createRunner = (success = null, failure = null, userObj = null) => {
            return {
                withSuccessHandler(fn) {
                    return createRunner(fn, failure, userObj);
                },
                withFailureHandler(fn) {
                    return createRunner(success, fn, userObj);
                },
                withUserObject(obj) {
                    return createRunner(success, failure, obj);
                },
                _execute(functionName, args) {
                    // Normalizar argumentos
                    const payload = args.length === 1 ? args[0] : args;

                    console.log(`📤 Llamando a ${functionName} con:`, payload);

                    fetch(GAS_API_URL, {
                        method: 'POST',
                        mode: 'cors',
                        headers: { 
                            'Content-Type': 'text/plain' // Mantiene la evasión de preflight CORS
                        },
                        body: JSON.stringify({
                            endpoint: functionName,
                            payload: payload
                        })
                    })
                    .then(response => {
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        return response.json();
                    })
                    .then(result => {
                        console.log(`📥 Respuesta de ${functionName}:`, result);
                        if (result.success) {
                            if (success) success(result.data, userObj);
                        } else {
                            if (failure) failure(result.error || "Error desconocido", userObj);
                        }
                    })
                    .catch(error => {
                        console.error(`❌ Error en ${functionName}:`, error);
                        if (failure) failure(error.message, userObj);
                    });
                }
            };
        };

        // Proxy para interceptar la llamada dinámica a las funciones (google.script.run.miFuncion)
        const proxyHandler = {
            get(target, prop) {
                // Si accedes a los handlers directamente desde 'run', crea una cadena de runners
                if (prop === 'withSuccessHandler') return fn => createRunner().withSuccessHandler(fn);
                if (prop === 'withFailureHandler') return fn => createRunner().withFailureHandler(fn);
                if (prop === 'withUserObject') return obj => createRunner().withUserObject(obj);

                // Si llamas a una función directamente sin handlers previa (ej: google.script.run.doSomething())
                return (...args) => createRunner()._execute(prop, args);
            }
        };

        // Proxy para capturar las funciones encadenadas
        const runnerProxy = new Proxy({}, {
            get(target, prop) {
                if (prop === 'withSuccessHandler') {
                    return fn => createRunner().withSuccessHandler(fn);
                }
                if (prop === 'withFailureHandler') {
                    return fn => createRunner().withFailureHandler(fn);
                }
                if (prop === 'withUserObject') {
                    return fn => createRunner().withUserObject(fn);
                }
                return (...args) => createRunner()._execute(prop, args);
            }
        });

        // Crear una instancia de runner inmutable para Proxy
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
                    return (...args) => {
                        const runner = createRunner(handlers.success, handlers.failure, handlers.userObj);
                        return runner._execute(prop, args);
                    };
                }
            });
        }

        return { run: makeRunner() };
    })();
})(window);
