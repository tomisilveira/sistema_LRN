# Encuesta de satisfacción a familias — Liga Robótica Neuquina 2026

Implementar en **liga-robotica.neuquen.dev/encuesta-satisfaccion**.

La carpeta `diseño/` es la referencia de diseño, textos, animaciones y lógica:

- `Flow.dc.html`: el flujo completo, con los 6 pasos, el estado, las reacciones del robot, la pista de progreso, el confeti y el cierre. Los estilos están en `<helmet><style>` y la lógica en el `<script>` (`renderVals`, `react`, `goTo`, `countUp`).
- `Robot.dc.html`: la mascota. SVG, animaciones CSS y efecto de escritura del texto.
- `Estados.dc.html`: catálogo de los 8 estados del robot.

Son maquetas de un editor de diseño, no código de producción. Hay que **reimplementarlas con el stack del proyecto** respetando el comportamiento. Los textos se copian literal.

---

## 1. Ruta y acceso

- Ruta pública: `/encuesta-satisfaccion?t=<token>`.
- El token va en el mail y se genera por inscripción. Tiene que ser **aleatorio y no adivinable** (por ejemplo, 128 bits en base64url), nunca el id de la inscripción. Sirve para:
  - vincular la respuesta a disciplina, categoría, localidad y encuentro sin preguntarlos;
  - permitir una sola respuesta por token: si ya existe, se actualiza.
- Sin token también se puede responder, con `inscripcion_id = null`.
- Agregar meta tags para compartir: título "¿Cómo viviste la Liga Robótica Neuquina?" y el logo como imagen.

## 2. Formatos (responsive)

Se diseñó **primero para celular**, porque es por donde va a entrar casi todo el mundo desde el mail.

- **Celular (menos de 1024 px):** una columna.
  - Arriba, fijo: el logo y "Paso N de 4"; la pista de progreso; el robot chico (58 px) con su globo de 3 líneas.
  - En el medio, desplazable: las preguntas.
  - Abajo, fijo: los botones Atrás y Siguiente.
  - El robot tiene que estar siempre a la vista, porque reacciona a cada toque.
- **Compu (1024 px o más):** dos columnas.
  - Izquierda, fija, de 440 px y fondo blanco, con una franja naranja de 6 px en el borde: el logo; "Encuesta a familias · Final Ruca Che 2026"; el robot grande (170 px) con el globo debajo; la pista de progreso; abajo, la franja "Rumbo a la 3ª edición" (2025 · 2026 "estás acá" · 2027).
  - Derecha: las preguntas en una columna de 600 px como máximo, centrada y desplazable, con la navegación abajo.
- En los pasos 0 (bienvenida) y 5 (gracias) del celular, el robot va grande dentro del contenido, en columna, y no en el encabezado.
- Al cambiar de paso, el contenido vuelve arriba.

## 3. Flujo

| Paso | Contenido | Navegación |
|---|---|---|
| 0 · Bienvenida | Sello "2ª edición · 2026", título, bajada, "3 minutos · Respuestas confidenciales", ¿quién responde? | Empezar |
| 1 · La experiencia | caritas, qué te contó, primera vez, 0 a 10 | Atrás · Siguiente |
| 2 · Conocer la Liga | cómo se enteró, conocía a ANIDE, sede cercana | Atrás · Siguiente |
| 3 · El día del evento | info previa, 3 puntajes de 1 a 5, horas, momento malo | Atrás · Siguiente |
| 4 · Lo que viene | vuelve en 2027, propuestas de ANIDE + mail + consentimiento, qué cambiaría, bloque chicos | Atrás · **Enviar respuestas** (naranja) |
| 5 · ¡Gracias! | confeti, robot festejando, "Rumbo a la 3ª edición" con estadísticas, link a anide.gob.ar | sin navegación |

- Lo que se carga se mantiene al ir y volver (estado en el cliente). Conviene guardarlo también en `sessionStorage` por si se recarga la página.
- Ninguna pregunta es obligatoria salvo "¿quién responde?".
- Si eligen **"Docente o referente de sede"**: el formulario para docentes está **pendiente de diseño**. Por ahora sigue el flujo de familias. Dejar un TODO para derivar a `/encuesta-satisfaccion/docentes`.

## 4. Preguntas y valores

Los textos exactos están en `Q` dentro de `Flow.dc.html`.

- `quien_responde`: `padres` · `docente` · `mayor`
- `experiencia`: 1 a 5 (Mal · Regular · Bien · Muy bien · ¡Genial!)
- `que_conto`: texto libre
- `primera_vez`: `primera` · `regional` · `2025`
- `nps`: 0 a 10
- `como_se_entero[]`: `escuela` · `sede` · `redes` · `familia` · `medios`
- `conocia_anide`: `si` · `suena` · `no`
- `sede_cercana`: `si` · `no` · `quiero_info`
- `info_previa`: `si` · `mas_o_menos` · `no`
- `puntaje_comodidad`, `puntaje_seguridad`, `puntaje_esperas`: 1 a 5
- `horas_total`: `<3` · `3-6` · `>6`
- `momento_malo`: texto libre (opcional)
- `volveria_2027`: `si` · `tal_vez` · `no`
- `interes_propuestas[]`: `robotica` · `programacion` · `ia`
- `email_contacto` y `acepta_contacto`: la casilla de consentimiento va **sin marcar por defecto**. El mail se guarda solo si `acepta_contacto = true`.
- `cambiaria`: texto libre
- `chico_mas_gusto`, `chico_menos_gusto`: texto libre. **No pedir nombre ni edad del menor.**

## 5. Robot y animaciones

### Componente Robot

Props: `mood`, `message`, `size`, `layout` (`fila` | `columna`), `compact`, `minLines` y `bump`.

- El texto se escribe a unos 26 ms por letra. Solo se reescribe cuando **cambia `message`**; si cambia solo `mood`, no.
- Al cambiar el mensaje, el globo hace un "pop" de entrada.
- Cada vez que cambia `bump`, el robot da un **salto** de 0,46 s.
- `minLines` reserva el alto del globo para que la pantalla no salte.
- Los 8 estados (`saludo`, `curioso`, `feliz`, `festejo`, `pensando`, `sorpresa`, `triste`, `atento`) y sus movimientos están en `Robot.dc.html` y `Estados.dc.html`.

### Reacciones (función `react` en Flow)

Cada respuesta incrementa `bump` y cambia el mensaje:

- `quien_responde`:
  - padres → feliz: "¡Genial! Son 3 minutos, y al final le podés pasar el celu a tu hijo/a."
  - docente → atento: "¡Gracias, profe! Te llevo a las preguntas para docentes."
  - mayor → curioso: "¡Bienvenido/a! Contame cómo viviste la competencia."
- `experiencia` de 1 a 5 → triste, pensando, curioso, feliz y festejo, con un mensaje propio cada uno.
- `conocia_anide`:
  - si → festejo
  - suena → feliz
  - no → saludo
  - En los tres casos el mensaje explica qué es ANIDE.
- `volveria_2027`:
  - si → festejo: "¡Sííí! Te esperamos en la 3ª edición."
  - tal_vez → pensando
  - no → triste
- `nps`:
  - 9 o más → festejo
  - 7 u 8 → feliz
  - 6 o menos → pensando
- `acepta_contacto` marcado → feliz.
- Cualquier otra respuesta rota frases cortas: "¡Anotado!", "¡Bip! Guardado.", "¡Buenísimo!", "¡Gracias por contarnos!", "¡Sigamos!".
- Al empezar a escribir un texto libre (primer carácter) → curioso: "Te leo… tomate tu tiempo." Las teclas siguientes no generan reacción.
- **Inactividad:** después de 9 s sin interacción en los pasos 1 a 4 → saludo: "¿Seguimos? Te falta poquito."
- Cada paso tiene un mensaje inicial (`DEF` en Flow).

### Otros movimientos

- **Pista de progreso:**
  - un robotito montado recorre la pista con transición elástica (0,75 s);
  - 4 puntos de control se pintan de naranja;
  - una bandera a cuadros marca el final.
- **Cambio de paso:** el contenido entra deslizándose desde la derecha y las tarjetas aparecen escalonadas, con 70 ms entre una y otra. Para que la animación se repita en cada paso, alternar el nombre de la animación, o usar una `key` por paso en React.
- **Opciones:** latido al seleccionar y achique al presionar. Las caritas se agrandan y se sacuden. Los números se rellenan con un pop.
- **Botones:** la flecha de "Siguiente" se mueve de un lado al otro. "Enviar respuestas" emite un brillo naranja pulsante.
- **Gracias:**
  - unas 46 piezas de confeti naranja, celeste y gris azulado caen una sola vez;
  - las estadísticas cuentan desde 0 en alrededor de 1 s, con ease-out;
  - el punto de 2027 late.

### Reglas

- **La animación premia, no frena.** Nada bloquea la interacción: se puede tocar y avanzar mientras el robot escribe o se mueve.
- Con `prefers-reduced-motion: reduce` se apagan todas las animaciones y transiciones, no hay confeti, el texto aparece completo y los números se muestran ya en su valor final.
- Todo con SVG y CSS, sin librerías de animación, para que cargue rápido con poca señal.

## 6. "Rumbo a la 3ª edición" (datos)

Los datos tienen que ser **configurables**, en un archivo de configuración o en la base de datos, no hardcodeados en el componente:

```json
[
  { "anio": 2025, "edicion": "1ª", "texto": "2 encuentros regionales, en Confluencia y Lagos del Sur, y la Final en el Ruca Che.",
    "stats": [ {"valor":150,"prefijo":"+","label":"robots en la Final"},
               {"valor":null,"label":"participantes"},
               {"valor":null,"label":"espectadores"} ],
    "nota": "Datos de la Final 2025." },
  { "anio": 2026, "edicion": "2ª", "texto": "3 encuentros regionales, en Chos Malal, Villa La Angostura y Plaza Huincul, y la Final en el Ruca Che. ¡Gracias por estar!",
    "stats": [ {"valor":198,"prefijo":"+","label":"robots"},
               {"valor":303,"prefijo":"+","label":"participaciones"},
               {"valor":2000,"prefijo":"+","label":"espectadores en la Final"} ],
    "nota": "Robots y participaciones: suma de los 4 encuentros de 2026." },
  { "anio": 2027, "edicion": "3ª", "texto": "La estamos armando con lo que nos contaste. ¡Te esperamos!", "proxima": true }
]
```

- Una estadística con `valor: null` **no se muestra** en producción. En la maqueta aparece como "[N]" solo para marcar el faltante.
- Los números se formatean con `es-AR` (2.000).
- **Pendiente de confirmar:** los robots de 2026 son una estimación (2 por equipo de fútbol y 1 por equipo de sumo) y la planilla de la Final es anterior al evento. Si el sistema de gestión tiene los acreditados reales, calcularlo desde ahí.

## 7. Estilo visual

- **Colores:**
  - naranja `#FFA200`: acento, nunca como color de texto sobre blanco;
  - gris azulado `#33525C`: botones e iconos;
  - texto `#1F3A43`;
  - texto secundario `#4A6670`;
  - celeste `#B4DDE5` y `#8CC6D3`;
  - fondo `#F3F8F9`;
  - bordes `#CFE3E8` y `#DCE9EC`;
  - opción seleccionada: fondo `#FFF4DE` con borde `#F59E0B`.
- **Tipografías** (Google Fonts): Exo 2 (700–800) para títulos y Nunito (400–700) para texto.
- Tarjetas con radio de 18 px. Opciones de 50 px de alto como mínimo. Botones de 54 px.
- El contraste del texto es de 4,5:1 como mínimo. Todos los controles son reales (`button`, `input`, `label`).

## 8. Datos y administración

Tabla `encuesta_satisfaccion_familias`:

```
id, token (unique), inscripcion_id (nullable), quien_responde,
experiencia, que_conto, primera_vez, nps,
como_se_entero (json), conocia_anide, sede_cercana,
info_previa, puntaje_comodidad, puntaje_seguridad, puntaje_esperas,
horas_total, momento_malo,
volveria_2027, interes_propuestas (json),
acepta_contacto (bool), email_contacto (null si no acepta),
cambiaria, chico_mas_gusto, chico_menos_gusto,
user_agent_tipo (mobile/desktop), created_at, updated_at
```

- Validar en el servidor: valores permitidos, rangos y un máximo de 2000 caracteres en los textos libres. Agregar rate limit por IP.
- Vista de administración protegida con login:
  - conteos por pregunta;
  - NPS (porcentaje de 9–10 menos porcentaje de 0–6);
  - promedio de los puntajes;
  - listado de respuestas abiertas;
  - filtros por encuentro, disciplina y localidad a través de `inscripcion_id`;
  - export a CSV.

## 9. Criterios de aceptación

- Se completa en menos de 3 minutos desde el celular.
- Se ve bien a 360, 390, 768, 1280 y 1440 px de ancho.
- Funciona sin token.
- Se puede ir y volver sin perder datos, y una recarga no borra lo cargado.
- El mail solo se guarda con el consentimiento marcado.
- Con movimiento reducido no hay animaciones.
- No se pide ningún dato identificatorio de menores.
- El tiempo hasta poder interactuar en 3G está por debajo de 3 s.
