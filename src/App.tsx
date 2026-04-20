import React, { useEffect, useMemo, useRef, useState } from "react";

type Speaker = "system" | "player" | "npc" | "feedback";
type Screen = "lesson" | "quest";

type Message = {
  id: string;
  speaker: Speaker;
  text: string;
};

type BackendResponse = {
  reply: string;
  feedback?: string;
  score?: number;
  done?: boolean;
  reset?: boolean;
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: "sys-1",
    speaker: "system",
    text: "You are in a small Tallinn bar. Your goal is to order a drink or snack politely.",
  },
];

const LESSON_WORDS = [
  {
    estonian: "Tere",
    meaning: "Hello",
    tip: "A simple polite greeting to start the conversation.",
  },
  {
    estonian: "Palun",
    meaning: "Please",
    tip: "Use this to make your order sound polite.",
  },
  {
    estonian: "Õlu",
    meaning: "Beer",
    tip: "A classic bar order.",
  },
  {
    estonian: "Siider",
    meaning: "Cider",
    tip: "Another common drink choice.",
  },
  {
    estonian: "Kohv",
    meaning: "Coffee",
    tip: "Useful if the player wants a non-alcoholic drink.",
  },
  {
    estonian: "Kook",
    meaning: "Cake",
    tip: "A snack word the player can try ordering.",
  },
  {
    estonian: "Kui palju maksab?",
    meaning: "How much does it cost?",
    tip: "Ask this after the bartender accepts the order.",
  },
  {
    estonian: "Aitäh",
    meaning: "Thank you",
    tip: "A polite way to finish the interaction.",
  },
];

const LESSON_EXAMPLES = [
  "Tere!",
  "Üks õlu palun.",
  "Palun üks siider.",
  "Kui palju maksab?",
  "Aitäh!",
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function label(speaker: Speaker) {
  switch (speaker) {
    case "system":
      return "Game";
    case "player":
      return "You";
    case "npc":
      return "Bartender";
    case "feedback":
      return "Coach";
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("lesson");
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState("Start by greeting the bartender.");
  const [lastShownHint, setLastShownHint] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState(
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
  );
  const [backendStatus, setBackendStatus] = useState<"unknown" | "checking" | "online" | "offline">("unknown");

  const endRef = useRef<HTMLDivElement | null>(null);

  const progress = useMemo(() => {
    if (score >= 100) return 4;
    if (score >= 75) return 3;
    if (score >= 50) return 2;
    if (score >= 25) return 1;
    return 0;
  }, [score]);

  useEffect(() => {
    void checkBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  function push(speaker: Speaker, text: string) {
    setMessages((prev) => [...prev, { id: uid(), speaker, text }]);
    scrollToBottom();
  }

  function showHint() {
    if (!feedback || feedback === lastShownHint) return;
    push("feedback", feedback);
    setLastShownHint(feedback);
  }

  async function checkBackend() {
    setBackendStatus("checking");
    try {
      const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/health`);
      setBackendStatus(res.ok ? "online" : "offline");
    } catch {
      setBackendStatus("offline");
    }
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || loading || done) return;

    const playerMsg: Message = { id: uid(), speaker: "player", text: trimmed };
    const updatedHistory = [...messages, playerMsg];

    setMessages(updatedHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          history: updatedHistory,
          scenario: "bar_order",
          target_language: "English",
          level: "A1",
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as BackendResponse;

      if (data.reset) {
        const restartedMessages: Message[] = [
          ...INITIAL_MESSAGES,
          {
            id: uid(),
            speaker: "system",
            text: "The round was reset after inappropriate language. Start again politely.",
          },
        ];

        setMessages(restartedMessages);
        setScore(0);
        setDone(false);
        setFeedback(data.feedback || "The round was reset. Start again with 'Tere!'.");
        setLastShownHint("");
        setBackendStatus("online");
        scrollToBottom();
        return;
      }

      const hasNpcReply = Boolean(data.reply?.trim());

      if (hasNpcReply) {
        push("npc", data.reply);
      }

      if (data.feedback) {
        if (!hasNpcReply) {
          push("feedback", data.feedback);
          setLastShownHint(data.feedback);
        }
        setFeedback(data.feedback);
      }

      if (typeof data.score === "number") setScore(data.score);
      if (data.done) setDone(true);
      setBackendStatus("online");
    } catch {
      push("feedback", "Backend connection failed. Check that FastAPI and vLLM are running.");
      setBackendStatus("offline");
    } finally {
      setLoading(false);
    }
  }

  function restart() {
    setScreen("lesson");
    setMessages(INITIAL_MESSAGES);
    setInput("");
    setScore(0);
    setLoading(false);
    setDone(false);
    setFeedback("Start by greeting the bartender.");
    setLastShownHint("");
    void checkBackend();
  }

  function startQuest() {
    setScreen("quest");
  }

  if (screen === "lesson") {
    return (
      <div className="app-shell">
        <main className="layout lesson-layout">
          <section className="panel left">
            <div className="title-row">
              <div>
                <h1>Bar Order Quest</h1>
                <p>Learn a few useful Estonian words before you enter the bar.</p>
              </div>
              <button onClick={startQuest}>Next</button>
            </div>

            <div className="card hero-card">
              <p className="eyebrow">Warm-up</p>
              <h2>Words For Ordering</h2>
              <p className="muted">
                Start with a greeting, order one drink or snack politely, ask the price, and end with thanks.
              </p>
            </div>

            <div className="card">
              <h2>Mini Phrases</h2>
              <div className="phrase-list">
                {LESSON_EXAMPLES.map((phrase) => (
                  <div key={phrase} className="phrase-chip">
                    {phrase}
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>What Happens Next</h2>
              <p className="muted">
                When you feel ready, click <strong>Next</strong> and you will enter the quest conversation with the bartender.
              </p>
            </div>
          </section>

          <section className="panel right lesson-panel">
            <div className="lesson-grid">
              {LESSON_WORDS.map((word) => (
                <article key={word.estonian} className="lesson-card">
                  <p className="lesson-word">{word.estonian}</p>
                  <p className="lesson-meaning">{word.meaning}</p>
                  <p className="lesson-tip">{word.tip}</p>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <main className="layout">
        <section className="panel left">
          <div className="title-row">
            <div>
              <h1>Bar Order Quest</h1>
              <p>Small LLM-backed language game prototype.</p>
            </div>
            <button onClick={restart}>Restart</button>
          </div>

          <div className="card">
            <h2>Goal</h2>
            <p>You are a tourist in Tallinn. Greet the bartender, order a drink or snack, ask the price, and say thanks.</p>
          </div>

          <div className="card">
            <h2>Progress</h2>
            <div className="progress">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={i < progress ? "dot on" : "dot"} />
              ))}
            </div>
            <p className="muted">Use Hint if you want coach help.</p>
          </div>

          <div className="card">
            <h2>Connection</h2>
            <p className="muted">
              {backendStatus === "online"
                ? "Online"
                : backendStatus === "offline"
                  ? "Backend offline"
                  : backendStatus === "checking"
                    ? "Checking connection..."
                    : "Not checked yet"}
            </p>
          </div>
        </section>

        <section className="panel right">
          <div className="conversation">
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.speaker}`}>
                <strong>{label(m.speaker)}</strong>
                <p>{m.text}</p>
              </div>
            ))}
            {loading && (
              <div className="bubble npc">
                <strong>Bartender</strong>
                <p>Thinking...</p>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="composer">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <div className="composer-row">
              <button onClick={showHint} type="button">
                Hint
              </button>
              <button onClick={sendMessage} disabled={loading || !input.trim()}>
                Send
              </button>
            </div>
            {done && <div className="success">Quest complete. You placed your order.</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
