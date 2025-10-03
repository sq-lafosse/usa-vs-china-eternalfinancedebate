import os
import random
import re
import time
from typing import Dict, List, Optional

import requests
from requests import RequestException


# === Memoria de contexto para el debate ===
class MemoriaDebate:
    def __init__(self):
        self.metricas_buffett = set()
        self.metricas_cheah = set()
        self.empresas = set()
        self.temas = set()

    def registrar_metricas(self, personaje, metricas):
        if personaje == "buffett":
            self.metricas_buffett.update(metricas)
        else:
            self.metricas_cheah.update(metricas)

    def registrar_empresas(self, empresas):
        self.empresas.update(empresas)

    def registrar_tema(self, tema):
        self.temas.add(tema)

    def obtener_contexto_evitacion(self, personaje):
        contexto = []
        if personaje == "buffett" and self.metricas_buffett:
            contexto.append(
                f"Evita repetir metricas ya mencionadas: {', '.join(self.metricas_buffett)}."
            )
        if personaje == "cheah" and self.metricas_cheah:
            contexto.append(
                f"Evita repetir metricas ya mencionadas: {', '.join(self.metricas_cheah)}."
            )
        if self.empresas:
            contexto.append(f"Evita repetir empresas ya mencionadas: {', '.join(self.empresas)}.")
        if self.temas:
            contexto.append(f"Varia el tema, ya se hablo de: {', '.join(self.temas)}.")
        return " ".join(contexto)


# === Postprocesamiento avanzado ===
def mejorar_fluidez_texto(texto: str) -> str:
    # Elimina repeticiones de palabras/frases, puntos dobles, cortes bruscos
    texto = re.sub(r"(\b\w+\b)(\s+\1\b)+", r"\1", texto, flags=re.IGNORECASE)
    texto = re.sub(r"(\b\w{3,}\b)([^\w\n]+\1\b)+", r"\1", texto, flags=re.IGNORECASE)
    texto = re.sub(r"\.{2,}", ".", texto)
    texto = re.sub(r"\s+\.", ".", texto)
    texto = re.sub(r"\bval\b", "valor", texto)
    texto = re.sub(r"\bco mo\b", "como", texto)
    texto = re.sub(r"\s{2,}", " ", texto)
    return texto.strip()


def reconstruir_oraciones(texto: str) -> str:
    texto = re.sub(r"\bval\b", "valor", texto)
    texto = re.sub(r"\bco mo\b", "como", texto)
    texto = re.sub(r"\bempres\b", "empresa", texto)
    texto = re.sub(r"\bmercad\b", "mercado", texto)
    return texto


def evitar_repeticion(texto: str) -> str:
    frases = re.split(r"(?<=[.!?])\s+", texto)
    vistas = set()
    resultado = []
    for frase in frases:
        f = frase.strip().lower()
        if f and f not in vistas:
            resultado.append(frase.strip())
            vistas.add(f)
    return " ".join(resultado)


# === Logica avanzada de formato, longitud, personalidad y bancos de preguntas ===
REGLA_HINT = (
    "Recuerda: 2-4 frases, 350-550 caracteres, sin listas ni negritas, "
    "incluye al menos una metrica concreta (p.ej., ROE, P/B, PEG, DY, PFS), "
    "y termina con una sola pregunta."
)


def prompt_personaje(personaje_prompt: str) -> str:
    return personaje_prompt.strip() + "\n\n" + REGLA_HINT


MIN_LEN, MAX_LEN = 350, 550

PREGUNTAS_BUFFETT = [
    "No crees que estas sobrevalorando el crecimiento frente a la calidad?",
    "Como justificas esa valuacion con ROEs modestos?",
    "No subestimas el riesgo regulatorio en tu tesis?",
]
PREGUNTAS_CHEAH = [
    "No estas ignorando el dividendo politico (hongli)?",
    "Como ajustas tu analisis a la velocidad asiatica?",
    "Por que sigues buscando analogos occidentales en un rio distinto?",
]


def limpiar_formato(texto: str) -> str:
    t = re.sub(r"[*\-]+(\s+)", " ", texto)
    t = re.sub(r"\n+", " ", t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    t = t.replace("**", "")
    return t


def limitar_oraciones(texto: str, max_oraciones: int = 4) -> str:
    oraciones = re.split(r"(?<=[.!?])\s+", texto)
    if len(oraciones) > max_oraciones:
        texto = " ".join(oraciones[:max_oraciones]).strip()
    return texto


def recortar_a_rango(texto: str) -> str:
    if len(texto) <= MAX_LEN:
        return texto
    corte = max(
        texto.rfind(".", 0, MAX_LEN),
        texto.rfind("?", 0, MAX_LEN),
        texto.rfind("!", 0, MAX_LEN),
    )
    if corte != -1 and corte + 1 >= MIN_LEN:
        return texto[: corte + 1].strip()
    return texto[:MAX_LEN].rstrip()


def asegurar_pregunta(texto: str, personaje: str) -> str:
    t = texto.rstrip()
    if not t.endswith("?"):
        pool = PREGUNTAS_BUFFETT if personaje == "buffett" else PREGUNTAS_CHEAH
        t += " " + random.choice(pool)
    t = re.sub(r"\?+\s*$", "?", t)
    return t


def es_corto(texto: str) -> bool:
    oraciones = re.split(r"[.!?]", texto)
    oraciones = [o.strip() for o in oraciones if o.strip()]
    return len(texto) < MIN_LEN or len(oraciones) < 2


def postprocesar(texto: str, personaje: str) -> str:
    t = limpiar_formato(texto)
    t = limitar_oraciones(t, max_oraciones=4)
    t = recortar_a_rango(t)
    t = asegurar_pregunta(t, personaje)
    return t


# === Integracion con Ollama ===
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_CHAT_ENDPOINT = OLLAMA_URL.rstrip("/") + "/api/chat"
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:latest")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "30"))
OLLAMA_RETRIES = int(os.getenv("OLLAMA_RETRIES", "2"))


def _extraer_contenido_ollama(payload: Dict) -> Optional[str]:
    if not isinstance(payload, dict):
        return None

    message = payload.get("message")
    if isinstance(message, dict):
        contenido = message.get("content")
        if isinstance(contenido, str) and contenido.strip():
            return contenido

    mensajes = payload.get("messages")
    if isinstance(mensajes, list):
        for msg in reversed(mensajes):
            if not isinstance(msg, dict):
                continue
            rol = msg.get("role") or msg.get("type")
            if rol in {"assistant", "model"}:
                contenido = msg.get("content")
                if isinstance(contenido, str) and contenido.strip():
                    return contenido

    respuesta = payload.get("response")
    if isinstance(respuesta, str) and respuesta.strip():
        return respuesta

    return None


def ollama_request(
    modelo: str,
    system_prompt: str,
    user_prompt: str,
    options: Optional[Dict] = None,
    history: Optional[List[Dict]] = None,
    timeout: Optional[float] = None,
    retries: Optional[int] = None,
) -> str:
    mensajes: List[Dict[str, str]] = [
        {"role": "system", "content": system_prompt},
    ]

    if history:
        mensajes.extend(history)

    mensajes.append({"role": "user", "content": user_prompt})

    body: Dict = {
        "model": modelo,
        "messages": mensajes,
        "stream": False,
    }
    if options:
        body["options"] = options

    intentos = retries if retries is not None else OLLAMA_RETRIES
    espera = 1.0
    last_error: Optional[Exception] = None

    for intento in range(1, intentos + 1):
        try:
            respuesta = requests.post(
                OLLAMA_CHAT_ENDPOINT,
                json=body,
                timeout=timeout or OLLAMA_TIMEOUT,
            )
            respuesta.raise_for_status()
            data = respuesta.json()
            contenido = _extraer_contenido_ollama(data)
            if not contenido:
                raise RuntimeError("La respuesta de Ollama no contiene mensaje de asistente.")
            return contenido.strip()
        except (RequestException, ValueError, RuntimeError) as exc:
            last_error = exc
            if intento < intentos:
                time.sleep(espera)
                espera *= 2
            else:
                break

    raise RuntimeError(f"Fallo al invocar Ollama despues de {intentos} intentos: {last_error}")


def generar_respuesta(personaje_prompt, mensaje, personaje, history: Optional[List[Dict]] = None):
    msg_ctx = (
        "Debate Oriente vs Occidente. Responde con tu personalidad y principios. "
        "Incluye al menos una metrica concreta (ROE, P/B, flujo de caja; o PEG, DY, PFS). "
        "Sin bullets ni negritas. Cierra con una sola pregunta.\n\n"
        f'Mensaje del otro inversor: "{mensaje}"'
    )

    temp = 0.7 if personaje == "buffett" else 0.8
    opciones = {
        "temperature": temp,
        "num_predict": 220,
    }

    try:
        texto = ollama_request(
            OLLAMA_MODEL,
            prompt_personaje(personaje_prompt),
            msg_ctx,
            options=opciones,
            history=history,
        )
    except RuntimeError as exc:
        raise RuntimeError(f"No fue posible generar respuesta para {personaje}: {exc}") from exc

    if es_corto(texto):
        try:
            texto = ollama_request(
                OLLAMA_MODEL,
                prompt_personaje(personaje_prompt),
                msg_ctx + "\n\nAmplia en 1-2 frases mas y cierra con una sola pregunta.",
                options=opciones,
                history=history,
            )
        except RuntimeError:
            pass

    return postprocesar(texto, personaje)


# Leer prompts base
script_dir = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(script_dir, "buffett.txt"), "r", encoding="utf-8") as f:
    buffett_prompt = f.read()

with open(os.path.join(script_dir, "cheah.txt"), "r", encoding="utf-8") as f:
    cheah_prompt = f.read()


def debate(turnos=3):
    mensaje = (
        "Warren, tu busqueda de negocios simples funciona en mercados maduros; "
        "en Asia, la calidad incluye guoqing (situacion nacional) y hongli (dividendo politico). "
        "Si el PEG esta por debajo de 1.5 y el PFS es alto, no merece una prima?"
    )
    print("*** DEBATE INICIAL ***")
    print(f"Cheah: {mensaje}")

    for i in range(turnos):
        print(f"\n{'=' * 50}\n*** TURNO {i + 1} ***\n{'=' * 50}")
        buffett_respuesta = generar_respuesta(buffett_prompt, mensaje, "buffett")
        print(f"BUFFETT: {buffett_respuesta}")
        cheah_respuesta = generar_respuesta(cheah_prompt, buffett_respuesta, "cheah")
        print(f"CHEAH: {cheah_respuesta}")
        mensaje = cheah_respuesta


if __name__ == "__main__":
    debate()
