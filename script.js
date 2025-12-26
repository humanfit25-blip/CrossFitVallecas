// CONFIGURACIÓN DEL SISTEMA
let config = {
    semanaActual: 52,
    añoActual: 2025,
    semanasDisponibles: [],
    modoOscuro: true,
    notificaciones: true
};

let datosProgramacion = null;
const BASE_URL = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    await cargarConfiguracion();
    await cargarListaSemanas();
    await cargarSemanaActual();
    inicializarEventos();
    inicializarEfectos3D();
    
    // Atajos de teclado
    document.addEventListener('keydown', manejarAtajosTeclado);
    
    // Verificar actualizaciones periódicamente
    setInterval(verificarActualizaciones, 300000); // 5 minutos
});

// CARGAR CONFIGURACIÓN
async function cargarConfiguracion() {
    try {
        const response = await fetch('config.json');
        const data = await response.json();
        config = { ...config, ...data };
        
        // Actualizar controles
        document.getElementById('config-week').value = config.semanaActual;
        document.getElementById('config-year').value = config.añoActual;
        document.getElementById('notifications-enabled').checked = config.notificaciones;
        
    } catch (error) {
        console.warn('No se encontró config.json, usando valores por defecto');
        await guardarConfiguracion();
    }
}

// GUARDAR CONFIGURACIÓN
async function guardarConfiguracion() {
    config.semanaActual = parseInt(document.getElementById('config-week').value);
    config.añoActual = parseInt(document.getElementById('config-year').value);
    config.notificaciones = document.getElementById('notifications-enabled').checked;
    
    const configData = JSON.stringify(config, null, 2);
    
    // En un entorno real, aquí enviarías al servidor
    // Por ahora solo actualizamos en memoria
    console.log('Configuración guardada:', config);
    
    // Recargar semana actual
    await cargarSemanaActual();
    cerrarModal();
    
    // Mostrar notificación
    mostrarNotificacion('Configuración guardada correctamente', 'success');
}

// CARGAR LISTA DE SEMANAS DISPONIBLES
async function cargarListaSemanas() {
    try {
        // En un entorno real, harías una petición al servidor para listar archivos
        // Por ahora asumimos esta estructura
        config.semanasDisponibles = [
            { semana: 52, año: 2025, nombre: 'semana_52_2025.json' },
            { semana: 1, año: 2026, nombre: 'semana_1_2026.json' }
        ];
        
        actualizarContadorSemanas();
        
    } catch (error) {
        console.error('Error cargando lista de semanas:', error);
        config.semanasDisponibles = [];
    }
}

// CARGAR SEMANA ACTUAL
async function cargarSemanaActual() {
    const nombreArchivo = `semanas/semana_${config.semanaActual}_${config.añoActual}.json`;
    
    try {
        const response = await fetch(nombreArchivo);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        datosProgramacion = await response.json();
        renderizarProgramacion();
        actualizarUI();
        
    } catch (error) {
        console.error('Error cargando semana:', error);
        mostrarError(`No se pudo cargar la semana ${config.semanaActual} de ${config.añoActual}`);
    }
}

// RENDERIZAR PROGRAMACIÓN
function renderizarProgramacion() {
    if (!datosProgramacion) return;
    
    // Actualizar header
    document.getElementById('week-dates').textContent = datosProgramacion.rango_fechas;
    document.getElementById('current-week').textContent = 
        `Semana ${datosProgramacion.semana} - ${datosProgramacion.año}`;
    document.getElementById('current-week-number').textContent = datosProgramacion.semana;
    document.getElementById('last-update').textContent = datosProgramacion.ultima_actualizacion || 'Hoy';
    
    // Generar días
    const container = document.getElementById('week-container');
    container.innerHTML = '';
    
    if (!datosProgramacion.dias || datosProgramacion.dias.length === 0) {
        container.innerHTML = `
            <div class="error">
                <h3><i class="fas fa-exclamation-triangle"></i> No hay programación disponible</h3>
                <p>Esta semana no tiene datos de programación.</p>
            </div>
        `;
        return;
    }
    
    datosProgramacion.dias.forEach((dia, index) => {
        const dayCard = crearDiaCard(dia, index);
        container.appendChild(dayCard);
    });
}

// CREAR TARJETA DE DÍA
function crearDiaCard(dia, index) {
    const esFestivo = dia.festivo || false;
    
    const dayCard = document.createElement('div');
    dayCard.className = `day-card ${esFestivo ? 'festivo' : ''}`;
    dayCard.style.animationDelay = `${index * 0.1}s`;
    
    // Header del día
    let headerHTML = `
        <div class="day-header ${esFestivo ? 'festivo' : ''}">
            <div class="day-name">${dia.nombre}</div>
            <div class="day-date">${dia.fecha}</div>
    `;
    
    if (esFestivo && dia.festivo_badge) {
        headerHTML += `<div class="festivo-badge">${dia.festivo_badge}</div>`;
    }
    
    headerHTML += '</div>';
    dayCard.innerHTML = headerHTML;
    
    // Programas del día
    if (dia.programas && dia.programas.length > 0) {
        dia.programas.forEach(programa => {
            const programSection = crearProgramaSection(programa, esFestivo);
            dayCard.appendChild(programSection);
        });
    } else {
        // Si no hay programas
        const emptySection = document.createElement('div');
        emptySection.className = 'program-section';
        emptySection.innerHTML = `
            <div class="program-title">Sin programación</div>
            <div class="workout-content">
                <p style="text-align: center; padding: 30px; color: var(--texto-secundario);">
                    <i class="fas fa-calendar-times"></i><br>
                    No hay entrenamientos programados para este día
                </p>
            </div>
        `;
        dayCard.appendChild(emptySection);
    }
    
    return dayCard;
}

// CREAR SECCIÓN DE PROGRAMA
function crearProgramaSection(programa, esFestivo) {
    const section = document.createElement('div');
    const tipo = programa.tipo || 'crossfit';
    
    section.className = `program-section ${tipo} ${esFestivo ? 'festivo' : ''}`;
    
    if (esFestivo && programa.rest_text) {
        // Día festivo
        section.innerHTML = `
            <div class="festivo-icon">${programa.icono || '🎆'}</div>
            <div class="program-title">${programa.titulo}</div>
            <div class="festivo-text">${programa.rest_text}</div>
            
            ${programa.feedback ? `
                <button class="feedback-btn" onclick="toggleFeedback(this)">
                    <span>FEEDBACK PARA COACHES</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                
                <div class="feedback-content">
                    <strong>📋 FEEDBACK PARA COACHES:</strong>
                    ${programa.feedback}
                </div>
            ` : ''}
        `;
    } else {
        // Día normal con entrenamiento
        let workoutsHTML = '';
        if (programa.workouts && programa.workouts.length > 0) {
            programa.workouts.forEach(workout => {
                if (workout.titulo) {
                    workoutsHTML += `<div class="workout-title">${workout.titulo}</div>`;
                }
                if (workout.detalles) {
                    workoutsHTML += `<div class="workout-details">${workout.detalles}</div>`;
                }
            });
        }
        
        section.innerHTML = `
            <div class="program-title">${programa.titulo}</div>
            <div class="workout-content">
                ${workoutsHTML}
                
                ${programa.feedback ? `
                    <button class="feedback-btn" onclick="toggleFeedback(this)">
                        <span>FEEDBACK PARA COACHES</span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    
                    <div class="feedback-content">
                        <strong>📋 FEEDBACK PARA COACHES:</strong>
                        ${programa.feedback}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    return section;
}

// TOGGLE FEEDBACK
function toggleFeedback(button) {
    const feedbackContent = button.nextElementSibling;
    button.classList.toggle('active');
    
    if (feedbackContent.classList.contains('show')) {
        feedbackContent.classList.remove('show');
        setTimeout(() => {
            feedbackContent.style.display = 'none';
        }, 300);
    } else {
        feedbackContent.style.display = 'block';
        setTimeout(() => {
            feedbackContent.classList.add('show');
        }, 10);
    }
}

// CAMBIAR SEMANA
async function cambiarSemana(direccion) {
    let nuevaSemana = config.semanaActual;
    let nuevoAño = config.añoActual;
    
    if (direccion === 'siguiente') {
        nuevaSemana++;
        if (nuevaSemana > 52) {
            nuevaSemana = 1;
            nuevoAño++;
        }
    } else if (direccion === 'anterior') {
        nuevaSemana--;
        if (nuevaSemana < 1) {
            nuevaSemana = 52;
            nuevoAño--;
        }
    }
    
    // Verificar si la semana existe
    const semanaExiste = config.semanasDisponibles.some(
        s => s.semana === nuevaSemana && s.año === nuevoAño
    );
    
    if (!semanaExiste) {
        mostrarNotificacion(`La semana ${nuevaSemana} de ${nuevoAño} no está disponible aún`, 'warning');
        return;
    }
    
    config.semanaActual = nuevaSemana;
    config.añoActual = nuevoAño;
    
    await guardarConfiguracion();
}

// IR A SEMANA ESPECÍFICA
async function irASemanaEspecifica(nombreArchivo) {
    const match = nombreArchivo.match(/semana_(\d+)_(\d+)/);
    if (match) {
        config.semanaActual = parseInt(match[1]);
        config.añoActual = parseInt(match[2]);
        await cargarSemanaActual();
        
        // Actualizar controles
        document.getElementById('config-week').value = config.semanaActual;
        document.getElementById('config-year').value = config.añoActual;
    }
}

// MOSTRAR TODAS LAS SEMANAS
function mostrarTodasSemanas() {
    const container = document.getElementById('week-container');
    container.innerHTML = `
        <div class="weeks-list">
            <h3><i class="fas fa-calendar-alt"></i> Semanas Disponibles</h3>
            <div class="weeks-grid">
                ${config.semanasDisponibles.map(semana => `
                    <div class="week-item" onclick="irASemanaEspecifica('${semana.nombre}')">
                        <div class="week-item-header">
                            <i class="fas fa-calendar-week"></i>
                            <span>Semana ${semana.semana}</span>
                        </div>
                        <div class="week-item-year">${semana.año}</div>
                        <div class="week-item-action">
                            <i class="fas fa-external-link-alt"></i>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="back-btn" onclick="cargarSemanaActual()">
                <i class="fas fa-arrow-left"></i> Volver a la semana actual
            </button>
        </div>
    `;
}

// ACTUALIZAR UI
function actualizarUI() {
    document.getElementById('total-weeks').textContent = config.semanasDisponibles.length;
    
    // Habilitar/deshabilitar botones según disponibilidad
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    
    if (prevBtn) {
        const semanaAnteriorExiste = config.semanasDisponibles.some(
            s => (s.semana === config.semanaActual - 1 && s.año === config.añoActual) ||
                 (config.semanaActual === 1 && s.semana === 52 && s.año === config.añoActual - 1)
        );
        prevBtn.disabled = !semanaAnteriorExiste;
        prevBtn.title = semanaAnteriorExiste ? 'Semana anterior' : 'No hay semana anterior disponible';
    }
    
    if (nextBtn) {
        const semanaSiguienteExiste = config.semanasDisponibles.some(
            s => (s.semana === config.semanaActual + 1 && s.año === config.añoActual) ||
                 (config.semanaActual === 52 && s.semana === 1 && s.año === config.añoActual + 1)
        );
        nextBtn.disabled = !semanaSiguienteExiste;
        nextBtn.title = semanaSiguienteExiste ? 'Semana siguiente' : 'No hay semana siguiente disponible';
    }
}

// ACTUALIZAR CONTADOR DE SEMANAS
function actualizarContadorSemanas() {
    const countElement = document.getElementById('available-weeks-count');
    if (countElement) {
        countElement.textContent = config.semanasDisponibles.length;
    }
}

// INICIALIZAR EVENTOS
function inicializarEventos() {
    // Efectos 3D en tarjetas
    document.addEventListener('mousemove', manejarMouseMove);
    
    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                cerrarModal();
            }
        });
    });
}

// MANEJAR MOVIMIENTO DEL MOUSE PARA EFECTOS 3D
function manejarMouseMove(e) {
    const cards = document.querySelectorAll('.day-card');
    cards.forEach(card => {
        if (card.matches(':hover') && window.innerWidth > 768) {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateY = (x - centerX) / 30;
            const rotateX = (centerY - y) / 30;
            
            card.style.transform = `
                translateY(-15px) 
                translateZ(30px) 
                rotateX(${rotateX}deg) 
                rotateY(${rotateY}deg) 
                scale(1.02)
            `;
            
            // Efecto de iluminación
            const lightX = (x / rect.width) * 100;
            const lightY = (y / rect.height) * 100;
            card.style.background = `
                radial-gradient(circle at ${lightX}% ${lightY}%, 
                    rgba(255, 255, 255, 0.05) 0%, 
                    transparent 50%),
                linear-gradient(145deg, var(--negro-suave) 0%, var(--gris-oscuro) 100%)
            `;
        }
    });
}

// INICIALIZAR EFECTOS 3D
function inicializarEfectos3D() {
    document.querySelectorAll('.day-card').forEach(card => {
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0) translateZ(0) rotateX(0) rotateY(0) scale(1)';
            card.style.background = 'linear-gradient(145deg, var(--negro-suave) 0%, var(--gris-oscuro) 100%)';
        });
    });
}

// MANEJAR ATAJOS DE TECLADO
function manejarAtajosTeclado(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch(e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            cambiarSemana('anterior');
            break;
        case 'ArrowRight':
            e.preventDefault();
            cambiarSemana('siguiente');
            break;
        case 'Escape':
            cerrarModal();
            break;
        case 'F5':
            e.preventDefault();
            cargarSemanaActual();
            break;
        case '?':
            e.preventDefault();
            mostrarAyuda();
            break;
    }
}

// MOSTRAR AYUDA
function mostrarAyuda() {
    document.getElementById('help-modal').style.display = 'flex';
}

// MOSTRAR CONFIGURACIÓN
function mostrarConfiguracion() {
    document.getElementById('config-modal').style.display = 'flex';
}

// CERRAR MODAL
function cerrarModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// MOSTRAR ERROR
function mostrarError(mensaje) {
    const container = document.getElementById('week-container');
    container.innerHTML = `
        <div class="error">
            <h3><i class="fas fa-exclamation-triangle"></i> Error</h3>
            <p>${mensaje}</p>
            <button class="refresh-btn" onclick="cargarSemanaActual()" style="margin-top: 20px;">
                <i class="fas fa-sync-alt"></i> Reintentar
            </button>
            <button class="help-btn" onclick="mostrarConfiguracion()" style="margin-top: 10px;">
                <i class="fas fa-cog"></i> Configurar semana manualmente
            </button>
        </div>
    `;
}

// MOSTRAR NOTIFICACIÓN
function mostrarNotificacion(mensaje, tipo = 'info') {
    // Crear notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${tipo}`;
    notification.innerHTML = `
        <i class="fas fa-${tipo === 'success' ? 'check-circle' : tipo === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${mensaje}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // Estilos de notificación
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${tipo === 'success' ? 'rgba(0, 255, 136, 0.15)' : tipo === 'warning' ? 'rgba(255, 204, 0, 0.15)' : 'rgba(0, 212, 255, 0.15)'};
        color: ${tipo === 'success' ? 'var(--verde-haltero)' : tipo === 'warning' ? 'var(--oro-festivo)' : 'var(--celeste-endurance)'};
        border: 2px solid ${tipo === 'success' ? 'var(--verde-haltero)' : tipo === 'warning' ? 'var(--oro-festivo)' : 'var(--celeste-endurance)'};
        padding: 15px 20px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 15px;
        z-index: 3000;
        backdrop-filter: blur(10px);
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// VERIFICAR ACTUALIZACIONES
async function verificarActualizaciones() {
    if (!config.notificaciones) return;
    
    try {
        const response = await fetch('config.json?t=' + Date.now());
        const newConfig = await response.json();
        
        if (newConfig.semanasDisponibles.length > config.semanasDisponibles.length) {
            mostrarNotificacion('¡Hay nuevas semanas disponibles!', 'success');
            await cargarListaSemanas();
        }
    } catch (error) {
        console.warn('No se pudo verificar actualizaciones:', error);
    }
}

// RECARGAR LISTA DE SEMANAS
async function recargarListaSemanas() {
    await cargarListaSemanas();
    mostrarNotificacion('Lista de semanas recargada', 'info');
}

// ABRIR EXPLORADOR DE SEMANAS
function abrirExploradorSemanas() {
    mostrarTodasSemanas();
    cerrarModal();
}

// EXPORTAR FUNCIONES GLOBALES
window.cambiarSemana = cambiarSemana;
window.cargarSemanaActual = cargarSemanaActual;
window.irASemanaEspecifica = irASemanaEspecifica;
window.mostrarTodasSemanas = mostrarTodasSemanas;
window.toggleFeedback = toggleFeedback;
window.mostrarAyuda = mostrarAyuda;
window.mostrarConfiguracion = mostrarConfiguracion;
window.cerrarModal = cerrarModal;
window.guardarConfiguracion = guardarConfiguracion;
window.recargarListaSemanas = recargarListaSemanas;
window.abrirExploradorSemanas = abrirExploradorSemanas;
