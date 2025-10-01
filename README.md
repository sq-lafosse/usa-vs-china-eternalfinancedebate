# USA vs China Eternal Finance Debate

Este repositorio ahora incluye un pequeño script en Python que te permite hacer
que dos modelos conversen sobre el tema que elijas. La implementación usa las
APIs de ChatGPT (OpenAI) y DeepSeek porque ambas exponen un endpoint compatible
con Chat Completions. Puedes usarlo como base para prototipar debates de mayor
duración, resúmenes posteriores u orquestaciones multi-agente más complejas.

## Requisitos previos

1. Python 3.10 o superior.
2. Una clave de API válida para cada servicio:
   - `OPENAI_API_KEY` para el endpoint de OpenAI.
   - `DEEPSEEK_API_KEY` para DeepSeek.
3. Instala las dependencias con:

   ```bash
   pip install -r requirements.txt
   ```

## Uso rápido

```bash
export OPENAI_API_KEY="tu_clave_de_openai"
export DEEPSEEK_API_KEY="tu_clave_de_deepseek"
python ai_debate.py "Cómo optimizar mi flujo de trabajo de desarrollo" --turns 12
```

Durante la ejecución se imprimirá la transcripción alternada entre ChatGPT y
DeepSeek. Puedes controlar varios parámetros:

- `--turns`: número total de mensajes (por defecto 10).
- `--first-speaker`: define quién inicia (`openai` o `deepseek`).
- `--openai-model` / `--deepseek-model`: para utilizar modelos específicos si
  tienes acceso a variantes distintas.
- `--delay`: pausa opcional entre turnos en segundos, útil si estás mostrando el
debate en vivo.
- `--output`: ruta de archivo donde guardar la conversación completa.

### Ejemplo con archivo de salida

```bash
python ai_debate.py "Plan de lanzamiento de un nuevo producto SaaS" --turns 14 --output debate.txt
```

El archivo `debate.txt` contendrá algo como:

```
ChatGPT: Propongo que empecemos delineando los objetivos del proyecto...
DeepSeek: Coincido, además podríamos mapear riesgos regulatorios para los dos mercados...
```

## Personalización

El script define prompts de sistema simples para cada agente. Puedes modificarlos
en `ai_debate.py` (variables `OPENAI_CONFIG` y `DEEPSEEK_CONFIG`) para ajustar el tono,
estilo o rol de cada modelo. También puedes extender el módulo para añadir más
modelos, producir resúmenes automáticos tras el debate o integrar persistencia en
bases de datos.

## Limitaciones conocidas

- Cada servicio facturará las peticiones de acuerdo a su propio esquema de
  precios; revisa tu cuota antes de ejecutar debates largos.
- La transcripción se guarda en memoria; para debates muy extensos conviene
  persistirla en disco o aplicar compresión/resúmenes a medida que crece.
- El script no implementa reintentos ni backoff exponencial; podrías añadirlos si
  planeas automatizar debates continuos.
