// ============================================
// PUENTE HIGH-PERFORMANCE CON SWR, LOCALSTORAGE Y FLUENT EXTENSIONS
// ============================================
(function(global) {
  'use strict';

  // Endpoint proxied en Cloudflare (intercepta la llamada antes de llegar a GitHub)
  const GAS_API_URL = 'https://grouvex-proxy.grouvex.workers.dev';
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
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function setCachedItem(key, data, ttlMs) {
    try {
      const payload = {
        data: data,
        expiry: Date.now() + ttlMs,
        hash: JSON.stringify(data)
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

    // Helper para notificar estado de carga
    const notifyLoading = (isLoading) => {
      if (typeof config.onLoading === 'function') config.onLoading(isLoading);
    };

    // Helper para aplicar transformación a los datos
    const applyTransform = (data) => {
      return typeof config.transform === 'function' ? config.transform(data) : data;
    };

    // 0. ACTUALIZACIÓN OPTIMISTA (si está configurada)
    if (config.optimisticData !== undefined && typeof config.optimisticFn === 'function') {
      config.optimisticFn(config.optimisticData);
    }

    notifyLoading(true);

    // 1. SI LA CACHÉ SIGUE FRESCA (DENTRO DEL TTL)
    if (cachedEntry && now <= cachedEntry.expiry) {
      console.log(`⚡ [Cache Hit Fresco] ${functionName}`);
      notifyLoading(false);
      const transformedData = applyTransform(cachedEntry.data);
      if (typeof config.success === 'function') {
        config.success(transformedData, config.userObj);
      }
      return transformedData;
    }

    // 2. SI SWR ESTÁ ACTIVO Y TENEMOS DATOS CADUCADOS (STALE)
    let staleDataReturned = false;
    let staleTransformedData = null;

    if (isSWR && cachedEntry) {
      console.log(`📦 [SWR Stale] Entregando caché guardada para '${functionName}' mientras se actualiza...`);
      staleDataReturned = true;
      staleTransformedData = applyTransform(cachedEntry.data);
      if (typeof config.success === 'function') {
        config.success(staleTransformedData, config.userObj);
      }
    }

    // 3. DEDUPLICACIÓN DE PETICIONES EN VUELO
    if (inFlightRequests.has(cacheKey)) {
      const inFlightPromise = inFlightRequests.get(cacheKey);
      return staleDataReturned ? staleTransformedData : inFlightPromise;
    }

    // 4. REVALIDACIÓN EN SEGUNDO PLANO (FETCH AL SERVIDOR PROXIED)
    const task = (async () => {
      let lastError = null;

      try {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          // Soporte para AbortSignal externo
          if (config.signal) {
            config.signal.addEventListener('abort', () => controller.abort());
          }

          try {
            const response = await fetch(GAS_API_URL, {
              method: 'POST',
              mode: 'cors',
              headers: FETCH_HEADERS,
              // Adaptado para el backend (action + args)
              body: JSON.stringify({ action: functionName, args: payloadArray }),
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

            // Guardar en caché si procede
            if (ttlMs > 0) {
              setCachedItem(cacheKey, newData, ttlMs);
            }

            // Invalidador automático de caché para patrones específicos
            if (config.invalidates) {
              global.google.script.clearCache(config.invalidates);
            }

            const transformedNewData = applyTransform(newData);

            // Manejo de SWR previo
            if (staleDataReturned) {
              if (hasChanged) {
                console.log(`🔄 [SWR Update] ¡Los datos de '${functionName}' cambiaron! Actualizando UI...`);
                if (typeof config.onUpdate === 'function') {
                  config.onUpdate(transformedNewData, config.userObj);
                } else if (typeof config.success === 'function') {
                  config.success(transformedNewData, config.userObj);
                }
              } else {
                console.log(`✅ [SWR Verified] Los datos de '${functionName}' no sufrieron cambios en el servidor.`);
              }
              return transformedNewData;
            }

            if (typeof config.success === 'function') {
              config.success(transformedNewData, config.userObj);
            }

            return transformedNewData;

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
        
        if (staleDataReturned) {
          console.warn(`⚠️ No se pudo revalidar '${functionName}', pero la UI mantendrá los datos en caché.`);
          return staleTransformedData;
        }

        if (typeof config.failure === 'function') {
          config.failure(finalErrMsg, config.userObj);
        }
        throw new Error(finalErrMsg);

      } finally {
        notifyLoading(false);
      }
    })();

    inFlightRequests.set(cacheKey, task);
    try {
      const freshData = await task;
      return staleDataReturned ? staleTransformedData : freshData;
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

          // Callbacks estándar
          if (prop === 'withSuccessHandler') return fn => new ScriptRunner({ ...target._config, success: fn });
          if (prop === 'withFailureHandler') return fn => new ScriptRunner({ ...target._config, failure: fn });
          if (prop === 'withUserObject') return obj => new ScriptRunner({ ...target._config, userObj: obj });
          
          // Tiempos y reintentos
          if (prop === 'withTimeout') return ms => new ScriptRunner({ ...target._config, timeout: ms });
          if (prop === 'withRetries') return (r, d) => new ScriptRunner({ ...target._config, retries: r, retryDelay: d });
          
          // Caché y SWR
          if (prop === 'withCache') return ttlMs => new ScriptRunner({ ...target._config, ttl: ttlMs });
          if (prop === 'withSWR') return ttlMs => new ScriptRunner({ ...target._config, swrTtl: ttlMs });
          if (prop === 'onUpdate') return fn => new ScriptRunner({ ...target._config, onUpdate: fn });

          // EXTENSIONES FLUENT
          if (prop === 'invalidates') return pattern => new ScriptRunner({ ...target._config, invalidates: pattern });
          if (prop === 'withLoading') return fn => new ScriptRunner({ ...target._config, onLoading: fn });
          if (prop === 'transform') return fn => new ScriptRunner({ ...target._config, transform: fn });
          if (prop === 'withOptimistic') return (data, updateFn) => new ScriptRunner({ ...target._config, optimisticData: data, optimisticFn: updateFn });
          if (prop === 'withSignal') return signal => new ScriptRunner({ ...target._config, signal });

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
