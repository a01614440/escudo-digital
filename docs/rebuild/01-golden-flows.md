# Fase 0 — Golden Flows

## Objetivo
Definir los journeys que no se pueden romper durante el rebuild visual.

## Línea base operativa de este repo
- Stack detectado: React 19, Vite 7, Tailwind v4, Express, PostgreSQL
- Build actual: `vite build` con root `frontend/` y salida `dist/`
- Tests actuales: `node --test`

## Comandos reales usados como baseline
- Instalar: `.\npm-local.cmd install`
- Tests: `.\npm-local.cmd test`
- Build: `.\npm-local.cmd run build`
- Backend: `.\node-local.cmd server.js`
- Flujo build + backend: `.\start-local.cmd`

## Golden flows obligatorios

### 1. Auth
- Entrar a la app
- Registrar usuario
- Iniciar sesión
- Restaurar sesión
- Cerrar sesión

### 2. Survey / diagnóstico
- Entrar a encuesta inicial
- Completar preguntas
- Pasar por loading/generación
- Ver resultado / perfil
- Continuar a la ruta sin saltos incorrectos

### 3. Ruta / continuidad
- Ver la ruta generada
- Retomar el módulo recomendado
- Cambiar entre pestañas de ruta / progreso / ajustes
- Regenerar o ajustar sin perder consistencia del estado

### 4. Lesson flow
- Entrar a un módulo
- Ver el mapa del módulo
- Abrir actividad
- Completar actividad
- Recibir feedback
- Avanzar / salir del módulo

### 5. Simulaciones
- Abrir simulación
- Completar simulación sin perder scoring
- Recibir feedback
- Persistir completion

### 6. Chat
- Abrir el drawer
- Escribir una pregunta
- Enviar mensaje
- Recibir respuesta
- Cerrar drawer sin romper el resto de la app

### 7. Admin
- Entrar a admin como usuario admin
- Ver métricas
- Cambiar entre preview/admin si aplica
- Salir sin dañar la sesión ni la ruta

### 8. Salud de backend
- `/api/health` accesible
- La app no debe quedar inservible si la DB falla

## Flujos sensibles por archivo
- `frontend/src/App.jsx`: conecta sesión, assessment, ruta, admin y chat
- `frontend/src/components/CoursesView.jsx`: continuidad y ruta
- `frontend/src/components/LessonView.jsx`: lesson flow
- `frontend/src/components/activities/ActivityRenderer.jsx`: entrada al contrato de actividades
- `frontend/src/components/ChatDrawer.jsx`: superficie transversal

## Smoke pack mínimo por bloque migrado
Después de cualquier bloque visual:

1. `.\npm-local.cmd test`
2. `.\npm-local.cmd run build`
3. Smoke manual del flujo afectado

## Baseline verificada al cerrar Fase 0
- `.\npm-local.cmd test`: pasando
- `.\npm-local.cmd run build`: pasando

## Riesgos inmediatos antes de Fase 1
- `App.jsx` es el punto de mayor probabilidad de reset accidental de estado.
- `CoursesView.jsx` y `LessonView.jsx` no deben migrarse en paralelo.
- `ChatDrawer.jsx` depende hoy del layout global y del viewport actual.
- `ActivityRenderer.jsx` no debe alterarse fuera de su fase.
