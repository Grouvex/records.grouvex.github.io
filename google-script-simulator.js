// ============================================
// PUENTE HIGH-PERFORMANCE CON SWR + LOCALSTORAGE
// ============================================
(function(global) {
  'use strict';

  const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyx2ZKEOGThYPBLjDeavIn1EYF9tmcYieT-6mfvAZAeiR0-nO__NKiJTejXxjJGJCBaBA/exec';
  const CACHE_PREFIX = 'GAS_SWR_';

  const DEFAULTS = Object.freeze({
    timeout: 25000,
    retries: 3,
    delay: 1000
  });

  const FETCH_HEADERS = Object.freeze({ 'Content-Type': 'text/plain;charset=utf-8' });
  const inFlightRequests = new Map();

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms + (Math.random() * 150)));
  }

  // --- MÓDULO DE STORAGE CON SWR ---
  function getCachedItem(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      return JSON.parse(raw); // Retorna { data, expiry, hash }
    } catch (_) {
      return null;
    }
  }

  function setCachedItem(key, data, ttlMs) {
    try {
      const payload = {
        data: data,
        expiry: Date.now() + ttlMs,
        hash: JSON.stringify(data) // Para detectar si los datos del servidor cambiaron
      };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload));
    } catch (_) {}
  }

  /**
   * Ejecutor con reintentos y lógica Stale-While-Revalidate
   */
  async function executeWithRetry(functionName, args, config) {
    const maxRetries = config.retries ?? DEFAULTS.retries;
    const baseDelay = config.retryDelay ?? DEFAULTS.delay;
    const timeoutMs = config.timeout ?? DEFAULTS.timeout;
    const ttlMs = config.swrTtl || config.ttl || 0;
    const isSWR = Boolean(config.swrTtl);
    const payloadArray = Array.isArray(args) ? args : [args];

    const cacheKey = `${functionName}:${JSON.stringify(payloadArray)}`;
    const cachedEntry = ttlMs > 0 ? getCachedItem(cacheKey) : null;
    const now = Date.now();

    // 1. SI LA CACHÉ SIGUE FRESCA (DENTRO DEL TTL): Devolverla directo y NO tocar el servidor
    if (cachedEntry && now <= cachedEntry.expiry) {
      console.log(`⚡ [Cache Hit Fresco] ${functionName}`);
      if (typeof config.success === 'function') {
        config.success(cachedEntry.data, config.userObj);
      }
      return cachedEntry.data;
    }

    // 2. SI SWR ESTÁ ACTIVO Y TENEMOS DATOS CADUCADOS (STALE):
    // Entregar inmediatamente la respuesta guardada
    let staleDataReturned = false;
    if (isSWR && cachedEntry) {
      console.log(`📦 [SWR Stale] Entregando caché guardada para '${functionName}' mientras se actualiza...`);
      staleDataReturned = true;
      if (typeof config.success === 'function') {
        config.success(cachedEntry.data, config.userObj);
      }
    }

    // 3. DEDUPLICACIÓN DE PETICIONES EN VUELO
    if (inFlightRequests.has(cacheKey)) {
      const inFlightPromise = inFlightRequests.get(cacheKey);
      return staleDataReturned ? cachedEntry.data : inFlightPromise;
    }

    // 4. REVALIDACIÓN EN SEGUNDO PLANO (FETCH AL SERVIDOR)
    const task = (async () => {
      let lastError = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(GAS_API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: FETCH_HEADERS,
            body: JSON.stringify({ endpoint: functionName, payload: payloadArray }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const text = await response.text();
          let result;
          try {
            result = JSON.parse(text);
          } catch (_) {
            throw new Error("Respuesta no válida del servidor");
          }

          if (!result.success) throw new Error(result.error || "Error en el servidor");

          const newData = result.data;
          const newHash = JSON.stringify(newData);
          const hasChanged = !cachedEntry || cachedEntry.hash !== newHash;

          // Guardar nueva versión en caché
          if (ttlMs > 0) {
            setCachedItem(cacheKey, newData, ttlMs);
          }

          // Si usamos SWR y ya habíamos entregado datos viejos:
          if (staleDataReturned) {
            if (hasChanged) {
              console.log(`🔄 [SWR Update] ¡Los datos de '${functionName}' cambiaron! Actualizando UI...`);
              // Notificar al handler especial de actualización o al success si la vista requiere refrescar
              if (typeof config.onUpdate === 'function') {
                config.onUpdate(newData, config.userObj);
              } else if (typeof config.success === 'function') {
                config.success(newData, config.userObj);
              }
            } else {
              console.log(`✅ [SWR Verified] Los datos de '${functionName}' no sufrieron cambios en el servidor.`);
            }
            return newData;
          }

          // Si no enviamos datos stale previamente, responder normalmente
          if (typeof config.success === 'function') {
            config.success(newData, config.userObj);
          }

          return newData;

        } catch (error) {
          clearTimeout(timeoutId);
          const isAbort = error.name === 'AbortError';
          const isNetworkError = error instanceof TypeError || isAbort || error.message.includes('HTTP');

          lastError = isAbort ? new Error(`Timeout (${timeoutMs}ms)`) : error;
          if (!isNetworkError || attempt >= maxRetries) break;

          await wait(baseDelay * (1 << attempt));
        }
      }

      const finalErrMsg = lastError ? lastError.message : "Error tras reintentos";
      
      // Si falló la red pero ya habíamos entregado datos Stale, evitamos lanzar excepción fatal
      if (staleDataReturned) {
        console.warn(`⚠️ No se pudo revalidar '${functionName}', pero la UI mantendrá los datos en caché.`);
        return cachedEntry.data;
      }

      if (typeof config.failure === 'function') {
        config.failure(finalErrMsg, config.userObj);
      }
      throw new Error(finalErrMsg);
    })();

    inFlightRequests.set(cacheKey, task);
    try {
      const freshData = await task;
      // Si devolvimos datos Stale al inicio de la llamada async, la promesa debe resolver con esos datos o los frescos
      return staleDataReturned ? cachedEntry.data : freshData;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  }

  // --- CLASS RUNNER FLUENT ---
  class ScriptRunner {
    constructor(config = {}) {
      this._config = config;

      return new Proxy(this, {
        get(target, prop) {
          if (prop in target) return target[prop];

          if (prop === 'withSuccessHandler') return fn => new ScriptRunner({ ...target._config, success: fn });
          if (prop === 'withFailureHandler') return fn => new ScriptRunner({ ...target._config, failure: fn });
          if (prop === 'withUserObject') return obj => new ScriptRunner({ ...target._config, userObj: obj });
          if (prop === 'withTimeout') return ms => new ScriptRunner({ ...target._config, timeout: ms });
          if (prop === 'withRetries') return (r, d) => new ScriptRunner({ ...target._config, retries: r, retryDelay: d });
          
          // Caché tradicional
          if (prop === 'withCache') return ttlMs => new ScriptRunner({ ...target._config, ttl: ttlMs });
          
          // Estrategia Stale-While-Revalidate
          if (prop === 'withSWR') return ttlMs => new ScriptRunner({ ...target._config, swrTtl: ttlMs });
          
          // Callback que se dispara solo si el servidor trae datos distintos a los que estaban guardados
          if (prop === 'onUpdate') return fn => new ScriptRunner({ ...target._config, onUpdate: fn });

          return (...args) => executeWithRetry(prop, args, target._config);
        }
      });
    }
  }

  global.google = global.google || {};
  global.google.script = global.google.script || {};
  global.google.script.run = new ScriptRunner();

  // Limpieza de caché
  global.google.script.clearCache = function(pattern) {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          if (!pattern || key.includes(pattern)) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      console.log(`🧹 Caché SWR eliminada (${keysToRemove.length} elementos)`);
    } catch (e) {
      console.error(e);
    }
  };

})(typeof window !== 'undefined' ? window : this);
