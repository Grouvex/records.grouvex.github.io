// ============================================
// PUENTE HIGH-PERFORMANCE CON SWR, LOCALSTORAGE Y FLUENT EXTENSIONS (DIAGNOSTIC BUILD)
// ============================================
(function(global) {
  'use strict';

  const GAS_API_URL = 'https://grouvex-proxy.grouvex.workers.dev/';
  const CACHE_PREFIX = 'GAS_SWR_';

  const DEFAULTS = Object.freeze({
    timeout: 25000,
    retries: 3,
    delay: 1000,
    debug: false // Cambiar a false en producción si no deseas logs detallados
  });

  const FETCH_HEADERS = Object.freeze({ 'Content-Type': 'application/json' });
  const inFlightRequests = new Map();

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms + (Math.random() * 150)));
  }

  // --- HELPER DE LOGS ESTRUCTURADOS ---
  function log(level, source, message, data = null) {
    const colors = {
      CLIENT: 'color: #3b82f6; font-weight: bold;',  // Azul
      PROXY: 'color: #f59e0b; font-weight: bold;',   // Naranja
      GAS: 'color: #ef4444; font-weight: bold;',     // Rojo
      CACHE: 'color: #10b981; font-weight: bold;'    // Verde
    };
    const prefix = `%c[${source}] %c${message}`;
    const styleSource = colors[source] || 'font-weight: bold;';
    const styleMsg = 'color: inherit;';

    if (level === 'error') {
      console.error(prefix, styleSource, styleMsg, data ?? '');
    } else if (level === 'warn') {
      console.warn(prefix, styleSource, styleMsg, data ?? '');
    } else {
      console.log(prefix, styleSource, styleMsg, data ?? '');
    }
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
    const isDebug = config.debug ?? DEFAULTS.debug;

    // 1. VERIFICACIÓN DE SEGURIDAD EN EL CLIENTE
    if (
      !functionName || 
      typeof functionName !== 'string' || 
      functionName === 'undefined' || 
      functionName === 'null' ||
      functionName.trim() === ''
    ) {
      log('error', 'CLIENT', `Fallo de validación local: Nombre de función remoto no válido -> '${functionName}'`);
      return Promise.reject(new Error(`[CLIENT] Función remota no válida: ${functionName}`));
    }

    const cleanActionName = functionName.trim();
    const maxRetries = config.retries ?? DEFAULTS.retries;
    const baseDelay = config.retryDelay ?? DEFAULTS.delay;
    const timeoutMs = config.timeout ?? DEFAULTS.timeout;
    const ttlMs = config.swrTtl || config.ttl || 0;
    const isSWR = Boolean(config.swrTtl);
    const payloadArray = Array.isArray(args) ? args : [args];

    const cacheKey = `${cleanActionName}:${JSON.stringify(payloadArray)}`;
    const cachedEntry = ttlMs > 0 ? getCachedItem(cacheKey) : null;
    const now = Date.now();

    if (isDebug) {
      log('info', 'CLIENT', `Iniciando llamada remota: '${cleanActionName}'`, { args: payloadArray, config });
    }

    const notifyLoading = (isLoading) => {
      if (typeof config.onLoading === 'function') config.onLoading(isLoading);
    };

    const applyTransform = (data) => {
      return typeof config.transform === 'function' ? config.transform(data) : data;
    };

    // 0. ACTUALIZACIÓN OPTIMISTA
    if (config.optimisticData !== undefined && typeof config.optimisticFn === 'function') {
      config.optimisticFn(config.optimisticData);
    }

    notifyLoading(true);

    // 1. SI LA CACHÉ SIGUE FRESCA (DENTRO DEL TTL)
    if (cachedEntry && now <= cachedEntry.expiry) {
      if (isDebug) log('info', 'CACHE', `Hit Fresco para '${cleanActionName}'`);
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
      if (isDebug) log('info', 'CACHE', `Entregando versión Stale para '${cleanActionName}' mientras revalida`);
      staleDataReturned = true;
      staleTransformedData = applyTransform(cachedEntry.data);
      if (typeof config.success === 'function') {
        config.success(staleTransformedData, config.userObj);
      }
    }

    // 3. DEDUPLICACIÓN DE PETICIONES EN VUELO
    if (inFlightRequests.has(cacheKey)) {
      if (isDebug) log('info', 'CLIENT', `Reutilizando petición en vuelo para '${cleanActionName}'`);
      const inFlightPromise = inFlightRequests.get(cacheKey);
      return staleDataReturned ? staleTransformedData : inFlightPromise;
    }

    // 4. REVALIDACIÓN EN SEGUNDO PLANO (FETCH AL SERVIDOR)
    const task = (async () => {
      let lastError = null;

      try {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          if (config.signal) {
            config.signal.addEventListener('abort', () => controller.abort());
          }

          try {
            const bodyPayload = JSON.stringify({ action: cleanActionName, args: payloadArray });
            
            if (isDebug) {
              log('info', 'CLIENT', `Enviando Fetch (Intento ${attempt + 1}/${maxRetries + 1}) ->`, { bodyPayload });
            }

            const response = await fetch(GAS_API_URL, {
              method: 'POST',
              mode: 'cors',
              headers: FETCH_HEADERS,
              body: bodyPayload,
              signal: controller.signal
            });

            clearTimeout(timeoutId);

            // LOG DE DIAGNÓSTICO HTTP (Cloudflare Proxy / Red)
            if (!response.ok) {
              const errText = await response.text();
              log('error', 'PROXY', `Error HTTP ${response.status} devuelto por Cloudflare`, {
                status: response.status,
                statusText: response.statusText,
                responseText: errText
              });
              throw new Error(`[PROXY_HTTP_${response.status}] ${errText}`);
            }

            const text = await response.text();
            let result;

            try {
              result = JSON.parse(text);
            } catch (jsonErr) {
              log('error', 'PROXY', `Respuesta devuelta por el proxy no es un JSON válido`, { rawResponse: text });
              throw new Error(`[PROXY_INVALID_JSON] La respuesta no es un JSON válido: ${text.substring(0, 100)}...`);
            }

            // DIAGNÓSTICO DE RESPUESTA INTERNA (Google Apps Script)
            if (!result.success) {
              log('error', 'GAS', `Fallo reportado por la lógica de Apps Script`, { error: result.error, fullResult: result });
              throw new Error(`[GAS_ERROR] ${result.error || "Error indeterminado en Apps Script"}`);
            }

            if (isDebug) {
              log('info', 'GAS', `Respuesta exitosa recibida para '${cleanActionName}'`, result.data);
            }

            const newData = result.data;
            const newHash = JSON.stringify(newData);
            const hasChanged = !cachedEntry || cachedEntry.hash !== newHash;

            if (ttlMs > 0) {
              setCachedItem(cacheKey, newData, ttlMs);
            }

            if (config.invalidates) {
              global.google.script.clearCache(config.invalidates);
            }

            const transformedNewData = applyTransform(newData);

            if (staleDataReturned) {
              if (hasChanged) {
                if (isDebug) log('info', 'CACHE', `SWR detectó cambios en '${cleanActionName}'. Actualizando UI.`);
                if (typeof config.onUpdate === 'function') {
                  config.onUpdate(transformedNewData, config.userObj);
                } else if (typeof config.success === 'function') {
                  config.success(transformedNewData, config.userObj);
                }
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
            const isNetworkError = error instanceof TypeError || isAbort || error.message.includes('PROXY_HTTP');

            lastError = isAbort ? new Error(`[CLIENT_TIMEOUT] Cancelado tras timeout de ${timeoutMs}ms`) : error;

            log('warn', 'CLIENT', `Fallo en el intento ${attempt + 1}/${maxRetries + 1}: ${lastError.message}`);

            if (!isNetworkError || attempt >= maxRetries) break;

            await wait(baseDelay * (1 << attempt));
          }
        }

        const finalErrMsg = lastError ? lastError.message : "Error desconocido tras reintentos";
        
        if (staleDataReturned) {
          log('warn', 'CLIENT', `Fallo la revalidación de '${cleanActionName}'. Se mantiene el valor stale en UI.`);
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

  // --- MAPA DE MÉTODOS FLUENT ---
  const FLUENT_METHODS = {
    withSuccessHandler: (cfg, fn) => ({ ...cfg, success: fn }),
    withFailureHandler: (cfg, fn) => ({ ...cfg, failure: fn }),
    withUserObject: (cfg, obj) => ({ ...cfg, userObj: obj }),
    withTimeout: (cfg, ms) => ({ ...cfg, timeout: ms }),
    withRetries: (cfg, r, d) => ({ ...cfg, retries: r, retryDelay: d }),
    withCache: (cfg, ttlMs) => ({ ...cfg, ttl: ttlMs }),
    withSWR: (cfg, ttlMs) => ({ ...cfg, swrTtl: ttlMs }),
    onUpdate: (cfg, fn) => ({ ...cfg, onUpdate: fn }),
    invalidates: (cfg, pattern) => ({ ...cfg, invalidates: pattern }),
    withLoading: (cfg, fn) => ({ ...cfg, onLoading: fn }),
    transform: (cfg, fn) => ({ ...cfg, transform: fn }),
    withOptimistic: (cfg, data, updateFn) => ({ ...cfg, optimisticData: data, optimisticFn: updateFn }),
    withSignal: (cfg, signal) => ({ ...cfg, signal }),
    withDebug: (cfg, enabled = true) => ({ ...cfg, debug: enabled })
  };

  const IGNORED_PROPERTIES = new Set([
    'then', 'catch', 'finally', 'toJSON', 'prototype', 'constructor',
    'toString', 'valueOf', 'nodeType', 'length', '_jsonp', 'caller',
    'bind', 'apply', 'call', 'name', 'arguments', 'inspect'
  ]);

  // --- CLASS RUNNER FLUENT ---
  class ScriptRunner {
    constructor(config = {}) {
      this._config = Object.freeze({ ...config });
  
      return new Proxy(this, {
        get: (target, prop) => {
          if (
            typeof prop !== 'string' ||
            IGNORED_PROPERTIES.has(prop) ||
            prop.startsWith('_') ||
            prop.startsWith('@@')
          ) {
            return undefined;
          }
  
          if (prop in target) {
            return target[prop];
          }
  
          if (Object.prototype.hasOwnProperty.call(FLUENT_METHODS, prop)) {
            return (...args) => {
              const nextConfig = FLUENT_METHODS[prop](target._config, ...args);
              return new ScriptRunner(nextConfig);
            };
          }
  
          return (...args) => executeWithRetry(prop, args, target._config);
        }
      });
    }
  }

  global.google = global.google || {};
  global.google.script = global.google.script || {};
  global.google.script.run = new ScriptRunner();

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
      log('info', 'CACHE', `Caché SWR eliminada (${keysToRemove.length} elementos)`);
    } catch (e) {
      log('error', 'CLIENT', 'Error al borrar la caché de localStorage', e);
    }
  };

})(typeof window !== 'undefined' ? window : this);
