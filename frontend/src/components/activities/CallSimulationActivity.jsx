import { useEffect, useMemo, useRef, useState } from 'react';
import { feedbackRatingLabel, repairPossibleMojibake } from '../../lib/course.js';
import { requestSimulationTurn } from '../../services/courseService.js';

const getSpeechRecognition = () =>
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

const clampScore = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
};

const formatDuration = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
  const remainder = String(safe % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
};

const cleanText = (value, fallback = '') => repairPossibleMojibake(String(value || fallback || '')).trim();

const normalizeChoices = (choices, fallbackChoices = []) => {
  const source = Array.isArray(choices) && choices.length ? choices : fallbackChoices;
  return source
    .map((choice) => cleanText(choice))
    .filter(Boolean)
    .slice(0, 3);
};

const normalizeHistory = (entries) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      speaker: entry?.speaker === 'user' ? 'user' : 'caller',
      text: cleanText(entry?.text),
    }))
    .filter((entry) => entry.text);

const buildScenarioContext = (activity) =>
  [
    `Escenario: ${cleanText(activity?.scenarioPrompt || activity?.intro || activity?.titulo || 'Llamada fraudulenta')}`,
    `Tipo de fraude: ${cleanText(activity?.fraudType || 'vishing')}`,
    `Nivel: ${cleanText(activity?.difficultyTone || 'refuerzo')}`,
    `Apertura del estafador: ${cleanText(activity?.opening || '')}`,
  ]
    .filter(Boolean)
    .join('\n');

const scoreLabel = (score) => `${Math.round(clampScore(score) * 100)}%`;

const DEFAULT_STARTER_CHOICES = [
  'No voy a dar datos por llamada.',
  '¿De que institucion hablas exactamente?',
  'Voy a colgar y verificar por mi cuenta.',
];

const VOICE_HINTS = {
  female: /(female|mujer|paulina|helena|sofia|samantha|monica|maria|lucia|carmen|paola|google español)/i,
  male: /(male|man|jorge|diego|carlos|raul|mario|daniel|alejandro|google español de estados unidos)/i,
};

const pickSpeechVoice = (voices, preferredProfile = 'female') => {
  const available = Array.isArray(voices) ? voices : [];
  if (!available.length) return null;

  const spanish = available.filter((voice) => String(voice.lang || '').toLowerCase().startsWith('es'));
  const pool = spanish.length ? spanish : available;
  const regex = VOICE_HINTS[String(preferredProfile || '').toLowerCase()] || null;

  if (regex) {
    const exact = pool.find((voice) => regex.test(`${voice.name} ${voice.voiceURI}`));
    if (exact) return exact;
  }

  return (
    pool.find((voice) => /mx|mexico/i.test(`${voice.lang} ${voice.name}`)) ||
    pool.find((voice) => /es/i.test(String(voice.lang || ''))) ||
    pool[0]
  );
};

const buildEndSummary = ({ analyses, finalReason, transcript }) => {
  const safeAnalyses = Array.isArray(analyses) ? analyses : [];
  const safeTranscript = Array.isArray(transcript) ? transcript : [];
  const avgScore = safeAnalyses.length
    ? safeAnalyses.reduce((total, item) => total + clampScore(item?.score), 0) / safeAnalyses.length
    : finalReason === 'hung_up'
      ? 1
      : 0.72;

  const last = safeAnalyses[safeAnalyses.length - 1] || {};
  const firstRisk = safeAnalyses.find((item) => cleanText(item?.signal_detected)) || {};
  const safeTurns = safeAnalyses.filter((item) => clampScore(item?.score) >= 0.75).length;

  return {
    avgScore,
    scoreText: feedbackRatingLabel(avgScore),
    signal: cleanText(firstRisk.signal_detected, 'Autoridad falsa y presión por resolver durante la llamada.'),
    risk: cleanText(
      last.risk,
      'La llamada intenta mantenerte dentro del canal del atacante para que decidas con prisa.'
    ),
    action: cleanText(
      last.safe_action,
      'Cuelga, entra tú mismo a la app o llama al número oficial desde un canal que tú controles.'
    ),
    coach: cleanText(
      last.coach_feedback,
      finalReason === 'hung_up'
        ? 'Cortar una llamada inesperada y verificar por tu cuenta es una respuesta segura.'
        : 'La decisión segura es salir del canal, recuperar el control y verificar solo por vías oficiales.'
    ),
    safeTurns,
    turnCount: safeAnalyses.length,
    transcriptLength: safeTranscript.length,
  };
};

export default function CallSimulationActivity({
  activity,
  answers,
  assessment,
  startedAtRef,
  onComplete,
}) {
  const [phase, setPhase] = useState('incoming');
  const [mode, setMode] = useState('');
  const [callSeconds, setCallSeconds] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [choices, setChoices] = useState(() => normalizeChoices(activity?.starterChoices));
  const [chatInput, setChatInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState('');
  const [summary, setSummary] = useState(null);

  const transcriptRef = useRef([]);
  const analysesRef = useRef([]);
  const recognitionRef = useRef(null);
  const callStartedRef = useRef(false);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const turnRef = useRef(0);
  const phaseRef = useRef('incoming');
  const modeRef = useRef('');
  const micEnabledRef = useRef(true);
  const speakerEnabledRef = useRef(true);

  const callerName = cleanText(activity?.callerName, 'Llamada entrante');
  const callerNumber = cleanText(activity?.callerNumber, 'Número privado');
  const fraudType = cleanText(activity?.fraudType, 'suplantación telefónica');
  const difficulty = cleanText(activity?.difficultyTone, 'refuerzo');
  const intro = cleanText(
    activity?.intro,
    'Actúa como si fuera una llamada real. Tu prioridad es cortar el canal y verificar por tu cuenta.'
  );
  const opening = cleanText(
    activity?.opening,
    'Le llamo del área de seguridad. Necesito validar una operación en este momento.'
  );
  const scenarioContext = useMemo(() => buildScenarioContext(activity), [activity]);
  const maxTurns = Math.max(3, Number(activity?.turnos_max) || 4);
  const starterChoices = useMemo(
    () => normalizeChoices(activity?.starterChoices, DEFAULT_STARTER_CHOICES),
    [activity?.starterChoices]
  );

  const activeVoice = useMemo(() => {
    if (!voices.length) return null;
    if (selectedVoiceUri) {
      const explicit = voices.find((voice) => voice.voiceURI === selectedVoiceUri);
      if (explicit) return explicit;
    }
    return pickSpeechVoice(voices, activity?.voiceProfile || 'female');
  }, [activity?.voiceProfile, selectedVoiceUri, voices]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    speakerEnabledRef.current = speakerEnabled;
  }, [speakerEnabled]);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return undefined;

    const loadVoices = () => {
      const loaded = synth.getVoices?.() || [];
      setVoices(loaded);
      if (!selectedVoiceUri && loaded.length) {
        const preferred = pickSpeechVoice(loaded, activity?.voiceProfile || 'female');
        if (preferred) setSelectedVoiceUri(preferred.voiceURI);
      }
    };

    loadVoices();
    synth.addEventListener?.('voiceschanged', loadVoices);
    return () => {
      synth.removeEventListener?.('voiceschanged', loadVoices);
    };
  }, [activity?.voiceProfile, selectedVoiceUri]);

  useEffect(() => {
    if (phase !== 'active') {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return undefined;
    }

    timerRef.current = window.setInterval(() => {
      setCallSeconds((current) => current + 1);
    }, 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [phase]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
      window.speechSynthesis?.cancel?.();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const stopListening = () => {
    recognitionRef.current?.stop?.();
    setIsListening(false);
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel?.();
    setIsSpeaking(false);
  };

  const appendTranscript = (entry) => {
    const next = [...transcriptRef.current, entry].slice(-16);
    transcriptRef.current = next;
    setTranscript(next);
    return next;
  };

  const speakReply = (text, { autoListen = false } = {}) => {
    const spokenText = cleanText(text);
    if (!spokenText) return;

    const synth = window.speechSynthesis;
    if (!speakerEnabledRef.current || !synth) {
      if (autoListen && modeRef.current === 'voice' && micEnabledRef.current) {
        window.setTimeout(() => startListening(), 250);
      }
      return;
    }

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = activeVoice?.lang || 'es-MX';
    utterance.voice = activeVoice || null;
    utterance.rate = difficulty === 'avanzado' ? 0.99 : difficulty === 'refuerzo' ? 0.96 : 0.92;
    utterance.pitch = activity?.voiceProfile === 'male' ? 0.92 : 1.02;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (autoListen && modeRef.current === 'voice' && micEnabledRef.current && phaseRef.current === 'active') {
        window.setTimeout(() => startListening(), 350);
      }
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      if (autoListen && modeRef.current === 'voice' && micEnabledRef.current && phaseRef.current === 'active') {
        window.setTimeout(() => startListening(), 350);
      }
    };
    synth.speak(utterance);
  };

  const finalizeCall = (reason = 'done') => {
    stopListening();
    stopSpeaking();
    const endSummary = buildEndSummary({
      analyses: analysesRef.current,
      finalReason: reason,
      transcript: transcriptRef.current,
    });
    setSummary(endSummary);
    setPhase('ended');
  };

  const sendTurn = async (message, interactionMode) => {
    const safeMessage = cleanText(message);
    if (!safeMessage || busy || phaseRef.current !== 'active') return;

    const nextHistory = appendTranscript({ speaker: 'user', text: safeMessage });
    setBusy(true);
    setError('');
    stopListening();

    try {
      const response = await requestSimulationTurn({
        scenario: scenarioContext,
        history: nextHistory,
        userMessage: safeMessage,
        turn: turnRef.current + 1,
        turnos_max: maxTurns,
        user: { answers, assessment },
        interactionMode,
        difficulty,
        callerName,
        fraudType,
        choicesNeeded: 3,
      });

      turnRef.current += 1;

      const reply = cleanText(response?.reply, 'Voy a insistir: necesito resolver esto ahora.');
      const replyHistory = appendTranscript({ speaker: 'caller', text: reply });
      const analysis = {
        score: clampScore(response?.score),
        rating: cleanText(response?.rating, 'Regular'),
        signal_detected: cleanText(response?.signal_detected),
        risk: cleanText(response?.risk),
        safe_action: cleanText(response?.safe_action),
        coach_feedback: cleanText(response?.coach_feedback),
      };
      analysesRef.current = [...analysesRef.current, analysis].slice(-8);
      setChoices(normalizeChoices(response?.choices, starterChoices));

      const shouldEnd = Boolean(response?.done) || turnRef.current >= maxTurns;
      if (shouldEnd) {
        const endSummary = buildEndSummary({
          analyses: [...analysesRef.current],
          finalReason: 'completed',
          transcript: replyHistory,
        });
        setSummary(endSummary);
        setPhase('ended');
        speakReply(reply, { autoListen: false });
        return;
      }

      speakReply(reply, { autoListen: interactionMode === 'call_voice' });
    } catch (err) {
      console.error('Error en simulación de llamada:', err);
      setError(cleanText(err?.message, 'No pude continuar la llamada. Puedes cambiar a botones o escribir.'));
    } finally {
      setBusy(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError('Tu navegador no permite reconocimiento de voz aquí. Puedes seguir con botones o texto.');
      return;
    }
    if (busy || !micEnabledRef.current || phaseRef.current !== 'active' || modeRef.current !== 'voice') return;

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-MX';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event) => {
        setIsListening(false);
        if (event?.error && event.error !== 'no-speech') {
          setError('No pude escuchar bien tu respuesta. Puedes intentarlo otra vez o cambiar a botones.');
        }
      };
      recognition.onresult = (event) => {
        const transcriptText = cleanText(
          event?.results?.[0]?.[0]?.transcript,
          ''
        );
        if (!transcriptText) {
          setError('No se entendió la respuesta. Intenta hablar de nuevo o usa botones.');
          return;
        }
        void sendTurn(transcriptText, 'call_voice');
      };
      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
    } catch {
      // Ignora errores de start duplicado del navegador.
    }
  };

  const startConversation = (nextMode) => {
    if (callStartedRef.current) return;
    callStartedRef.current = true;
    setMode(nextMode);
    setPhase('active');
    setChoices(starterChoices);
    appendTranscript({ speaker: 'caller', text: opening });
    speakReply(opening, { autoListen: nextMode === 'voice' });
  };

  const requestVoiceMode = async () => {
    const canStartFresh = !callStartedRef.current;
    if (!getSpeechRecognition()) {
      setError('Tu navegador no permite responder por voz aqui. La llamada seguira con respuestas rapidas.');
      if (canStartFresh) startConversation('choices');
      return;
    }
    if (callStartedRef.current && navigator.mediaDevices?.getUserMedia && activity?.allowVoice) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setMode('voice');
        window.setTimeout(() => startListening(), 250);
        return;
      } catch (err) {
        console.warn('Permiso de microfono denegado o no disponible:', err);
      }
    }
    if (!navigator.mediaDevices?.getUserMedia || !activity?.allowVoice) {
      setError('El micrófono no está disponible aquí. Puedes seguir con botones o texto.');
      startConversation('choices');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      startConversation('voice');
    } catch (err) {
      console.warn('Permiso de micrófono denegado o no disponible:', err);
      setError('No se activó el micrófono. La llamada seguirá con respuestas rápidas.');
      startConversation('choices');
    }
  };

  const submitChat = async () => {
    const message = cleanText(chatInput);
    if (!message || busy) return;
    setChatInput('');
    await sendTurn(message, 'call_chat');
  };

  const turnAverage = summary?.avgScore
    ? scoreLabel(summary.avgScore)
    : analysesRef.current.length
      ? scoreLabel(
          analysesRef.current.reduce((total, item) => total + clampScore(item.score), 0) /
            analysesRef.current.length
        )
      : '—';

  return (
    <div className={`call-immersive-shell difficulty-${difficulty}`}>
      {phase === 'incoming' ? (
        <section className="call-immersive-phone incoming">
          <div className="call-immersive-status">
            <span>Llamada entrante</span>
            <span>Posible fraude</span>
          </div>
          <div className="call-immersive-identity">
            <div className="call-immersive-avatar">{callerName.slice(0, 2).toUpperCase()}</div>
            <div>
              <p className="call-immersive-kicker">{cleanText(activity?.fraudType, 'Llamada sospechosa')}</p>
              <h3>{callerName}</h3>
              <p>{callerNumber}</p>
            </div>
          </div>
          <div className="call-immersive-wave" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="call-immersive-intro">{intro}</p>
          <div className="call-immersive-actions">
            <button className="call-control-btn danger" type="button" onClick={() => finalizeCall('hung_up')}>
              Colgar
            </button>
            <button className="call-control-btn success" type="button" onClick={() => setPhase('permissions')}>
              Contestar
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'permissions' ? (
        <section className="call-immersive-phone call-immersive-permissions">
          <div className="call-immersive-panel-head">
            <p className="eyebrow">Elige cómo responder</p>
            <h3>La estética se mantiene como llamada real en todos los modos</h3>
            <p>
              Si activas voz, la llamada usará micrófono, reconocimiento de voz y respuesta hablada de la IA.
            </p>
          </div>
          <div className="call-mode-grid">
            <button className="call-mode-card voice" type="button" onClick={requestVoiceMode}>
              <strong>Modo voz</strong>
              <span>Hablas por micrófono y la IA responde con voz.</span>
            </button>
            <button className="call-mode-card" type="button" onClick={() => startConversation('choices')}>
              <strong>Respuestas rápidas</strong>
              <span>Eliges botones sin perder la interfaz de llamada.</span>
            </button>
            <button className="call-mode-card" type="button" onClick={() => startConversation('chat')}>
              <strong>Modo texto</strong>
              <span>Fallback si no quieres usar voz o el navegador falla.</span>
            </button>
          </div>
          {voices.length ? (
            <label className="call-voice-select">
              <span>Voz del estafador</span>
              <select value={selectedVoiceUri} onChange={(event) => setSelectedVoiceUri(event.target.value)}>
                {voices
                  .filter((voice) => String(voice.lang || '').toLowerCase().startsWith('es'))
                  .map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {`${voice.name} (${voice.lang})`}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          {error ? <p className="call-inline-error">{error}</p> : null}
        </section>
      ) : null}

      {phase === 'active' ? (
        <section className="call-immersive-phone active">
          <div className="call-immersive-topbar">
            <div>
              <p className="call-immersive-kicker">Llamada en curso</p>
              <h3>{callerName}</h3>
              <p>{`${callerNumber} • ${formatDuration(callSeconds)}`}</p>
            </div>
            <div className={`call-live-indicator ${isSpeaking ? 'speaking' : isListening ? 'listening' : ''}`}>
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="call-immersive-meta">
            <span className="call-badge">{difficulty.toUpperCase()}</span>
            <span className="call-badge subtle">{mode === 'voice' ? 'Voz activa' : mode === 'choices' ? 'Botones' : 'Texto'}</span>
            <span className="call-badge subtle">{fraudType}</span>
          </div>

          <div className="call-transcript-panel">
            {transcript.map((entry, index) => (
              <article className={`call-transcript-bubble ${entry.speaker}`} key={`${entry.speaker}-${index}`}>
                <span>{entry.speaker === 'caller' ? callerName : 'Tú'}</span>
                <p>{entry.text}</p>
              </article>
            ))}
            {!transcript.length ? (
              <article className="call-transcript-empty">
                <p>La llamada iniciará en cuanto elijas cómo contestar.</p>
              </article>
            ) : null}
          </div>

          <div className="call-dashboard-row">
            <article className="call-info-card">
              <span>Turnos</span>
              <strong>{`${turnRef.current}/${maxTurns}`}</strong>
              <p>Entre menos sigas la llamada, más control conservas.</p>
            </article>
            <article className="call-info-card">
              <span>Promedio seguro</span>
              <strong>{turnAverage}</strong>
              <p>Se recalcula en cada respuesta.</p>
            </article>
            <article className="call-info-card">
              <span>Indicador</span>
              <strong>{isSpeaking ? 'Hablando' : isListening ? 'Escuchando' : busy ? 'Procesando' : 'En pausa'}</strong>
              <p>{cleanText(error, 'Puedes cortar la llamada en cualquier momento.')}</p>
            </article>
          </div>

          {mode === 'voice' ? (
            <div className="call-voice-panel">
              <button className="call-control-btn primary" type="button" onClick={startListening} disabled={busy || isListening || !micEnabled}>
                {isListening ? 'Escuchando...' : 'Responder por voz'}
              </button>
              <p>Habla breve y directo. Si detectas presión o petición de códigos, corta la llamada.</p>
            </div>
          ) : null}

          {mode === 'choices' ? (
            <div className="call-choice-grid">
              {choices.map((choice) => (
                <button
                  className="call-choice-btn"
                  key={choice}
                  type="button"
                  disabled={busy}
                  onClick={() => void sendTurn(choice, 'call_choices')}
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : null}

          {mode === 'chat' ? (
            <div className="call-chat-panel">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Escribe qué responderías en esta llamada."
                rows={3}
              />
              <button className="call-control-btn primary" type="button" onClick={() => void submitChat()} disabled={busy || !cleanText(chatInput)}>
                Enviar respuesta
              </button>
            </div>
          ) : null}

          <div className="call-controls-bar">
            <button className={`call-control-btn ${speakerEnabled ? '' : 'muted'}`} type="button" onClick={() => {
              if (speakerEnabled) stopSpeaking();
              setSpeakerEnabled((current) => !current);
            }}>
              {speakerEnabled ? 'Silenciar audio' : 'Activar audio'}
            </button>
            <button className={`call-control-btn ${micEnabled ? '' : 'muted'}`} type="button" onClick={() => {
              if (micEnabled) stopListening();
              setMicEnabled((current) => !current);
            }}>
              {micEnabled ? 'Silenciar micrófono' : 'Activar micrófono'}
            </button>
            {mode !== 'voice' && activity?.allowVoice ? (
              <button className="call-control-btn" type="button" onClick={() => void requestVoiceMode()}>
                Pasar a voz
              </button>
            ) : null}
            {mode !== 'choices' ? (
              <button className="call-control-btn" type="button" onClick={() => {
                stopListening();
                setMode('choices');
              }}>
                Pasar a botones
              </button>
            ) : null}
            {mode !== 'chat' ? (
              <button className="call-control-btn" type="button" onClick={() => {
                stopListening();
                setMode('chat');
              }}>
                Pasar a texto
              </button>
            ) : null}
            <button className="call-control-btn danger" type="button" onClick={() => finalizeCall('hung_up')}>
              Colgar
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'ended' && summary ? (
        <section className="call-immersive-phone call-ended-screen">
          <div className="call-ended-head">
            <p className="eyebrow">Llamada finalizada</p>
            <h3>{summary.scoreText}</h3>
            <p>{summary.coach}</p>
          </div>
          <div className="call-ended-grid">
            <article className="call-info-card">
              <span>Puntaje</span>
              <strong>{scoreLabel(summary.avgScore)}</strong>
              <p>{`${summary.safeTurns}/${summary.turnCount || 1} respuestas seguras`}</p>
            </article>
            <article className="call-info-card">
              <span>Señal dominante</span>
              <strong>{summary.signal || 'Presión indebida'}</strong>
              <p>{summary.risk}</p>
            </article>
            <article className="call-info-card">
              <span>Acción correcta</span>
              <strong>Recupera el control</strong>
              <p>{summary.action}</p>
            </article>
          </div>
          <button
            className="call-control-btn primary wide"
            type="button"
            onClick={() =>
              onComplete({
                score: summary.avgScore,
                feedback: `${summary.coach} Acción segura: ${summary.action}`,
                details: {
                  mode,
                  transcript: transcriptRef.current,
                  analyses: analysesRef.current,
                  callerName,
                  fraudType,
                },
                durationMs: Math.max(0, Date.now() - startedAtRef.current),
              })
            }
          >
            Continuar
          </button>
        </section>
      ) : null}
    </div>
  );
}
