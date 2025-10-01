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
			contexto.append(f"Evita repetir métricas ya mencionadas: {', '.join(self.metricas_buffett)}.")
		if personaje == "cheah" and self.metricas_cheah:
			contexto.append(f"Evita repetir métricas ya mencionadas: {', '.join(self.metricas_cheah)}.")
		if self.empresas:
			contexto.append(f"Evita repetir empresas ya mencionadas: {', '.join(self.empresas)}.")
		if self.temas:
			contexto.append(f"Varía el tema, ya se habló de: {', '.join(self.temas)}.")
		return " ".join(contexto)
# === Postprocesamiento avanzado ===
import re

def mejorar_fluidez_texto(texto: str) -> str:
	# Elimina repeticiones de palabras/frases, puntos dobles, cortes bruscos
	texto = re.sub(r'(\b\w+\b)(\s+\1\b)+', r'\1', texto, flags=re.IGNORECASE)  # palabras repetidas
	texto = re.sub(r'(\b\w{3,}\b)([^\w\n]+\1\b)+', r'\1', texto, flags=re.IGNORECASE)  # frases repetidas
	texto = re.sub(r'\.{2,}', '.', texto)  # puntos dobles
	texto = re.sub(r'\s+\.', '.', texto)  # espacio antes de punto
	texto = re.sub(r'\bval\b', 'valor', texto)  # ejemplo de corte común
	texto = re.sub(r'\bco mo\b', 'como', texto)
	texto = re.sub(r'\s{2,}', ' ', texto)
	return texto.strip()

def reconstruir_oraciones(texto: str) -> str:
	# Corrige palabras cortadas comunes (puedes ampliar la lista)
	texto = re.sub(r'\bval\b', 'valor', texto)
	texto = re.sub(r'\bco mo\b', 'como', texto)
	texto = re.sub(r'\bempres\b', 'empresa', texto)
	texto = re.sub(r'\bmercad\b', 'mercado', texto)
	return texto

def evitar_repeticion(texto: str) -> str:
	# Elimina frases duplicadas dentro del mismo texto
	frases = re.split(r'(?<=[.!?])\s+', texto)
	vistas = set()
	resultado = []
	for frase in frases:
		f = frase.strip().lower()
		if f and f not in vistas:
			resultado.append(frase.strip())
			vistas.add(f)
	return ' '.join(resultado)
# === Lógica avanzada de formato, longitud, personalidad y bancos de preguntas ===
import re, random

REGLA_HINT = (
	"Recuerda: 2–4 frases, 350–550 caracteres, sin listas ni negritas, "
	"incluye al menos una métrica concreta (p.ej., ROE, P/B, PEG, DY, PFS), "
	"y termina con una sola pregunta."
)

def prompt_personaje(personaje_prompt: str) -> str:
	return (personaje_prompt.strip() + "\n\n" + REGLA_HINT)

MIN_LEN, MAX_LEN = 350, 550

PREGUNTAS_BUFFETT = [
	"¿No crees que estás sobrevalorando el crecimiento frente a la calidad?",
	"¿Cómo justificas esa valuación con ROEs modestos?",
	"¿No subestimas el riesgo regulatorio en tu tesis?"
]
PREGUNTAS_CHEAH = [
	"¿No estás ignorando el dividendo político (政策红利)?",
	"¿Cómo ajustas tu análisis a la velocidad asiática?",
	"¿Por qué sigues buscando análogos occidentales en un río distinto?"
]

def limpiar_formato(texto: str) -> str:
	# Quita bullets/markdown básicos
	t = re.sub(r"[*•\-]+(\s+)", " ", texto)
	t = re.sub(r"\n+", " ", t)
	t = re.sub(r"\s{2,}", " ", t).strip()
	t = t.replace("**", "")
	return t

def limitar_oraciones(texto: str, max_oraciones=4):
	oraciones = re.split(r"(?<=[.!?])\s+", texto)
	if len(oraciones) > max_oraciones:
		texto = " ".join(oraciones[:max_oraciones]).strip()
	return texto

def recortar_a_rango(texto: str) -> str:
	if len(texto) <= MAX_LEN:
		return texto
	corte = max(texto.rfind(".", 0, MAX_LEN),
				texto.rfind("?", 0, MAX_LEN),
				texto.rfind("!", 0, MAX_LEN))
	if corte != -1 and corte + 1 >= MIN_LEN:
		return texto[:corte+1].strip()
	return texto[:MAX_LEN].rstrip()

def asegurar_pregunta(texto: str, personaje: str) -> str:
	t = texto.rstrip()
	if not t.endswith("?"):
		pool = PREGUNTAS_BUFFETT if personaje == "buffett" else PREGUNTAS_CHEAH
		t += " " + random.choice(pool)
	# Asegura UNA sola pregunta al final
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

def generar_respuesta(personaje_prompt, mensaje, personaje):
	msg_ctx = (
		"Debate Oriente vs Occidente. Responde con tu personalidad y principios. "
		"Incluye al menos una métrica concreta (ROE, P/B, flujo de caja; o PEG, DY, PFS). "
		"Sin bullets ni negritas. Cierra con una sola pregunta.\n\n"
		f'Mensaje del otro inversor: "{mensaje}"'
	)
	temp = 0.7 if personaje == "buffett" else 0.8
	resp = client.chat.completions.create(
		model="gpt-4o-mini",
		max_tokens=220,
		temperature=temp,
		presence_penalty=0.2,
		frequency_penalty=0.2,
		messages=[
			{"role": "system", "content": prompt_personaje(personaje_prompt)},
			{"role": "user", "content": msg_ctx}
		]
	)
	texto = resp.choices[0].message.content.strip()

	if es_corto(texto):
		resp2 = client.chat.completions.create(
			model="gpt-4o-mini",
			max_tokens=220,
			temperature=temp,
			presence_penalty=0.2,
			frequency_penalty=0.2,
			messages=[
				{"role": "system", "content": prompt_personaje(personaje_prompt)},
				{"role": "user", "content": msg_ctx + "\n\nAmplía en 1–2 frases más y cierra con una sola pregunta."}
			]
		)
		texto = resp2.choices[0].message.content.strip()

	return postprocesar(texto, personaje)
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

# Leer prompts base
script_dir = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(script_dir, "buffett.txt"), "r", encoding="utf-8") as f:
	buffett_prompt = f.read()

with open(os.path.join(script_dir, "cheah.txt"), "r", encoding="utf-8") as f:
	cheah_prompt = f.read()



def debate(turnos=3):
	mensaje = (
		"Warren, tu búsqueda de ‘negocios simples’ funciona en mercados maduros; "
		"en Asia, la calidad incluye 国情 (situación nacional) y 政策红利 (dividendo político). "
		"Si el PEG está por debajo de 1.5 y el PFS es alto, ¿no merece una prima?"
	)
	print("🎯 DEBATE INICIAL")
	print(f"Cheah: {mensaje}")

	for i in range(turnos):
		print(f"\n{'='*50}\n🎯 TURNO {i+1}\n{'='*50}")
		buffett_respuesta = generar_respuesta(buffett_prompt, mensaje, "buffett")
		print(f"📈 BUFFETT: {buffett_respuesta}")
		cheah_respuesta = generar_respuesta(cheah_prompt, buffett_respuesta, "cheah")
		print(f"🧧 CHEAH: {cheah_respuesta}")
		mensaje = cheah_respuesta

if __name__ == "__main__":
	debate()
