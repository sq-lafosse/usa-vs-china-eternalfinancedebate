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

def generar_respuesta(personaje_prompt, mensaje):
	response = client.chat.completions.create(
		model="gpt-4o-mini",
		messages=[
			{"role": "system", "content": personaje_prompt},
			{"role": "user", "content": mensaje}
		]
	)
	return response.choices[0].message.content.strip()

def debate(turnos=1):
	mensaje = "Hablemos sobre el futuro de la inversión en tecnología."
	for i in range(turnos):
		print(f"\n=== Turno {i+1} ===")
		buffett_respuesta = generar_respuesta(buffett_prompt, mensaje)
		print("Buffett:", buffett_respuesta)
		cheah_respuesta = generar_respuesta(cheah_prompt, buffett_respuesta)
		print("Cheah:", cheah_respuesta)
		mensaje = cheah_respuesta

if __name__ == "__main__":
	debate()
