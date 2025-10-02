"""
server.py - Backend FastAPI para Infinite Debate

Endpoints:
- POST /turn: genera respuesta de Buffett o Cheah usando la logica avanzada de main.py
- GET /seed: devuelve un tema inicial aleatorio
- (Opcional) /tts: placeholder para TTS real (Deepgram) o fallback a Web Speech API en frontend

Notas:
- La clase MemoriaDebate se instancia por sesion (simple para demo, global para prototipo)
- Habilita CORS para http://localhost:5173
- Ver comentarios para enlaces a Deepgram y referencias de Infinite Conversation
"""

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import random
import os
from infinite_debate.main import (
    generar_respuesta,  # O reemplazar por generar_respuesta_mejorada si la implementas
    buffett_prompt,
    cheah_prompt,
    MemoriaDebate
)

# === Configuracion FastAPI ===
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Memoria global (para demo, ideal: por usuario/sesion) ===
memoria = MemoriaDebate()

# === Seeds de temas ===
TOPICS = [
    "Dividendos vs DY en mercados emergentes",
    "PEG vs ROE en tecnologicas chinas y americanas",
    "PFS y riesgo regulatorio en Asia",
    "Transicion energetica: BYD vs Tesla",
    "IA y semiconductores: Nvidia vs SMIC",
    "Inflacion y tasas de interes globales",
    "Dolar fuerte y exportaciones asiaticas",
    "Infraestructura vs apps: China Mobile vs Apple",
    "Politica y empresas estatales",
    "Crecimiento vs calidad: Graham vs value asiatico",
    "Dividendos politicos y su impacto",
    "Gestion de riesgo en mercados volatiles"
]

class TurnRequest(BaseModel):
    speaker: str  # "buffett" o "cheah"
    message: str

@app.post("/turn")
async def turn(req: TurnRequest):
    # Selecciona prompt y personaje
    if req.speaker == "buffett":
        prompt = buffett_prompt
    else:
        prompt = cheah_prompt
    # Llama a la funcion de generacion avanzada
    respuesta = generar_respuesta(prompt, req.message, req.speaker)
    # (Opcional) Generar audio con TTS real aqui y guardar como /tts/{uuid}.mp3
    audio_url = f"/tts/{uuid.uuid4()}.mp3"  # Placeholder
    return {"text": respuesta, "audioUrl": audio_url}

@app.get("/seed")
async def seed():
    tema = random.choice(TOPICS)
    return {"seed": tema}

# (Opcional) Endpoint para TTS real
# @app.get("/tts/{audio_id}")
# async def tts(audio_id: str):
#     # Implementar integracion con Deepgram TTS aqui
#     pass

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

# Referencias:
# - https://developers.deepgram.com/docs/tts
# - https://infiniteconversation.com/faq
# - https://arstechnica.com/information-technology/2023/07/ai-generated-infinite-podcast-imitates-lex-fridman-and-joe-rogan/


