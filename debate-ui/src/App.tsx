import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

type Speaker = "buffett" | "cheah";

interface Message {
  id: string;
  speaker: Speaker;
  text: string;
}

const PERSONAS: Record<Speaker, { name: string; tagline: string; initials: string; avatarClass: string; bubbleClass: string }> = {
  buffett: {
    name: "Warren Buffett",
    tagline: "USA - Value investing clasico",
    initials: "WB",
    avatarClass: "border border-amber-400/40 bg-amber-500/10 text-amber-100",
    bubbleClass: "border border-amber-400/20 bg-amber-500/5"
  },
  cheah: {
    name: "Cheah Cheng Hye",
    tagline: "Asia - Value con lente oriental",
    initials: "CH",
    avatarClass: "border border-sky-400/40 bg-sky-500/10 text-sky-100",
    bubbleClass: "border border-sky-400/20 bg-sky-500/5"
  }
};

const MAX_AUTO_TURNS = 14;

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
};

function MessageBubble({ message }: { message: Message }) {
  const persona = PERSONAS[message.speaker];
  const isRightAligned = message.speaker === "buffett";

  return (
    <div className={`flex ${isRightAligned ? "justify-end" : "justify-start"}`}>
      <div className={`flex w-full max-w-3xl gap-3 ${isRightAligned ? "flex-row-reverse text-right" : "text-left"}`}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${persona.avatarClass} font-semibold uppercase tracking-wide`}>
          {persona.initials}
        </div>
        <div className={`relative w-full rounded-2xl ${persona.bubbleClass} px-5 py-4 shadow-glow backdrop-blur`}>
          <div className="flex flex-col gap-0.5 text-left">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{persona.name}</span>
            <span className="text-[0.7rem] uppercase tracking-[0.2em] text-slate-500">{persona.tagline}</span>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-100">{message.text}</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [topic, setTopic] = useState("");
  const [openingInput, setOpeningInput] = useState("");
  const [nextSpeaker, setNextSpeaker] = useState<Speaker>("buffett");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSeed, setIsFetchingSeed] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const lastMessage = messages[messages.length - 1];
  const turnCount = useMemo(() => Math.floor(messages.length / 2), [messages.length]);

  const fetchSeed = useCallback(async () => {
    try {
      setIsFetchingSeed(true);
      setError(null);
      const response = await fetch(`${API_BASE}/seed`);
      if (!response.ok) {
        throw new Error(`No pude obtener un tema (status ${response.status}).`);
      }
      const data = await response.json();
      if (typeof data?.seed !== "string") {
        throw new Error("Respuesta inesperada del backend /seed.");
      }
      setTopic(data.seed);
      setOpeningInput(data.seed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido al solicitar el seed.";
      setError(message);
    } finally {
      setIsFetchingSeed(false);
    }
  }, []);

  useEffect(() => {
    fetchSeed().catch(() => undefined);
  }, [fetchSeed]);

  const requestTurn = useCallback(async (speaker: Speaker, contextMessage: string) => {
    const payload = {
      speaker,
      message: contextMessage
    };
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/turn`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`Fallo al generar respuesta (${response.status}).`);
      }
      const data = await response.json();
      if (typeof data?.text !== "string") {
        throw new Error("Respuesta invalida del backend /turn.");
      }
      const message: Message = {
        id: createId(),
        speaker,
        text: data.text.trim()
      };
      setMessages((prev) => [...prev, message]);
      setNextSpeaker(speaker === "buffett" ? "cheah" : "buffett");
      return message.text;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error generando la replica.";
      setError(message);
      setAutoPlay(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startDebate = useCallback(async () => {
    const opening = openingInput.trim();
    if (!opening) {
      setError("Necesitas un mensaje inicial para arrancar la discusion.");
      return;
    }
    const intro: Message = {
      id: createId(),
      speaker: "cheah",
      text: opening
    };
    setMessages([intro]);
    setNextSpeaker("buffett");
    setAutoPlay(false);
    setError(null);
    try {
      await requestTurn("buffett", opening);
    } catch (err) {
      console.error(err);
    }
  }, [openingInput, requestTurn]);

  const advanceDebate = useCallback(async () => {
    if (isLoading || !lastMessage) {
      return;
    }
    try {
      await requestTurn(nextSpeaker, lastMessage.text);
    } catch (err) {
      console.error(err);
    }
  }, [isLoading, lastMessage, nextSpeaker, requestTurn]);

  useEffect(() => {
    if (!autoPlay) {
      return;
    }
    if (isLoading || !lastMessage) {
      return;
    }
    if (messages.length >= MAX_AUTO_TURNS) {
      setAutoPlay(false);
      return;
    }
    const timer = setTimeout(() => {
      advanceDebate().catch((err) => console.error(err));
    }, 1500);
    return () => clearTimeout(timer);
  }, [autoPlay, advanceDebate, isLoading, lastMessage, messages.length]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const resetDebate = () => {
    setMessages([]);
    setAutoPlay(false);
    setNextSpeaker("buffett");
    setError(null);
    if (topic) {
      setOpeningInput(topic);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_45%),_radial-gradient(circle_at_bottom,_rgba(251,191,36,0.1),_transparent_55%)]" />
      <header className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-8 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Debate infinito</p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">Buffett vs Cheah - USA vs China</h1>
            <p className="text-sm text-slate-300">
              Orquesta un duelo entre el Oraculo de Omaha y el Warren Buffett de Asia. Presiona "Iniciar" con un mensaje de apertura (o usa el tema sugerido) y avanza turno a turno o activa el modo automatico.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-3 md:w-auto">
            <button
              type="button"
              onClick={() => fetchSeed().catch((err) => console.error(err))}
              disabled={isFetchingSeed}
              className="rounded-full border border-sky-400/20 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-200 transition hover:border-sky-400/40 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetchingSeed ? "Cargando tema..." : "Nuevo tema"}
            </button>
            <button
              type="button"
              onClick={resetDebate}
              className="rounded-full border border-slate-700/70 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
            >
              Limpiar tablero
            </button>
          </div>
        </div>
        {topic && (
          <div className="mt-6 inline-flex flex-wrap items-center gap-2 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Tema sugerido</span>
            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-1 text-amber-100">{topic}</span>
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <section className="flex flex-1 flex-col gap-6">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-lg backdrop-blur"
        >
          <div className="flex flex-col gap-5">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
                Aun no hay intervenciones. Genera un tema o escribe un mensaje inicial para que Cheah abra el debate y deja que Warren responda.
              </div>
            )}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex justify-center">
                <div className="animate-pulse rounded-full border border-sky-400/20 bg-sky-500/10 px-4 py-2 text-xs font-medium tracking-[0.4em] text-sky-200">
                  Generando...
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-lg backdrop-blur">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center md:gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Proximo turno</p>
                  <p className="font-semibold text-slate-100">{PERSONAS[nextSpeaker].name}</p>
                </div>
                <div className="rounded-full border border-slate-700/60 bg-slate-800/80 px-3 py-1 text-xs uppercase tracking-[0.35em] text-slate-400">
                  Turnos disputados - {turnCount}
                </div>
              </div>
              <textarea
                value={openingInput}
                onChange={(event) => setOpeningInput(event.target.value)}
                placeholder="Escribe un mensaje para que Cheah abra el debate..."
                className="h-28 w-full resize-none rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-400/60"
              />
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => startDebate().catch((err) => console.error(err))}
                disabled={isLoading || !openingInput.trim()}
                className="w-full rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:border-emerald-400/60 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {messages.length === 0 ? "Iniciar debate" : "Reiniciar con este mensaje"}
              </button>
              <button
                type="button"
                onClick={() => advanceDebate().catch((err) => console.error(err))}
                disabled={isLoading || messages.length === 0}
                className="w-full rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-sky-100 transition hover:border-sky-400/60 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente turno
              </button>
              <button
                type="button"
                onClick={() => setAutoPlay((prev) => !prev)}
                disabled={messages.length === 0}
                className={`w-full rounded-xl border px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] transition ${
                  autoPlay
                    ? "border-rose-400/40 bg-rose-500/10 text-rose-100 hover:border-rose-400/60 hover:bg-rose-500/20"
                    : "border-purple-400/30 bg-purple-500/10 text-purple-100 hover:border-purple-400/60 hover:bg-purple-500/20"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {autoPlay ? "Detener auto" : "Auto play"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;