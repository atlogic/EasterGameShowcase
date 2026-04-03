import React, { useState } from 'react';
import { Checkpoint } from '../types';
import { saveGameToFirebase, STORAGE_KEY } from '../constants';
import { 
  Plus, 
  Trash2, 
  Save, 
  Image as ImageIcon, 
  Camera, 
  X,
  Copy,
  Check,
  AlertCircle,
  Star,
  Mic,
  History,
  ChevronRight,
  Calendar,
  Printer,
  LayoutGrid,
  PlusCircle
} from 'lucide-react';
import { loadSessionsFromFirebase, loadUserGamesFromFirebase, generateGameId, GAME_ID_KEY } from '../constants';
import { GameSession, GameData } from '../types';

interface ParentPanelProps {
  checkpoints: Checkpoint[];
  gameId: string;
  onUpdate: (newCheckpoints: Checkpoint[], newGameId: string) => void;
  onPrint: () => void;
  onClose: () => void;
}

export const ParentPanel: React.FC<ParentPanelProps> = ({ checkpoints, gameId, onUpdate, onPrint, onClose }) => {
  const [localCheckpoints, setLocalCheckpoints] = useState<Checkpoint[]>(checkpoints);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'history' | 'my-games'>('config');
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [userGames, setUserGames] = useState<GameData[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [selectedSession, setSelectedSession] = useState<GameSession | null>(null);

  const startNewGame = () => {
    if (confirm("Czy na pewno chcesz stworzyć nową grę? Niezapisane zmiany zostaną utracone.")) {
      const newId = generateGameId();
      setLocalCheckpoints([]);
      onUpdate([], newId);
      localStorage.setItem(GAME_ID_KEY, newId);
      setActiveTab('config');
    }
  };

  const loadMyGames = async () => {
    setActiveTab('my-games');
    setIsLoadingGames(true);
    try {
      const data = await loadUserGamesFromFirebase();
      setUserGames(data);
    } catch (err) {
      console.error("Games load error:", err);
    } finally {
      setIsLoadingGames(false);
    }
  };

  const selectGame = (game: GameData) => {
    setLocalCheckpoints(game.checkpoints);
    onUpdate(game.checkpoints, game.id);
    localStorage.setItem(GAME_ID_KEY, game.id);
    setActiveTab('config');
  };

  const addCheckpoint = () => {
    const newCp: Checkpoint = {
      id: Date.now().toString(),
      name: '',
      hint: '',
      task: '',
      requirePhoto: false,
      requireAudio: false,
      requireEvaluation: false,
      qrNumber: localCheckpoints.length + 1
    };
    setLocalCheckpoints([...localCheckpoints, newCp]);
  };

  const loadHistory = async () => {
    setActiveTab('history');
    setIsLoadingSessions(true);
    try {
      const data = await loadSessionsFromFirebase(gameId);
      setSessions(data);
    } catch (err) {
      console.error("History load error:", err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const removeCheckpoint = (id: string) => {
    const filtered = localCheckpoints.filter(cp => cp.id !== id);
    const reindexed = filtered.map((cp, index) => ({ ...cp, qrNumber: index + 1 }));
    setLocalCheckpoints(reindexed);
  };

  const updateCheckpoint = (id: string, updates: Partial<Checkpoint>) => {
    setLocalCheckpoints(localCheckpoints.map(cp => cp.id === id ? { ...cp, ...updates } : cp));
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
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
        
        // Compress to JPEG with 0.6 quality for smaller size
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    });
  };

  const handleImageUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Automatically compress any uploaded image
        const compressed = await compressImage(file);
        updateCheckpoint(id, { image: compressed });
      } catch (err) {
        console.error("Compression error:", err);
        alert("Błąd podczas przetwarzania zdjęcia.");
      }
    }
  };

  const handleSave = async () => {
    if (localCheckpoints.length === 0) {
      alert("Dodaj przynajmniej jeden punkt gry!");
      return;
    }
    
    setIsSaving(true);
    try {
      await saveGameToFirebase(gameId, localCheckpoints);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localCheckpoints));
      onUpdate(localCheckpoints, gameId);
      alert("Gra została zapisana w chmurze! Kod: " + gameId);
      onClose();
    } catch (error: any) {
      console.error("Save error:", error);
      let msg = "Błąd podczas zapisywania. Sprawdź połączenie z internetem.";
      if (error.message && error.message.includes("quota")) {
        msg = "Przekroczono limit bazy danych (Quota exceeded). Spróbuj jutro.";
      } else if (error.message && error.message.includes("large")) {
        msg = "Gra jest za duża! Spróbuj zmniejszyć zdjęcia.";
      }
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const copyGameId = () => {
    navigator.clipboard.writeText(gameId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-4xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b flex justify-between items-center bg-green-50">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <h2 className="text-lg sm:text-xl font-black text-green-800">KONFIGURACJA GRY</h2>
            <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-green-200 shadow-sm">
              <span className="text-[9px] font-bold text-green-600 uppercase">KOD:</span>
              <button onClick={copyGameId} className="flex items-center gap-2 hover:opacity-70 transition-all">
                <span className="font-mono font-black text-green-700 text-base">{gameId}</span>
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-400" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${activeTab === 'config' ? 'bg-green-600 text-white' : 'bg-white text-gray-400 border border-gray-200'}`}
            >
              EDYCJA
            </button>
            <button 
              onClick={loadMyGames}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${activeTab === 'my-games' ? 'bg-green-600 text-white' : 'bg-white text-gray-400 border border-gray-200'}`}
            >
              <LayoutGrid size={14} /> MOJE GRY
            </button>
            <button 
              onClick={loadHistory}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-green-600 text-white' : 'bg-white text-gray-400 border border-gray-200'}`}
            >
              <History size={14} /> HISTORIA
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-green-100 rounded-full transition-colors ml-2">
              <X size={20} className="text-green-800" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-gray-50">
          {activeTab === 'config' ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <button 
                  onClick={startNewGame}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs hover:bg-blue-100 transition-all"
                >
                  <PlusCircle size={16} /> NOWA GRA
                </button>
                {localCheckpoints.length > 0 && (
                  <button 
                    onClick={onPrint}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg font-bold text-xs hover:bg-purple-100 transition-all"
                  >
                    <Printer size={16} /> DRUKUJ KODY QR
                  </button>
                )}
              </div>
              {localCheckpoints.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <AlertCircle size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Twoja trasa jest pusta. Dodaj pierwszy punkt!</p>
                </div>
              )}

              {localCheckpoints.map((cp, index) => (
                <div key={cp.id} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-200 relative group">
                  <div className="absolute -top-2 -left-2 bg-green-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-black shadow-md z-10 text-sm">
                    {index + 1}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    {/* Left Side: Inputs */}
                    <div className="md:col-span-9 space-y-3">
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-[9px] font-black text-gray-400 uppercase mb-0.5 ml-1">Nazwa Miejsca</label>
                          <input 
                            type="text" 
                            value={cp.name}
                            onChange={(e) => updateCheckpoint(cp.id, { name: e.target.value })}
                            className="w-full p-2.5 text-base font-bold rounded-lg border-2 border-gray-100 focus:border-green-500 focus:bg-white bg-gray-50 outline-none transition-all"
                            placeholder="Gdzie ukryjesz kod?"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-gray-400 uppercase mb-0.5 ml-1">Wskazówka / Zagadka</label>
                          <textarea 
                            value={cp.hint}
                            onChange={(e) => updateCheckpoint(cp.id, { hint: e.target.value })}
                            className="w-full p-2.5 text-sm font-medium rounded-lg border-2 border-gray-100 focus:border-green-500 focus:bg-white bg-gray-50 outline-none transition-all h-16 resize-none"
                            placeholder="Podpowiedź dla dzieci..."
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-gray-400 uppercase mb-0.5 ml-1">Zadanie</label>
                          <input 
                            type="text" 
                            value={cp.task}
                            onChange={(e) => updateCheckpoint(cp.id, { task: e.target.value })}
                            className="w-full p-2.5 text-sm font-bold rounded-lg border-2 border-gray-100 focus:border-purple-500 focus:bg-white bg-gray-50 outline-none transition-all"
                            placeholder="Co muszą zrobić?"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button 
                          onClick={() => updateCheckpoint(cp.id, { requirePhoto: !cp.requirePhoto })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 font-bold text-[11px] transition-all ${
                            cp.requirePhoto 
                              ? 'bg-purple-600 border-purple-600 text-white shadow-sm' 
                              : 'bg-white border-gray-200 text-gray-400 hover:border-purple-200'
                          }`}
                        >
                          <Camera size={14} />
                          {cp.requirePhoto ? 'ZDJĘCIE' : 'BEZ ZDJĘCIA'}
                        </button>
                        <button 
                          onClick={() => updateCheckpoint(cp.id, { requireEvaluation: !cp.requireEvaluation })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 font-bold text-[11px] transition-all ${
                            cp.requireEvaluation 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                              : 'bg-white border-gray-200 text-gray-400 hover:border-blue-200'
                          }`}
                        >
                          <Star size={14} />
                          {cp.requireEvaluation ? 'OCENA' : 'BEZ OCENY'}
                        </button>
                        <button 
                          onClick={() => updateCheckpoint(cp.id, { requireAudio: !cp.requireAudio })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 font-bold text-[11px] transition-all ${
                            cp.requireAudio 
                              ? 'bg-red-600 border-red-600 text-white shadow-sm' 
                              : 'bg-white border-gray-200 text-gray-400 hover:border-red-200'
                          }`}
                        >
                          <Mic size={14} />
                          {cp.requireAudio ? 'NAGRANIE' : 'BEZ NAGRANIA'}
                        </button>
                        <div className="px-2 py-1 bg-green-50 text-green-700 rounded-lg border border-green-100 font-mono font-bold text-[11px]">
                          QR: #{cp.qrNumber}
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Image Upload */}
                    <div className="md:col-span-3 flex flex-col items-center justify-start gap-1.5">
                      <label className="w-full cursor-pointer group/img">
                        <div className="aspect-square w-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center overflow-hidden group-hover/img:border-green-400 transition-all">
                          {cp.image ? (
                            <img src={cp.image} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center text-gray-300">
                              <ImageIcon size={24} />
                              <span className="text-[9px] font-bold mt-1 uppercase">Zdjęcie</span>
                            </div>
                          )}
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(cp.id, e)} />
                      </label>
                      {cp.image && (
                        <button 
                          onClick={() => updateCheckpoint(cp.id, { image: undefined })}
                          className="text-[9px] font-bold text-red-400 hover:text-red-600 uppercase tracking-wider"
                        >
                          Usuń
                        </button>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={() => removeCheckpoint(cp.id)}
                    className="absolute top-2 right-2 p-1.5 text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Usuń punkt"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              <button 
                onClick={addCheckpoint}
                className="w-full py-6 border-4 border-dashed border-gray-200 rounded-2xl text-gray-300 hover:text-green-500 hover:border-green-300 hover:bg-green-50/30 transition-all flex flex-col items-center gap-1 group"
              >
                <Plus size={32} className="group-hover:scale-110 transition-transform" />
                <span className="font-black text-sm uppercase tracking-widest">Dodaj kolejny krok</span>
              </button>
            </>
          ) : activeTab === 'my-games' ? (
            <div className="space-y-4">
              {isLoadingGames ? (
                <div className="flex flex-col items-center py-12 text-gray-400">
                  <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-4" />
                  <p className="text-sm font-bold">Wczytywanie gier...</p>
                </div>
              ) : userGames.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <LayoutGrid size={48} className="mx-auto mb-4 opacity-10" />
                  <p className="text-sm">Nie masz jeszcze żadnych zapisanych gier.</p>
                  <button 
                    onClick={startNewGame}
                    className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg font-bold text-sm"
                  >
                    Stwórz pierwszą grę
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {userGames.map(game => (
                    <button 
                      key={game.id}
                      onClick={() => selectGame(game)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        gameId === game.id 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 bg-white hover:border-green-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono font-black text-green-700">{game.id}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">
                          {new Date(game.createdAt).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-700 mb-1">
                        {game.checkpoints.length} punktów
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium truncate">
                        {game.checkpoints.map(cp => cp.name).join(', ')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {isLoadingSessions ? (
                <div className="flex flex-col items-center py-12 text-gray-400">
                  <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-4" />
                  <p className="text-sm font-bold">Wczytywanie historii...</p>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <History size={48} className="mx-auto mb-4 opacity-10" />
                  <p className="text-sm">Brak zapisanych rozgrywek dla tej gry.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {sessions.map(session => (
                    <div key={session.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      <button 
                        onClick={() => setSelectedSession(selectedSession?.id === session.id ? null : session)}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-green-100 p-2 rounded-lg">
                            <Calendar size={20} className="text-green-600" />
                          </div>
                          <div className="text-left">
                            <h4 className="font-black text-gray-800 uppercase text-sm">{session.teamName}</h4>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">
                              {new Date(session.timestamp).toLocaleString('pl-PL')} • {session.members.length} osób
                            </p>
                          </div>
                        </div>
                        <ChevronRight className={`text-gray-300 transition-transform ${selectedSession?.id === session.id ? 'rotate-90' : ''}`} />
                      </button>

                      {selectedSession?.id === session.id && (
                        <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                          <div className="flex flex-wrap gap-2">
                            {session.members.map(m => (
                              <span key={m} className="px-2 py-1 bg-white border border-gray-200 rounded-md text-[10px] font-bold text-gray-600">
                                {m}
                              </span>
                            ))}
                          </div>

                          <div className="space-y-3">
                            {session.results.map((res, idx) => {
                              const cp = checkpoints.find(c => c.id === res.checkpointId);
                              return (
                                <div key={idx} className="bg-white p-3 rounded-lg border border-gray-100 space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-green-600 uppercase">Punkt #{idx + 1}: {cp?.name || 'Nieznany'}</span>
                                    {res.bestPerformer && (
                                      <span className="flex items-center gap-1 text-[10px] font-black text-yellow-600 uppercase">
                                        <Star size={10} fill="currentColor" /> {res.bestPerformer}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    {res.photo && (
                                      <div className="w-20 h-20 rounded-md overflow-hidden border border-gray-100">
                                        <img src={res.photo} alt="Result" className="w-full h-full object-cover" />
                                      </div>
                                    )}
                                    {res.audio && (
                                      <div className="flex-1 flex items-center">
                                        <audio controls src={res.audio} className="w-full h-8 scale-90 origin-left" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-white border-t flex flex-col sm:flex-row gap-2">
          <button 
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-600 font-black rounded-lg hover:bg-gray-200 transition-colors uppercase tracking-wider text-sm"
          >
            Anuluj
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className={`flex-[2] py-3 text-white font-black rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm ${
              isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 hover:scale-[1.01] active:scale-95'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                Zapisywanie...
              </>
            ) : (
              <>
                <Save size={20} /> Zapisz i udostępnij
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
