# Trazabilidad de Desarrollo - PentaQuest

## 1) Contexto del proyecto

Este documento centraliza la trazabilidad del desarrollo de `PentaQuest` antes y durante la implementación.
Su objetivo es:

- Alinear alcance funcional y técnico.
- Registrar decisiones y cambios de alcance.
- Identificar riesgos, supuestos y dependencias.
- Definir criterios de aceptación y plan de validación.
- Mantener un histórico claro de avances y bloqueos.

---

## 2) Estado inicial

- **Fecha de creación:** 2026-04-14
- **Estado:** En definición
- **Repositorio:** No inicializado (directorio local)
- **Stack base propuesto:** TypeScript + Phaser
- **Arquitectura base propuesta:** OOP + SOLID, modularizable por capas (`core`, `entities`, `skills`, `ui`, `scenes`)

---

## 3) Objetivo de producto

Construir un prototipo/juego funcional tipo combate por turnos "endless dungeon" con:

- 5 roles jugables.
- 3 enemigos escalables por piso.
- Sistema de turnos por velocidad.
- Habilidades por rol con efectos diferenciados.
- Progresión por pisos y pantalla de game over.

---

## 4) Alcance funcional (borrador)

### En alcance (MVP)

- Combate por turnos con selección de personaje, habilidad y objetivo.
- IA enemiga básica.
- Escalado de dificultad por piso.
- UI mínima de combate y registro de eventos.
- Reinicio de partida al perder.

### Fuera de alcance inicial (fase posterior)

- Inventario.
- Árbol de habilidades / niveles por personaje.
- Guardado completo de partida.
- Sistema de estados complejo (veneno, stun, etc.) persistente multi-turno.
- Audio, VFX avanzados y pulido artístico completo.

---

## 5) Reglas de trazabilidad

Cada cambio debe registrar:

1. **Qué se cambió**
2. **Por qué se cambió**
3. **Impacto esperado**
4. **Riesgo asociado**
5. **Cómo se valida**

Formato sugerido para entradas de avance:

```text
Fecha:
Responsable:
Módulo:
Cambio:
Motivo:
Impacto:
Validación:
Estado: [Hecho | En progreso | Bloqueado]
```

---

## 6) Preguntas clave para iniciar el desarrollo completo

> Responder estas preguntas nos permite cerrar requisitos y evitar retrabajo.

### 6.1 Visión y producto

1. ¿El objetivo es un **prototipo técnico** o una **base de producción**?
base de produccion
2. ¿Qué prioridad tiene: arquitectura limpia, velocidad de entrega o jugabilidad inmediata?
primero las buenas practicas, antes de que sea jugable.
3. ¿Cuál es la definición de "completo" para ti en esta primera versión?
empezar juego, jugar, avanzar, perder y volver a intentar, luego se iran implementando cosas nuevas
4. ¿Quieres enfoque single-player únicamente o preparar base para coop/multijugador futuro?
solo single player, pero necesito que definas esta siguiente dinamica de juego. al empezar seleccionar un personaje, y a medida de que avanzas, cada dos pisos puedes elegir un nuevo personaje que se suma al equipo

### 6.2 Plataforma y ejecución

1. ¿El juego se ejecutará solo en navegador (desktop) o también móvil? ambos, android y navegador 
(javascript)
2. ¿Se usará Phaser con bundler (Vite/Webpack) o carga directa por `index.html`?
no estoy seguro, busca algo que sea más compatible
3. ¿Quieres TypeScript compilado con `tsc` puro o integrar pipeline con `npm scripts` + lint + tests?
basico, pero entendible. tengo experiencia con el frameweork de angular, seria bueno hacer una arquitectura esperada con este framework
4. ¿Habrá requisito de despliegue (GitHub Pages, Netlify, servidor propio)?
no, no está contemplado un despliegue, pero en caso de que si, seria netlify conectado con github (cuenta personal)

### 6.3 Arquitectura y calidad

1. ¿Prefieres empezar con archivo único (`main.ts`) y luego modularizar, o modularizar desde el día 1?
modulizar desde el dia 1
2. ¿Deseas aplicar patrón adicional (Factory, Strategy, State) desde inicio?
no conozco mucho del tema, pero pienso que seria bueno tener todo lo necesario desde un inicio
3. ¿Necesitas reglas de estilo (ESLint + Prettier) obligatorias?
pues si, está bien
4. ¿Debemos incluir pruebas unitarias desde el inicio (ej. Vitest/Jest)?
no, esto no

### 6.4 Diseño de gameplay

1. ¿Los 5 roles son fijos o configurables?
son fijos. pero eventualmente habrán más
2. ¿Cada personaje tendrá 1 habilidad inicial o más de 1 desde MVP?
cada personaje cuenta con habilidades, que van desbloqueando segun los pisos que vayan bajando (cada 2 pisos). inicialmente 2 habilidades "BASE" 
3. ¿Habrá cooldown, costo de recurso (mana/energía) o usos limitados?
Aun no, luego lo defino
4. ¿El sistema de aggro del tanque será básico (forzado 1 turno) o con fórmula persistente?
Forzado 1 turno
5. ¿Se permite targeting múltiple para algunas habilidades desde MVP?
Si, pero aun no nos metamos con esto. (pero si me preguntas, el curandero, el ranger y el mago invocador solo pueden hacerlo con 1 habilidad, lo dejo a tu criterio)
6. ¿Debe existir crítico, evasión, resistencia elemental o no en esta fase?
no en esta fase

### 6.5 Progresión y balance

1. ¿Escalado de enemigos lineal, exponencial o por tablas definidas por piso?
exponencial, algo de calculo y una pizca de aleatoriedad para dar sensacion de dificultad y frustracion para el jugador, para que se "enganche"
2. ¿Quieres recompensas por piso (oro, experiencia, ítems) desde MVP?
experiencia e items, experiencia para que cada dos pisos SOLO los personajes que hayan pasado 2 pisos puedan elegir una nueva habilidad en su arsenal, y 1 objeto aleatorio que dé atributos basicos, daño fisico, daño magico, vida maxima, poder de curacion
3. ¿Habrá evolución permanente de personajes entre pisos?
esa es la idea. pero cuando se vuelva a empezar todo será desde cero
4. ¿Cuál es la duración objetivo de una run promedio?
lo que el usuario se disponga a jugar, aun no hacemos desarrollo de nivel, por el momento deja como "Modo infinito"

### 6.6 UI/UX

1. ¿Interacción principal por mouse, teclado o ambas?
Principalmente mouse, pero seria bueno manejar tambien teclado, algo basico como el orden de los echizos seria numeros donde el 1 es el primer echizo de izquierda a derecha
2. ¿Quieres HUD minimalista o panel detallado (stats, buffs, historial)?
HUD, abajo salud del personaje de quien tiene el turno, habilidades, arriba. orden de quien sigue despues de el
3. ¿Debemos incluir tutorial inicial o tooltips contextualizados?
dejalo para una feature
4. ¿Idioma objetivo: solo español o internacionalización futura?
primero y más importante, español e ingles, pero en caso de requerir otro idioma, debe ser lo suficientemente escalable para incorporarlos

### 6.7 Arte, audio y feedback

1. ¿Usaremos placeholders geométricos inicialmente (recomendado)?
ok
2. ¿Tienes assets propios o debemos preparar estructura para integrar assets luego?
no, aun no... pero dejalo tan simple de hacer que sea muy facil agregarlos eventualmente
3. ¿Incluimos sonido/FX desde el MVP o lo dejamos para fase 2?
si, dejemoslo para despues

### 6.8 Persistencia y datos

1. ¿Quieres guardar progreso local (`localStorage`) desde esta fase?
si
2. ¿Qué datos mínimos se guardan? (mejor piso, estadísticas, configuración)
todos los necesarios para que no sea perdido el progreso, debe quedar practicamente como estaba antes de desertar
3. ¿Necesitas posibilidad de "continuar partida" o solo "nueva run"?
continuar

### 6.9 Rendimiento y restricciones

1. ¿Hay objetivo mínimo de FPS o hardware de referencia?
pues, lo minimo son 45 pfs
2. ¿Debemos optimizar desde inicio para partidas largas (muchos pisos)?
si, aunque no creo que sea algo complejo. no deberia ponerse lento o sobre cargarse
3. ¿Existe límite de memoria o tamaño de build?
no que yo sepa

### 6.10 Gestión del proyecto

1. ¿Quieres roadmap por fases con entregables semanales?
no exactamente, es un proyecto personal, donde puedo avanzar lo que quiera. pero inicialmente quisiera algo basico para ir sacando nuevas ideas
2. ¿Cómo priorizamos cambios: jugabilidad, arquitectura, UI, rendimiento?
jugabilidad y arquitectura
3. ¿Debemos documentar cada decisión técnica en ADRs (Architecture Decision Records)?
no
4. ¿Necesitas convención de commits y versionado semántico?
si, no te preocupes. yo me encargo de hacer eso manualmente
---

## 7) Criterios de aceptación iniciales (propuestos)

1. El juego inicia y muestra escena de combate sin errores de compilación.
2. Se puede completar al menos 1 ciclo completo de turnos (jugadores + enemigos).
3. Al derrotar enemigos, avanza de piso y escala dificultad visible.
4. Al morir todos los jugadores, se muestra Game Over y permite reiniciar.
5. El código compila en TypeScript estricto.
6. El diseño permite agregar nuevas habilidades sin modificar la lógica base de escena.

---

## 8) Riesgos iniciales y mitigaciones

- **Riesgo:** Deuda técnica por crecer en archivo único.
  - **Mitigación:** Modularizar por hitos definidos (fase 2).
- **Riesgo:** Desbalance de combate temprano.
  - **Mitigación:** Tabla de parámetros y pruebas rápidas por piso.
- **Riesgo:** Acoplamiento UI/lógica de batalla.
  - **Mitigación:** Introducir contratos (`ISkill`, eventos) y separación por módulos.
- **Riesgo:** Cambios frecuentes de alcance.
  - **Mitigación:** Congelar alcance MVP y registrar cambios en sección 10.

---

## 9) Plan de trabajo propuesto (macro)

1. Cerrar respuestas de la sección 6.
2. Inicializar proyecto TypeScript + Phaser con estructura base.
3. Implementar bucle de combate estable (turnos + habilidades + IA).
4. Implementar progresión de pisos y Game Over.
5. Refactor modular (si se comienza monolítico).
6. Añadir persistencia básica y ajustes de balance.
7. Hardening: validaciones, limpieza técnica, lints.

---

## 10) Registro de decisiones y cambios (bitácora)

> Usar esta tabla durante todo el desarrollo.

| Fecha | Tipo | Módulo | Decisión/Cambio | Motivo | Impacto | Estado |
|------|------|--------|-----------------|--------|---------|--------|
| 2026-04-14 | Inicial | Documento | Se crea trazabilidad base | Alinear inicio de proyecto | Reduce ambigüedad | Hecho |
| 2026-04-14 | Arquitectura | Base proyecto | Se inicia modular desde el día 1 con Vite + TypeScript estricto + Phaser | Cumplir calidad y escalabilidad definida | Base mantenible para iteraciones rápidas | Hecho |
| 2026-04-14 | Gameplay | Core loop | Se implementa flujo: seleccionar héroe inicial -> combate por turnos -> pisos infinitos -> game over/reintento | Cumplir definición de "completo" de primera versión | Ya existe vertical slice jugable | En progreso |
| 2026-04-14 | Progresión | Party system | Se incorpora reclutamiento cada 2 pisos y desbloqueo de habilidades por supervivencia (2 pisos) | Responder dinámica solicitada para crecimiento del equipo | Mejora retención y profundidad de run | En progreso |
| 2026-04-14 | Persistencia | Save system | Se agrega guardado local con opción de continuar partida | Evitar pérdida de progreso al salir | Experiencia de usuario continua | En progreso |
| 2026-04-14 | UX | Historial combate | Se amplía historial interactivo a 15 movimientos | Mejorar trazabilidad durante combates largos | Mayor claridad para toma de decisiones | Hecho |
| 2026-04-14 | Gameplay | IA enemiga avanzada | Slime se divide al recibir daño, Mago Esqueleto invoca adds, Demonio invoca refuerzos en 75% y 25% de vida | Aumentar profundidad táctica y variedad | Combates con prioridad de objetivos dinámica | Hecho |
| 2026-04-14 | Visual | Escenario y feedback | Se añaden fondos por sala (campo, noche azul, mazmorra roja) y animaciones de acción | Mejorar legibilidad y sensación de impacto | Mayor inmersión y feedback de batalla | Hecho |

---

## 11) Bloqueos y dependencias

| Fecha | Bloqueo/Dependencia | Severidad | Acción | Responsable | Estado |
|------|----------------------|-----------|--------|-------------|--------|
| - | - | - | - | - | Abierto |

---

## 12) Próximo paso inmediato

Siguiente iteración de gameplay:

1. Ajustar balance de tasas de invocación por tipo de enemigo.
2. Definir límite duro de enemigos en campo y comportamiento de overflow.
3. Añadir VFX/sonido por tipo de acción (golpe, curación, invocación).
4. Introducir tooltips de estados para facilitar lectura táctica.

