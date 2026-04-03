import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QRScanner } from './components/QRScanner';
import { PrintPage } from './components/PrintPage';
import { ParentPanel } from './components/ParentPanel';
import { 
  Egg, 
  Camera, 
  CheckCircle2, 
  Trophy, 
  ArrowRight, 
  HelpCircle,
  Users,
  Settings,
  Volume2,
  Lock,
  Image as ImageIcon,
  RotateCcw,
  Download,
  Loader2,
  UserPlus,
  Plus,
  Check,
  Star,
  Mic,
  Square,
  Play,
  History,
  QrCode,
  Share2,
  Copy,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import { 
  loadGameFromFirebase, 
  saveGameToFirebase, 
  saveSessionToFirebase,
  STORAGE_KEY, 
  GAME_ID_KEY, 
  generateGameId 
} from './constants';
import { Checkpoint, TeamInfo, GameSession, CheckpointResult } from './types';

type GameState = 'START' | 'TEAM_SETUP' | 'RIDDLE' | 'SCANNING' | 'TASK' | 'EVALUATION' | 'FINISHED' | 'PRINT';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [gameId, setGameId] = useState<string>('');
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [showParentPanel, setShowParentPanel] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [showLoadPrompt, setShowLoadPrompt] = useState(false);
  const [loadId, setLoadId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [teamInfo, setTeamInfo] = useState<TeamInfo>({ name: '', members: [''] });
  const [bestPerformer, setBestPerformer] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [sessionResults, setSessionResults] = useState<CheckpointResult[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [showShareQR, setShowShareQR] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Detect supported MIME types
      const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
      const supportedType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: supportedType || 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setRecordedAudio(reader.result as string);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Mic error:", err);
      let msg = "Błąd mikrofonu. Sprawdź uprawnienia.";
      if (err.name === 'NotAllowedError') msg = "Brak uprawnień do mikrofonu. Zezwól na dostęp w przeglądarce.";
      if (err.name === 'NotFoundError') msg = "Nie znaleziono mikrofonu.";
      alert(msg);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    const savedCheckpoints = localStorage.getItem(STORAGE_KEY);
    const savedId = localStorage.getItem(GAME_ID_KEY);
    
    if (savedCheckpoints) {
      setCheckpoints(JSON.parse(savedCheckpoints));
    }
    
    if (savedId) {
      setGameId(savedId);
    } else {
      const newId = generateGameId();
      setGameId(newId);
      localStorage.setItem(GAME_ID_KEY, newId);
    }

    // Check for game in URL
    const urlParams = new URLSearchParams(window.location.search);
    const gameParam = urlParams.get('game');
    if (gameParam) {
      handleLoadGameById(gameParam);
    }
  }, []);

  const currentStage = checkpoints[currentStageIndex];

  const handleStart = () => {
    if (checkpoints.length === 0) {
      alert("Najpierw dodaj punkty w panelu rodzica!");
      return;
    }
    setGameState('TEAM_SETUP');
  };

  const handleTeamSubmit = () => {
    const validMembers = teamInfo.members.filter(m => m.trim() !== '');
    if (validMembers.length < 1) {
      alert("Dodaj przynajmniej jedno imię!");
      return;
    }
    if (!teamInfo.name.trim()) {
      alert("Wpisz nazwę drużyny!");
      return;
    }
    setTeamInfo({ ...teamInfo, members: validMembers });
    const initialVotes: Record<string, number> = {};
    validMembers.forEach(member => {
      initialVotes[member] = 0;
    });
    setVotes(initialVotes);
    setSessionResults([]);
    setGameState('RIDDLE');
    setCurrentStageIndex(0);
    setCapturedPhoto(null);
    setRecordedAudio(null);
  };

  const updateMember = (index: number, name: string) => {
    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    setTeamInfo(prev => {
      const newMembers = [...prev.members];
      newMembers[index] = capitalized;
      
      // Auto-add new field if typing in the last one
      if (index === newMembers.length - 1 && capitalized.trim() !== '') {
        return { ...prev, members: [...newMembers, ''] };
      }
      
      return { ...prev, members: newMembers };
    });
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pl-PL';
      utterance.rate = 0.9;
      
      // Ensure voices are loaded
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        window.speechSynthesis.speak(utterance);
      } else {
        // Fallback for some browsers where voices load asynchronously
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.speak(utterance);
        };
      }
    }
  };

  const handleQRScan = (decodedText: string) => {
    const expectedValue = `egg_hunt_qr_${currentStage.qrNumber}`;
    if (decodedText === expectedValue) {
      setGameState('TASK');
      speak(currentStage.task);
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    });
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setCapturedPhoto(compressed);
      } catch (err) {
        console.error("Photo capture error:", err);
      }
    }
  };

  const nextStage = () => {
    // Save current result to session
    const currentResult: CheckpointResult = {
      checkpointId: checkpoints[currentStageIndex].id,
      photo: capturedPhoto || undefined,
      audio: recordedAudio || undefined,
      bestPerformer: bestPerformer || undefined
    };
    setSessionResults(prev => [...prev, currentResult]);

    if (currentStageIndex < checkpoints.length - 1) {
      setCurrentStageIndex(prev => prev + 1);
      setGameState('RIDDLE');
      setCapturedPhoto(null);
      setRecordedAudio(null);
      setBestPerformer(null);
    } else {
      handleFinish([...sessionResults, currentResult]);
    }
  };

  const handleEvaluationSubmit = () => {
    if (!bestPerformer) {
      alert("Wybierz osobę, która najlepiej wykonała zadanie!");
      return;
    }
    setVotes(prev => ({
      ...prev,
      [bestPerformer]: (prev[bestPerformer] || 0) + 1
    }));
    nextStage();
  };

  const handleFinish = async (finalResults: CheckpointResult[]) => {
    setGameState('FINISHED');
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#fbbf24', '#34d399', '#60a5fa', '#f87171']
    });

    // Save full session to Firebase
    const session: GameSession = {
      id: Date.now().toString(),
      gameId: gameId,
      teamName: teamInfo.name,
      members: teamInfo.members.filter(m => m.trim() !== ''),
      results: finalResults,
      timestamp: Date.now()
    };

    try {
      await saveSessionToFirebase(session);
    } catch (err) {
      console.error("Session save error:", err);
    }
  };

  const checkPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.toLowerCase() === 'wielkanoc') {
      setShowPasswordPrompt(false);
      setShowParentPanel(true);
      setPassword('');
    } else {
      alert("Błędne hasło!");
    }
  };

  const handleLoadGameById = async (id: string) => {
    setIsLoading(true);
    try {
      const loadedCheckpoints = await loadGameFromFirebase(id.toUpperCase());
      if (loadedCheckpoints) {
        setCheckpoints(loadedCheckpoints);
        setGameId(id.toUpperCase());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedCheckpoints));
        localStorage.setItem(GAME_ID_KEY, id.toUpperCase());
        return true;
      }
    } catch (error) {
      console.error("Błąd podczas pobierania gry:", error);
    } finally {
      setIsLoading(false);
    }
    return false;
  };

  const handleLoadGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loadId) return;
    
    const success = await handleLoadGameById(loadId);
    if (success) {
      setShowLoadPrompt(false);
      setLoadId('');
      alert("Gra została pomyślnie pobrana!");
    } else {
      alert("Nie znaleziono gry o takim kodzie.");
    }
  };

  if (gameState === 'PRINT' && showParentPanel) {
    return <PrintPage onBack={() => setGameState('START')} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-blue-50 font-sans text-gray-800 p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-2xl flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-400 p-2 rounded-full shadow-md">
            <Egg className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold text-green-800 hidden sm:block">Wielkanocna Przygoda</h1>
        </div>
        
        {gameState !== 'FINISHED' && (
          <div className="flex items-center gap-4">
            {checkpoints.length > 0 && gameState !== 'START' && (
              <div className="bg-white px-4 py-1 rounded-full shadow-sm border border-green-100 flex items-center gap-2">
                <Users size={16} className="text-green-600" />
                <span className="text-sm font-bold text-green-700">{currentStageIndex + 1}/{checkpoints.length}</span>
              </div>
            )}
            <button 
              onClick={() => setShowPasswordPrompt(true)}
              className="p-2 text-gray-400 hover:text-green-600 transition-colors"
            >
              <Settings size={20} />
            </button>
          </div>
        )}
      </header>

      <main className="w-full max-w-xl flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {gameState === 'START' && (
            <motion.div 
              key="start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white p-8 rounded-3xl shadow-2xl text-center space-y-6 border-b-8 border-green-200 relative"
            >
              {/* Small QR Code in top right */}
              <button 
                onClick={() => setShowShareQR(true)}
                className="absolute top-4 right-4 p-2 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-all shadow-sm group"
                title="Udostępnij grę"
              >
                <div className="relative">
                  <QRCodeSVG 
                    value={`${window.location.origin}${window.location.pathname}?game=${gameId}`} 
                    size={32}
                    level="L"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm">
                    <Share2 size={16} className="text-green-600" />
                  </div>
                </div>
              </button>

              <div className="relative inline-block">
                <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                  <Egg size={80} className="text-yellow-400 mx-auto" />
                </motion.div>
              </div>
              
              <h2 className="text-3xl font-extrabold text-green-900">Wielka Gra Terenowa!</h2>
              <p className="text-lg text-gray-600">
                Witajcie! Rozwiązujcie zagadki, skanujcie kody i wykonujcie zadania, aby znaleźć skarb!
              </p>
              
              <button 
                onClick={handleStart}
                className="w-full py-4 bg-green-500 hover:bg-green-600 text-white text-xl font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3"
              >
                ZACZYNAMY! <ArrowRight />
              </button>

              <div className="grid grid-cols-1 gap-3 pt-4">
                <button 
                  onClick={() => setShowLoadPrompt(true)}
                  className="py-3 bg-blue-50 text-blue-600 font-bold rounded-xl flex items-center justify-center gap-2 text-sm"
                >
                  <Download size={18} /> POBIERZ GRĘ
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'TEAM_SETUP' && (
            <motion.div 
              key="team"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-8 rounded-3xl shadow-2xl space-y-6 border-b-8 border-blue-200"
            >
              <div className="text-center space-y-2">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <UserPlus className="text-blue-600" size={32} />
                </div>
                <h2 className="text-2xl font-black text-blue-900 uppercase">Stwórz Drużynę</h2>
                <p className="text-gray-500">Wpiszcie swoje imiona, aby zacząć przygodę!</p>
              </div>

              <div className="space-y-4 max-h-[40vh] overflow-y-auto p-2">
                {teamInfo.members.map((member, index) => (
                  <div key={index} className="relative">
                    <input 
                      type="text"
                      value={member}
                      onChange={(e) => updateMember(index, e.target.value)}
                      className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-400 outline-none font-bold text-lg"
                      placeholder={`Imię ${index + 1}...`}
                    />
                    {member.trim() !== '' && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500">
                        <Check size={20} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase mb-1 ml-1">Nazwa Waszej Drużyny</label>
                  <input 
                    type="text"
                    value={teamInfo.name}
                    onChange={(e) => setTeamInfo({ ...teamInfo, name: e.target.value })}
                    className="w-full p-4 bg-blue-50 border-2 border-blue-100 rounded-xl focus:border-blue-500 outline-none font-black text-xl text-blue-900 text-center"
                    placeholder="np. SZYBKIE ZAJĄCZKI"
                  />
                </div>

                <button 
                  onClick={handleTeamSubmit}
                  className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 transition-all uppercase tracking-widest"
                >
                  NAZWIJ DRUŻYNĘ I START!
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'RIDDLE' && currentStage && (
            <motion.div 
              key="riddle"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="bg-white p-8 rounded-3xl shadow-xl space-y-6 border-b-8 border-blue-200"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3 text-blue-600">
                  <HelpCircle size={28} />
                  <span className="font-bold tracking-widest uppercase text-sm">Zagadka #{currentStageIndex + 1}</span>
                </div>
                <button 
                  onClick={() => speak(currentStage.hint)}
                  className="p-3 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                >
                  <Volume2 size={24} />
                </button>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-800 leading-tight">
                {currentStage.hint}
              </h3>

              {currentStage.image && (
                <div className="rounded-2xl overflow-hidden border-4 border-blue-50 shadow-inner">
                  <img src={currentStage.image} alt="Hint" className="w-full h-48 object-cover" />
                </div>
              )}

              <button 
                onClick={() => setGameState('SCANNING')}
                className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white text-lg font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3"
              >
                <Camera size={24} /> ZNALAZŁEM! SKANUJĘ
              </button>
            </motion.div>
          )}

          {gameState === 'SCANNING' && (
            <motion.div 
              key="scanning"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-6"
            >
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-green-800">Skanowanie kodu #{currentStage.qrNumber}</h3>
                <p className="text-gray-500">Znajdź kod QR ukryty w tym miejscu!</p>
              </div>
              
              <QRScanner 
                onScan={handleQRScan} 
                expectedValue={`egg_hunt_qr_${currentStage.qrNumber}`} 
              />

              <button 
                onClick={() => setGameState('RIDDLE')}
                className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
              >
                Wróć do zagadki
              </button>
            </motion.div>
          )}

          {gameState === 'TASK' && currentStage && (
            <motion.div 
              key="task"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white p-8 rounded-3xl shadow-xl text-center space-y-6 border-b-8 border-purple-200"
            >
              <div className="flex justify-between items-start">
                <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center">
                  <Users className="text-purple-600" size={24} />
                </div>
                <button 
                  onClick={() => speak(currentStage.task)}
                  className="p-3 bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100 transition-colors"
                >
                  <Volume2 size={24} />
                </button>
              </div>
              
              <h3 className="text-2xl font-bold text-purple-900">Zadanie Zespołowe!</h3>
              <p className="text-lg text-gray-700 font-medium">
                {currentStage.task}
              </p>

              {currentStage.requirePhoto && (
                <div className="space-y-4">
                  <div className="w-full h-48 bg-gray-50 rounded-2xl border-2 border-dashed border-purple-200 flex items-center justify-center overflow-hidden">
                    {capturedPhoto ? (
                      <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-gray-400 flex flex-col items-center gap-2">
                        <Camera size={32} />
                        <span className="text-sm">Zrób zdjęcie zadania</span>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handlePhotoCapture}
                  />
                  {!capturedPhoto ? (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 bg-purple-500 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2"
                    >
                      <Camera size={20} /> ZRÓB ZDJĘCIE
                    </button>
                  ) : (
                    <button 
                      onClick={() => setCapturedPhoto(null)}
                      className="text-sm text-purple-500 font-bold flex items-center justify-center gap-1 mx-auto"
                    >
                      <RotateCcw size={14} /> Powtórz zdjęcie
                    </button>
                  )}
                </div>
              )}

              {currentStage.requireAudio && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Nagraj wykonanie zadania:</p>
                  <div className="flex flex-col items-center gap-4">
                    {recordedAudio ? (
                      <div className="w-full bg-red-50 p-4 rounded-2xl border-2 border-red-100 flex flex-col items-center gap-3">
                        <audio src={recordedAudio} controls className="w-full" />
                        <button 
                          onClick={() => setRecordedAudio(null)}
                          className="text-xs font-black text-red-400 uppercase tracking-widest hover:text-red-600"
                        >
                          Nagraj ponownie
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`w-full py-8 rounded-2xl flex flex-col items-center justify-center transition-all border-4 border-dashed ${
                          isRecording 
                            ? 'bg-red-500 border-red-300 text-white animate-pulse' 
                            : 'bg-red-50 border-red-200 text-red-400 hover:bg-red-100'
                        }`}
                      >
                        {isRecording ? <Square size={48} fill="white" /> : <Mic size={48} />}
                        <span className="font-black mt-2 uppercase tracking-widest">
                          {isRecording ? 'Zatrzymaj nagrywanie' : 'Nagraj dźwięk'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button 
                onClick={() => {
                  if (currentStage.requirePhoto && !capturedPhoto) {
                    alert("Zrób zdjęcie, aby potwierdzić wykonanie zadania!");
                    return;
                  }
                  if (currentStage.requireAudio && !recordedAudio) {
                    alert("Nagraj dźwięk, aby potwierdzić wykonanie zadania!");
                    return;
                  }
                  if (currentStage.requireEvaluation) {
                    setGameState('EVALUATION');
                    setBestPerformer(null);
                  } else {
                    nextStage();
                  }
                }}
                className={`w-full py-4 text-white text-lg font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 ${
                  (currentStage.requirePhoto && !capturedPhoto) || (currentStage.requireAudio && !recordedAudio)
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : 'bg-purple-500 hover:bg-purple-600'
                }`}
              >
                GOTOWE! <CheckCircle2 />
              </button>
            </motion.div>
          )}

          {gameState === 'EVALUATION' && currentStage && (
            <motion.div 
              key="evaluation"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-8 rounded-3xl shadow-xl text-center space-y-6 border-b-8 border-yellow-200"
            >
              <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <Star className="text-yellow-600" size={32} />
              </div>
              <h3 className="text-2xl font-black text-yellow-900 uppercase">Kto był najlepszy?</h3>
              <p className="text-gray-600 font-medium">Wybierzcie osobę, która najlepiej poradziła sobie z tym zadaniem!</p>

              <div className="grid grid-cols-1 gap-3">
                {teamInfo.members.map((member) => (
                  <button 
                    key={member}
                    onClick={() => setBestPerformer(member)}
                    className={`p-4 rounded-2xl border-2 font-bold text-lg transition-all ${
                      bestPerformer === member 
                        ? 'bg-yellow-400 border-yellow-400 text-white shadow-lg scale-[1.02]' 
                        : 'bg-white border-gray-100 text-gray-600 hover:border-yellow-200'
                    }`}
                  >
                    {member}
                  </button>
                ))}
              </div>

              <button 
                onClick={handleEvaluationSubmit}
                className="w-full py-4 bg-green-500 text-white font-black rounded-2xl shadow-xl hover:bg-green-600 transition-all uppercase tracking-widest"
              >
                ZATWIERDŹ I DALEJ
              </button>
            </motion.div>
          )}

          {gameState === 'FINISHED' && (
            <motion.div 
              key="finished"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-10 rounded-3xl shadow-2xl text-center space-y-8 border-b-8 border-yellow-200"
            >
              <Trophy size={100} className="text-yellow-400 mx-auto" />
              <div className="space-y-2">
                <h2 className="text-4xl font-black text-green-900 leading-tight uppercase">BRAWO {teamInfo.name}!</h2>
                <p className="text-xl text-gray-600">
                  Udało się! Znaleźliście wszystkie jajka. Jesteście mistrzami!
                </p>
              </div>

              {(() => {
                const voteValues = Object.values(votes) as number[];
                if (voteValues.length === 0) return null;
                const maxVotes = Math.max(...voteValues);
                if (maxVotes === 0) return null;

                const winners = Object.entries(votes)
                  .filter(([_, count]) => count === maxVotes)
                  .map(([name]) => name);

                return (
                  <div className="bg-yellow-50 p-6 rounded-2xl border-2 border-yellow-100 space-y-3">
                    <div className="flex items-center justify-center gap-2 text-yellow-700 font-black uppercase tracking-wider">
                      <Star size={20} fill="currentColor" />
                      <span>Wyróżnienie</span>
                      <Star size={20} fill="currentColor" />
                    </div>
                    <p className="text-gray-600 font-medium">Najbardziej wyróżniał się:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {winners.map((name) => (
                        <span key={name} className="px-4 py-2 bg-yellow-400 text-white font-black rounded-xl shadow-md text-lg">
                          {name}
                        </span>
                      ))}
                    </div>
                    {winners.length > 1 && (
                      <p className="text-xs text-yellow-600 font-bold uppercase mt-2">Ex aequo!</p>
                    )}
                  </div>
                );
              })()}

              <button 
                onClick={() => setGameState('START')}
                className="w-full py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-colors"
              >
                ZAGRAJ JESZCZE RAZ
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Password Prompt */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="bg-yellow-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                <Lock className="text-yellow-600" size={24} />
              </div>
              <h3 className="text-xl font-bold">Panel Rodzica</h3>
              <p className="text-sm text-gray-500">Wpisz hasło, aby edytować grę</p>
            </div>
            <form onSubmit={checkPassword} className="space-y-4">
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 rounded-xl border-2 border-gray-100 focus:border-yellow-400 outline-none text-center text-lg"
                placeholder="Hasło..."
                autoFocus
              />
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowPasswordPrompt(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl"
                >
                  Anuluj
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-yellow-400 text-white font-bold rounded-xl shadow-lg"
                >
                  Wejdź
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Load Game Prompt */}
      {showLoadPrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                <Download className="text-blue-600" size={24} />
              </div>
              <h3 className="text-xl font-bold">Pobierz Grę</h3>
              <p className="text-sm text-gray-500">Wpisz 6-znakowy kod gry</p>
            </div>
            <form onSubmit={handleLoadGame} className="space-y-4">
              <input 
                type="text" 
                value={loadId}
                onChange={(e) => setLoadId(e.target.value.toUpperCase())}
                className="w-full p-4 rounded-xl border-2 border-gray-100 focus:border-blue-400 outline-none text-center text-2xl font-mono font-bold"
                placeholder="KOD..."
                maxLength={6}
                autoFocus
              />
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowLoadPrompt(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl"
                >
                  Anuluj
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 bg-blue-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Pobierz'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Parent Panel */}
      {showParentPanel && (
        <ParentPanel 
          checkpoints={checkpoints}
          gameId={gameId}
          onUpdate={(newCp, newId) => {
            setCheckpoints(newCp);
            setGameId(newId);
          }}
          onPrint={() => setGameState('PRINT')}
          onClose={() => setShowParentPanel(false)}
        />
      )}

      {/* Share QR Modal */}
      {showShareQR && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm space-y-6 text-center"
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold text-green-800">Udostępnij Grę</h3>
              <button onClick={() => setShowShareQR(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-green-100 flex justify-center">
              <QRCodeSVG 
                value={`${window.location.origin}${window.location.pathname}?game=${gameId}`} 
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-500 font-medium">Link do gry:</p>
              <button 
                onClick={() => {
                  const link = `${window.location.origin}${window.location.pathname}?game=${gameId}`;
                  navigator.clipboard.writeText(link);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between group hover:border-green-300 transition-all"
              >
                <span className="text-xs text-gray-400 truncate mr-2">
                  {`${window.location.origin}${window.location.pathname}?game=${gameId}`}
                </span>
                {copiedLink ? (
                  <Check size={18} className="text-green-500 shrink-0" />
                ) : (
                  <Copy size={18} className="text-gray-400 group-hover:text-green-600 shrink-0" />
                )}
              </button>
              {copiedLink && (
                <p className="text-[10px] text-green-600 font-bold uppercase animate-pulse">Skopiowano do schowka!</p>
              )}
            </div>

            <button 
              onClick={() => setShowShareQR(false)}
              className="w-full py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg"
            >
              Zamknij
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
