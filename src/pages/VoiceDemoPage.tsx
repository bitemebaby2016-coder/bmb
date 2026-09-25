import React from 'react';
import { VoiceInterface } from '@/components/VoiceInterface';
import './VoiceDemoPage.css';

export const VoiceDemoPage: React.FC = () => {
  return (
    <div className="voice-demo-page">
      <div className="demo-container">
        <header className="demo-header">
          <h1>🎙️ AI Voice Assistant Demo</h1>
          <p className="demo-subtitle">
            พูดคุยกับ AI Voice ของ Bite Me Baby — ใช้ OpenRouter (Nemotron-3-Ultra / Qwen Fallback)
          </p>
        </header>

        <main className="demo-main">
          <section className="demo-section">
            <h2>วิธีใช้งาน</h2>
            <ul className="instructions">
              <li><strong>กดไอคอนไมค์</strong> เพื่อเริ่มพูด (Web Speech API STT)</li>
              <li><strong>พูดเป็นภาษาไทย</strong> — AI จะประมวลผลผ่าน OpenRouter (Nemotron-3-Ultra)</li>
              <li><strong>AI จะตอบกลับด้วยเสียง</strong> (Web Speech API TTS)</li>
              <li>หรือพิมพ์ข้อความในช่องด้านล่างได้เช่นกัน</li>
            </ul>
          </section>

          <section className="demo-section">
            <h2>สิ่งที่ AI Voice ช่วยได้</h2>
            <div className="capabilities-grid">
              <div className="capability-card">
                <h3>🍽️ สั่งอาหาร</h3>
                <p>SAME_DAY และ PRE_ORDER — ตรวจสอบเมนู ราคา โปรโมชัน</p>
              </div>
              <div className="capability-card">
                <h3>📦 ติดตามออเดอร์</h3>
                <p>เช็คสถานะ การจัดส่ง เวลาประมาณ</p>
              </div>
              <div className="capability-card">
                <h3>📍 ข้อมูลจัดส่ง</h3>
                <p>พื้นที่ ค่าส่ง ระยะทาง (5km gate)</p>
              </div>
              <div className="capability-card">
                <h3>❌ ยกเลิก/แก้ไข</h3>
                <p>ตามนโยบาย cutoff และ refund</p>
              </div>
            </div>
          </section>

          <section className="demo-section">
            <h2>โมเดล AI</h2>
            <div className="model-info">
              <div className="model-card primary">
                <h4>🥇 Primary</h4>
                <code>nvidia/nemotron-3-ultra-550b-a55b:free</code>
                <p>High-quality reasoning, ตอบเป็นภาษาไทยได้ดี</p>
              </div>
              <div className="model-card fallback">
                <h4>🔄 Fallback</h4>
                <code>qwen/qwen3.7-flash</code>
                <p>รองรับภาษาไทย เร็ว ฟรี</p>
              </div>
            </div>
            <p className="note">⚠️ ต้องตั้งค่า <code>VITE_OPENROUTER_API_KEY</code> ใน .env.local</p>
          </section>

          <section className="demo-section">
            <h2>สถาปัตยกรรม</h2>
            <pre className="architecture-diagram">{`Voice Input (Web Speech API)
       ↓
Speech-to-Text (Browser STT)
       ↓
AI Processing (OpenRouter)
       ↓
Function Calling → Authorized Backend Tools
       ↓
Text-to-Speech (Browser TTS)
       ↓
Voice Output`}</pre>
          </section>
        </main>

        {/* Voice Interface Component */}
        <VoiceInterface />
      </div>
    </div>
  );
};

export default VoiceDemoPage;