// ============================================
// Código para manejar enlaces y el modal
// ============================================

// Crear el estilo CSS dinámicamente
const style = document.createElement('style');
style.innerHTML = `
    .modal {
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 300px;
        padding: 20px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        background: black;
        text-align: center;
        border-radius: 10px;
        z-index: 1000;
    }
    .modal img {
        width: 200px;
        height: auto;
    }
    .modal p {
        margin: 20px 0;
        color: white;
    }
    .modal button {
        padding: 5px 10px;
        margin: 3px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }
    .modal button.cancel {
        background-color: #ccc;
    }
    .modal button.continue {
        background-color: #4CAF50;
        color: white;
    }
    /* ============================================
       ESTILOS PARA INSIGNIAS (AÑADIR ESTO)
       ============================================ */
    
    .insignia {
        display: inline-block;
        width: 20px;
        height: 20px;
        margin: 2px;
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        vertical-align: middle;
        border-radius: 3px;
    }
    
    /* Mapeo de insignias a imágenes */
    .insignia.verified { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/verified.png'); }
    .insignia.verified-team { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/verified-team.png'); }
    .insignia.sistema { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/sistema.png'); }
    .insignia.verified-partner { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/verified-partner.gif'); }
    .insignia.verified-bughunter { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/verified-bughunter.gif'); }
    .insignia.artista { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/artista.gif'); }
    .insignia.GROUVEX { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/GROUVEX.png'); }
    .insignia.owner { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/owner.png'); }
    .insignia.vvadmin { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/vvadmin.gif'); }
    .insignia.vdeveloper { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/vdeveloper.gif'); }
    .insignia.vbughunter { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/verified-bughunter.gif'); }
    .insignia.gsmember { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/gsmember.png'); }
    .insignia.admin { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/admin.png'); }
    .insignia.owner-recording { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/owner-recording.gif'); }
    .insignia.owner-designs { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/owner-designs.gif'); }
    .insignia.diseñador { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/diseñador.png'); }
    .insignia.verified-voice { background-image: url('https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/verified-voice.gif'); }
`;
document.head.appendChild(style);
console.log("Estilos CSS del modal añadidos correctamente.");

// ============================================
// CONFIGURACIÓN GOOGLE SHEETS
// ============================================

const SHEET_ID = '15FJWUFb6J52XDLbicgvTJmSCjJ0c0sRoWPpr5YFK5H8';
const SHEET_NAME = 'Respuestas de formulario 2';

// Mapeo de nombres de insignias a URLs
const INSIGNIAS_MAP = {
    'verified': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/verified.png',
    'verified-team': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/verified-team.png',
    'sistema': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/sistema.png',
    'verified-partner': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/verified-partner.gif',
    'verified-bughunter': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/verified-bughunter.gif',
    'artista': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/artista.gif',
    'GROUVEX': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/GROUVEX.png',
    'owner': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/owner.png',
    'vvadmin': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/vvadmin.gif',
    'vdeveloper': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/vdeveloper.gif',
    'vbughunter': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/verified-bughunter.gif',
    'gsmember': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/gsmember.png',
    'admin': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/admin.png',
    'owner-recording': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/owner-recording.gif',
    'owner-designs': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/owner-designs.gif',
    'diseñador': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/diseñador.png',
    'verified-voice': 'https://raw.githubusercontent.com/Grouvex/grouvex.github.io/refs/heads/main/img/verified-voice.gif'
};

// ============================================
// FUNCIONES PARA OBTENER DATOS DE GOOGLE SHEETS
// ============================================

async function obtenerUsuariosDesdeSheets() {
    try {
        console.log('📥 Obteniendo datos de usuarios desde Google Sheets...');
        
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const text = await response.text();
        
        // Parsear respuesta JSON de Google Sheets
        const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\((.+)\);/);
        
        if (!jsonMatch) {
            console.error('❌ No se pudo parsear JSON');
            return {};
        }
        
        const jsonData = JSON.parse(jsonMatch[1]);
        
        if (!jsonData.table || !jsonData.table.rows) {
            console.error('❌ No hay datos en la hoja');
            return {};
        }
        
        // Obtener encabezados
        const headers = jsonData.table.cols.map(col => col.label || '');
        
        // Buscar índices de las columnas
        const nombreIndex = encontrarIndiceColumna(headers, ['nombre', 'name', 'usuario', 'user']);
        const insigniasIndex = encontrarIndiceColumna(headers, ['insignia', 'badge']);
        
        if (nombreIndex === -1 || insigniasIndex === -1) {
            console.error('❌ Faltan columnas necesarias');
            return {};
        }
        
        const usuarios = {};
        
        // Procesar cada fila
        for (let i = 0; i < jsonData.table.rows.length; i++) {
            const row = jsonData.table.rows[i];
            const nombreCell = row.c && row.c[nombreIndex];
            
            if (nombreCell && nombreCell.v) {
                const nombreUsuario = nombreCell.v.toString().trim();
                
                if (nombreUsuario && nombreUsuario !== '') {
                    // Obtener las insignias
                    const insigniasCell = row.c[insigniasIndex];
                    let insigniasTexto = '';
                    
                    if (insigniasCell && insigniasCell.v) {
                        insigniasTexto = insigniasCell.v.toString().trim();
                    }
                    
                    // Procesar las insignias
                    const insigniasArray = procesarTextoInsignias(insigniasTexto);
                    
                    // Agrupar insignias por tipo (para compatibilidad con el código existente)
                    const insigniasAgrupadas = agruparInsignias(insigniasArray);
                    
                    // Crear objeto de usuario con la misma estructura que antes
                    usuarios[nombreUsuario] = {
                        principales: insigniasAgrupadas.principales,
                        GSRecording: insigniasAgrupadas.gsRecording,
                        GSAnimation: insigniasAgrupadas.gsAnimation,
                        GSDesign: insigniasAgrupadas.gsDesign,
                        todasInsignias: insigniasArray
                    };
                }
            }
        }
        
        console.log(`📊 Usuarios cargados desde Google Sheets: ${Object.keys(usuarios).length}`);
        return usuarios;
        
    } catch (error) {
        console.error('❌ Error obteniendo datos de usuarios:', error);
        // Retornar objeto vacío en caso de error
        return {};
    }
}

function encontrarIndiceColumna(headers, palabrasClave) {
    for (let i = 0; i < headers.length; i++) {
        const header = headers[i].toLowerCase();
        for (const palabra of palabrasClave) {
            if (header.includes(palabra.toLowerCase())) {
                return i;
            }
        }
    }
    return -1;
}

function procesarTextoInsignias(textoInsignias) {
    if (!textoInsignias || textoInsignias.trim() === '') {
        return [];
    }
    
    // Separar por diferentes delimitadores
    const delimitadores = /[,;|/\\\n\t]+/;
    return textoInsignias.split(delimitadores)
        .map(insignia => insignia.trim())
        .filter(insignia => insignia && insignia.length > 0);
}

function agruparInsignias(insigniasArray) {
    const grupos = {
        principales: [],
        gsRecording: [],
        gsAnimation: [],
        gsDesign: []
    };
    
    insigniasArray.forEach(insignia => {
        const insigniaLower = insignia.toLowerCase();
        
        // Clasificar insignias según su tipo
        if (insigniaLower.includes('recording') || 
            insigniaLower.includes('grabacion') || 
            insigniaLower.includes('artista') ||
            insigniaLower.includes('owner-recording')) {
            grupos.gsRecording.push(insignia);
        } else if (insigniaLower.includes('animation') || 
                  insigniaLower.includes('animacion') || 
                  insigniaLower.includes('animador')) {
            grupos.gsAnimation.push(insignia);
        } else if (insigniaLower.includes('design') || 
                  insigniaLower.includes('diseño') || 
                  insigniaLower.includes('diseñador') ||
                  insigniaLower.includes('owner-designs')) {
            grupos.gsDesign.push(insignia);
        } else {
            grupos.principales.push(insignia);
        }
    });
    
    return grupos;
}

// ============================================
// FUNCIÓN PARA MOSTRAR USUARIOS E INSIGNIAS
// ============================================

function mostrarUsuarioYInsignias(nombreUsuario, usuarioData, elements) {
    elements.forEach(element => {
        // Limpiar el elemento antes de agregar contenido
        element.innerHTML = '';
        
        // Mostrar nombre de usuario
        const spanNombre = document.createElement("span");
        spanNombre.textContent = nombreUsuario;
        spanNombre.style.fontWeight = 'bold';
        spanNombre.style.marginRight = '10px';
        element.appendChild(spanNombre);

        // Mostrar insignias principales
        const divPrincipales = document.createElement("div");
        divPrincipales.style.display = 'inline-block';
        
        if (usuarioData.principales && usuarioData.principales.length > 0) {
            usuarioData.principales.forEach(insignia => {
                if (insignia) {
                    const spanInsignia = document.createElement("span");
                    spanInsignia.classList.add("insignia", insignia);
                    spanInsignia.style.marginLeft = '2px';
                    divPrincipales.appendChild(spanInsignia);
                }
            });
        }
        element.appendChild(divPrincipales);

        // Función para crear detalles de insignias
        function crearDetallesInsignias(titulo, insigniasArray) {
            if (insigniasArray && insigniasArray.length > 0) {
                const details = document.createElement("details");
                details.style.marginLeft = '10px';
                details.style.display = 'inline-block';
                
                const summary = document.createElement("summary");
                summary.textContent = titulo;
                summary.style.fontSize = "10px";
                summary.style.cursor = 'pointer';

                details.appendChild(summary);
                const divInsignias = document.createElement("div");
                divInsignias.style.display = 'flex';
                divInsignias.style.flexWrap = 'wrap';
                divInsignias.style.gap = '2px';
                divInsignias.style.marginTop = '5px';
                
                insigniasArray.forEach(insignia => {
                    if (insignia) {
                        const spanInsignia = document.createElement("span");
                        spanInsignia.classList.add("insignia", insignia);
                        divInsignias.appendChild(spanInsignia);
                    }
                });
                details.appendChild(divInsignias);
                return details;
            }
            return null;
        }

        // Mostrar detalles de cada categoría si existen
        const gsRecordingDetails = crearDetallesInsignias("GSRecording", usuarioData.GSRecording);
        if (gsRecordingDetails) element.appendChild(gsRecordingDetails);

        const gsAnimationDetails = crearDetallesInsignias("GSAnimation", usuarioData.GSAnimation);
        if (gsAnimationDetails) element.appendChild(gsAnimationDetails);

        const gsDesignDetails = crearDetallesInsignias("GSDesign", usuarioData.GSDesign);
        if (gsDesignDetails) element.appendChild(gsDesignDetails);
    });
}

// ============================================
// CÓDIGO PRINCIPAL PARA INSIGNIAS
// ============================================

async function inicializarInsigniasUsuarios() {
    console.log('🚀 Inicializando sistema de insignias...');
    
    // Obtener datos de Google Sheets
    const usuarios = await obtenerUsuariosDesdeSheets();
    
    if (Object.keys(usuarios).length === 0) {
        console.log('⚠️ No se encontraron usuarios en Google Sheets');
        return;
    }
    
    console.log('✅ Datos de usuarios cargados:', Object.keys(usuarios));
    
    // Buscar elementos con clases que coincidan con nombres de usuario
    Object.keys(usuarios).forEach(usuario => {
        // Convertir el nombre de usuario a formato de clase (reemplazar espacios con guiones)
        const nombreClase = usuario.replace(/\s+/g, '-');
        const elements = document.querySelectorAll(`.${nombreClase}`);
        
        if (elements.length > 0) {
            console.log(`👤 Mostrando insignias para: ${usuario}`);
            mostrarUsuarioYInsignias(usuario, usuarios[usuario], elements);
        }
    });
}

// ============================================
// INICIALIZACIÓN CUANDO EL DOM ESTÁ LISTO
// ============================================

document.addEventListener("DOMContentLoaded", () => {
    console.log('📄 DOM cargado, inicializando insignias...');
    inicializarInsigniasUsuarios();
});
