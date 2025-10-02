import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

const PORTRAIT_BUFFETT = new URL("./assets/portrait-buffett.png", import.meta.url).href;
const PORTRAIT_CHEAH = new URL("./assets/portrait-cheah.png", import.meta.url).href;

type Speaker = "buffett" | "cheah";

interface Message {
    id: string;
    speaker: Speaker;
    text: string;
}

const PERSONAS: Record<Speaker, {
    name: string;
    tagline: string;
    initials: string;
    panelBg: string;
    portrait: string | null;
    mirror: boolean;
    nameColor: string;
    borderSide: "left" | "right";
    borderColor: string;
}> = {
    buffett: {
        name: "Warren Buffett",
        tagline: "USA - Value investing clasico",
        initials: "WB",
        panelBg: "#FFF0CE",
        portrait: PORTRAIT_BUFFETT,
        mirror: true,
        nameColor: "#C97C0D",
        borderSide: "left",
        borderColor: "rgba(201,124,13,0.3)"
    },
    cheah: {
        name: "Cheah Cheng Hye",
        tagline: "Asia - Value con lente oriental",
        initials: "CH",
        panelBg: "#F3F0EA",
        portrait: PORTRAIT_CHEAH,
        mirror: false,
        nameColor: "#276678",
        borderSide: "right",
        borderColor: "rgba(39,102,120,0.3)"
    }
};

const MAX_AUTO_TURNS = 14;

const createId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2, 12);
};

function PersonaColumn({ speaker, isActive }: { speaker: Speaker; isActive: boolean }) {
    const persona = PERSONAS[speaker];
    const alignment = speaker === "buffett" ? "items-end text-right" : "items-start text-left";
    const ringClass = isActive ? "ring-4 ring-[#2A2D35]" : "ring-2 ring-[#444]";

    const borderStyles = persona.borderSide === "left"
        ? { borderLeft: `4px solid ${persona.borderColor}` }
        : { borderRight: `4px solid ${persona.borderColor}` };

    return (
        <aside className={`hidden flex-col justify-center gap-6 lg:flex lg:w-[20rem] xl:w-[24rem] ${alignment}`}>
            <div
                className={`relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-[40px] border border-[#444] shadow-[0_20px_50px_-25px_rgba(0,0,0,0.25)] ${ringClass}`}
                style={{ backgroundColor: persona.panelBg, ...borderStyles }}
            >
                {persona.portrait ? (
                    <img
                        src={persona.portrait}
                        alt={persona.name}
                        className={`h-full w-full object-cover object-center ${persona.mirror ? "scale-x-[-1]" : ""}`}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <span className="text-5xl font-semibold tracking-[0.6em] text-[#222]">
                            {persona.initials}
                        </span>
                    </div>
                )}
            </div>
            <div className="space-y-1 text-[15px] leading-[1.6] tracking-[0.5px]">
                <p
                    className="font-bold text-[18px]"
                    style={{ color: persona.nameColor, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
                >
                    {persona.name}
                </p>
                <p className="text-[13px] uppercase tracking-[0.35em]" style={{ color: "#AAAAAA", letterSpacing: "1px" }}>
                    {speaker === "buffett" ? "Estados Unidos" : "Asia"}
                </p>
                <p className="text-[14px] text-[#E0E0E0]">
                    {persona.tagline}
                </p>
            </div>
        </aside>
    );
}

function TranscriptBubble({ message }: { message: Message }) {
    const persona = PERSONAS[message.speaker];
    const isBuffett = message.speaker === "buffett";
    const alignment = isBuffett ? "justify-end" : "justify-start";

    return (
        <div className={`flex ${alignment}`}>
            <div className="max-w-xl rounded-[28px] border border-[#444] bg-[#2A2D35] px-6 py-5 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.25)]">
                <p className="text-xs uppercase tracking-[0.35em] text-[#C7C7C7]">{persona.name}</p>
                <p className="mt-3 whitespace-pre-line text-[15px] leading-[1.6] tracking-[0.5px] text-[#F5F5F5]">{message.text}</p>
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

    const transcriptRef = useRef<HTMLDivElement | null>(null);

    const lastMessage = messages[messages.length - 1];
    const transcriptMessages = lastMessage ? messages.slice(0, -1) : messages;
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
            const message = err instanceof Error ? err.message : "Error desconocido al solicitar el tema.";
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
        if (!transcriptRef.current) {
            return;
        }
        transcriptRef.current.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
    }, [transcriptMessages.length]);

    const resetDebate = () => {
        setMessages([]);
        setAutoPlay(false);
        setNextSpeaker("buffett");
        setError(null);
        if (topic) {
            setOpeningInput(topic);
        }
    };

    const highlightedPersona = lastMessage ? PERSONAS[lastMessage.speaker] : null;

    return (
        <div className="flex min-h-screen flex-col bg-[#1C1E24] text-[#F5F5F5] text-[15px] leading-[1.6] tracking-[0.5px]">
            <header className="flex flex-col gap-4 border-b border-[#444] bg-gradient-to-r from-[#FFEDBE] to-[#E9E6E0] px-6 py-5 text-[#222]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#444]">Infinite Debate</p>
                        <h1 className="text-2xl font-semibold md:text-3xl" style={{ color: "#222", letterSpacing: "0.5px" }}>Buffett vs Cheah - USA vs China</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={() => fetchSeed().catch((err) => console.error(err))}
                            disabled={isFetchingSeed}
                            className="rounded-full border border-[#444] bg-[#F3F0EA] px-4 py-2 text-sm font-medium text-[#222] transition hover:brightness-[1.08] hover:shadow-[0_0_6px_currentColor] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isFetchingSeed ? "Cargando tema..." : "Nuevo tema"}
                        </button>
                        <button
                            type="button"
                            onClick={resetDebate}
                            className="rounded-full border border-[#444] bg-[#E9E6E0] px-4 py-2 text-sm font-medium text-[#222] transition hover:brightness-[1.08] hover:shadow-[0_0_6px_currentColor]"
                        >
                            Limpiar tablero
                        </button>
                    </div>
                </div>
                {topic && (
                    <div className="inline-flex flex-wrap items-center gap-3 text-sm text-[#222]">
                        <span className="text-xs uppercase tracking-[0.35em] text-[#555]">Tema sugerido</span>
                        <span className="rounded-full border border-[#FFB347] bg-[#FFF0CE] px-4 py-1 text-[#222]">{topic}</span>
                    </div>
                )}
            </header>

            {error && (
                <div className="border-b border-[#444] bg-[#3A1F25] px-6 py-3 text-sm text-[#F5F5F5]">
                    {error}
                </div>
            )}

            <main className="flex flex-1 flex-col gap-8 px-6 py-8 lg:flex-row lg:items-stretch lg:justify-between lg:gap-12">
                <PersonaColumn speaker="cheah" isActive={lastMessage?.speaker === "cheah"} />

                <section className="flex w-full max-w-4xl flex-1 flex-col items-center gap-10 self-center lg:px-6">
                    <div className="w-full max-w-3xl text-center">
                        {lastMessage ? (
                            <div className="space-y-5">
                                <p className="text-xs uppercase tracking-[0.4em] text-[#C7C7C7]">
                                    Turno actual - {highlightedPersona?.name}
                                </p>
                                <div className="rounded-[36px] border border-[#444] bg-[#2A2D35] px-8 py-10 shadow-[0_25px_60px_-30px_rgba(0,0,0,0.25)]">
                                    <p className="whitespace-pre-line text-lg leading-[1.6] tracking-[0.5px] text-[#F5F5F5]">{lastMessage.text}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-[36px] border border-dashed border-[#444] bg-[#2A2D35] px-8 py-12 text-sm text-[#C7C7C7]">
                                Orquesta el duelo escribiendo un mensaje inicial para Cheah o utiliza el tema sugerido. Warren respondera y podras continuar turno a turno o activar el modo automatico.
                            </div>
                        )}
                    </div>

                    <div
                        ref={transcriptRef}
                        className="w-full max-w-3xl flex-1 overflow-y-auto rounded-[36px] border border-[#444] bg-[#1C1E24] px-6 py-7"
                    >
                        <div className="flex flex-col gap-4">
                            {transcriptMessages.length === 0 && messages.length === 0 && (
                                <p className="text-center text-sm text-[#C7C7C7]">
                                    Aun no hay intervenciones registradas.
                                </p>
                            )}
                            {transcriptMessages.map((message) => (
                                <TranscriptBubble key={message.id} message={message} />
                            ))}
                            {isLoading && (
                                <div className="flex justify-center">
                                    <div className="animate-pulse rounded-full border border-[#444] bg-[#2A2D35] px-4 py-2 text-xs font-medium tracking-[0.4em] text-[#C7C7C7]">
                                        Generando...
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full max-w-3xl rounded-[36px] border border-[#444] bg-[#2A2D35] px-6 py-6 shadow-[0_20px_55px_-35px_rgba(0,0,0,0.25)]">
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.4em] text-[#C7C7C7]">
                            <span>Turnos disputados - {turnCount}</span>
                            <span>Proximo turno - {PERSONAS[nextSpeaker].name}</span>
                        </div>
                        <textarea
                            value={openingInput}
                            onChange={(event) => setOpeningInput(event.target.value)}
                            placeholder="Escribe un mensaje para que Cheah abra el debate..."
                            className="mt-4 h-32 w-full resize-none rounded-[28px] border border-[#444] bg-[#1C1E24] px-5 py-4 text-sm text-[#F5F5F5] outline-none transition placeholder:text-[#CCCCCC] placeholder:italic focus:border-[#3A7D8C] focus:ring-1 focus:ring-[#3A7D8C]"
                        />
                        <div className="mt-4 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => startDebate().catch((err) => console.error(err))}
                                disabled={isLoading || !openingInput.trim()}
                                className="rounded-full border border-transparent bg-[#FFB347] px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-[#222] shadow-[0_10px_25px_-18px_rgba(0,0,0,0.25)] transition hover:brightness-[1.08] hover:shadow-[0_0_6px_currentColor] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {messages.length === 0 ? "Iniciar debate" : "Reiniciar con este mensaje"}
                            </button>
                            <button
                                type="button"
                                onClick={() => advanceDebate().catch((err) => console.error(err))}
                                disabled={isLoading || messages.length === 0}
                                className="rounded-full border border-transparent bg-[#3A7D8C] px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-[#FFFFFF] transition hover:brightness-[1.08] hover:shadow-[0_0_6px_currentColor] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Siguiente turno
                            </button>
                            <button
                                type="button"
                                onClick={() => setAutoPlay((prev) => !prev)}
                                disabled={messages.length === 0}
                                className={`rounded-full border border-transparent px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-[#FFFFFF] transition hover:brightness-[1.08] hover:shadow-[0_0_6px_currentColor] disabled:cursor-not-allowed disabled:opacity-50 ${
                                    autoPlay ? "bg-[#b169c0]" : "bg-[#C779D0]"
                                }`}
                            >
                                {autoPlay ? "Detener auto" : "Auto play"}
                            </button>
                        </div>
                    </div>
                </section>

                <PersonaColumn speaker="buffett" isActive={lastMessage?.speaker === "buffett"} />
            </main>
        </div>
    );
}

export default App;
