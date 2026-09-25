import React, { useState, useEffect, useRef } from 'react';
import { useAIVoice } from '@/lib/aiVoice';
import './VoiceInterface.css';

export const VoiceInterface: React.FC = () => {
  const {
    isListening,
    isSpeaking,
    transcript,
    lastResponse,
    error,
    startListening,
    stopListening,
    sendMessage,
    speak,
    clearConversation,
  } = useAIVoice();

  const [isOpen, setIsOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastResponse, transcript]);

  const handleSendText = async () => {
    if (!textInput.trim()) return;
    const text = textInput;
    setTextInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="voice-interface">
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          className={`voice-fab ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
          onClick={() => setIsOpen(true)}
          aria-label={isListening ? 'กำลังฟัง... คลิกเพื่อหยุด' : 'เปิด AI Voice Assistant'}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            {isListening ? (
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3.2c.8-.58 1.23-1.48 1.23-2.45 0-1.86-1.28-3.37-2.94-3.73V2h-2v2.82c-1.24.36-2.26.98-2.95 2.02-.69.94-1.05 2.07-1.05 3.28 0 .75.18 1.43.47 2.05.27.61.76 1.12 1.43 1.45.67.33 1.44.47 2.2.47z" />
            ) : isSpeaking ? (
              <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71 0 3.14-2.1 5.82-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77zM14 5.97v1.65c2.14.67 3.56 2.33 3.56 4.33 0 2.32-1.58 4.27-3.56 4.67v1.92c3.06-.93 5-3.61 5-6.59 0-3.04-2.24-5.43-5-5.97z" />
            ) : (
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
            )}
          </svg>
        </button>
      )}

      {/* Voice Panel */}
      {isOpen && (
        <div className="voice-panel">
          <div className="voice-header">
            <h3>AI Voice Assistant</h3>
            <div className="voice-status">
              {isListening && <span className="status listening">🎤 กำลังฟัง...</span>}
              {isSpeaking && <span className="status speaking">🔊 กำลังพูด...</span>}
              {!isListening && !isSpeaking && <span className="status idle">พร้อมใช้งาน</span>}
            </div>
            <button className="voice-close" onClick={() => setIsOpen(false)} aria-label="ปิด">
              ×
            </button>
          </div>

          <div className="voice-messages">
            {transcript && (
              <div className="message user">
                <span className="label">คุณ:</span>
                <span className="text">{transcript}</span>
              </div>
            )}
            {lastResponse?.content && (
              <div className="message assistant">
                <span className="label">AI:</span>
                <span className="text">{lastResponse.content}</span>
                {lastResponse.error && (
                  <span className="error">⚠️ {lastResponse.error}</span>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="voice-error">
              ⚠️ {error.message}
            </div>
          )}

          <div className="voice-input-area">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'กำลังฟัง... พูดเลย' : 'พิมพ์ข้อความหรือกดไมค์เพื่อพูด...'}
              disabled={isListening}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendText();
              }}
            />
            <button
              className={`voice-mic-btn ${isListening ? 'active' : ''}`}
              onClick={toggleVoice}
              disabled={isSpeaking}
              aria-label={isListening ? 'หยุดฟัง' : 'เริ่มฟัง'}
            >
              {isListening ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.5 4.5V2H8.5v2.5H6v1.5h12V4.5h-2.5zM10 17c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3.2c.8-.58 1.23-1.48 1.23-2.45 0-1.86-1.28-3.37-2.94-3.73V2h-2v2.82c-1.24.36-2.26.98-2.95 2.02-.69.94-1.05 2.07-1.05 3.28 0 .75.18 1.43.47 2.05.27.61.76 1.12 1.43 1.45.67.33 1.44.47 2.2.47z" />
                </svg>
              )}
            </button>
            <button
              className="voice-clear-btn"
              onClick={clearConversation}
              aria-label="ล้างบทสนทนา"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceInterface;